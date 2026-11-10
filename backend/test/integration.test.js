import "dotenv/config";
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import app from "../app.js";
import { db, pool, migrate } from "../db.js";
import { hashPassword } from "../auth.js";
import { privateDir } from "../private-documents.js";
import { uploadDir } from "../storage-paths.js";

// Refuses to touch a live database. CI creates an isolated MySQL 8 database.
const enabled =
  process.env.RUN_MYSQL_TESTS === "1" &&
  /_test$/.test(process.env.MYSQL_DATABASE || "");
test(
  "real MySQL: bank → seller → first offer → verification → pickup → delivery → dashboard",
  { skip: !enabled, timeout: 120000 },
  async () => {
    process.env.ADMIN_USERNAME = "integration-admin";
    process.env.ADMIN_PASSWORD_HASH = hashPassword("integration-password-123");
    process.env.SELLER_PII_KEY = "cd".repeat(32);
    await migrate();
    await migrate(); // idempotent schema migration
    // Older installations may have server-default media/operations collations.
    // Dispatch must work even when the decline table differs from orders.
    await db.run(
      "ALTER TABLE courier_declined_orders CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci",
    );
    const server = app.listen(0, "127.0.0.1");
    await new Promise((r) => server.once("listening", r));
    const base = `http://127.0.0.1:${server.address().port}`;
    const image = await sharp({
      create: { width: 130, height: 70, channels: 3, background: "#fa7722" },
    })
      .png()
      .toBuffer();
    const createdPublic = [];
    const request = async (url, token, body, method = "GET") => {
      const multipart = body instanceof FormData;
      const r = await fetch(base + url, {
        method,
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...(!multipart && body ? { "Content-Type": "application/json" } : {}),
        },
        body: multipart ? body : body ? JSON.stringify(body) : undefined,
      });
      const data = await r.json().catch(() => ({}));
      return { status: r.status, data };
    };
    const ok = async (url, token, body, method = "GET", status = 200) => {
      const r = await request(url, token, body, method);
      assert.equal(r.status, status, JSON.stringify(r.data));
      return r.data;
    };
    const form = (values, images = []) => {
      const b = new FormData();
      for (const [k, v] of Object.entries(values)) b.set(k, String(v));
      for (const k of images)
        b.append(k, new Blob([image], { type: "image/png" }), k + ".png");
      return b;
    };
    const suffix = String(Date.now()).slice(-7),
      phone = (n) => "09" + String(n) + suffix;
    try {
      const admin = (
        await ok(
          "/api/admin/login",
          null,
          {
            username: "integration-admin",
            password: "integration-password-123",
          },
          "POST",
        )
      ).token;
      const seller = await ok(
        "/api/seller/auth/register",
        null,
        form(
          {
            phone: phone(10),
            password: "seller-password-123",
            ownerName: "فروشنده تست",
            shopName: "فروشگاه تست",
            category: "supermarket",
            address: "نشانی تست",
            nationalId: "1234567891",
            iban: "IR" + "1".repeat(24),
          },
          ["logo"],
        ),
        "POST",
        201,
      );
      assert.equal(seller.seller.store.isActive, false);
      await ok(
        `/api/admin/stores/${seller.seller.store.id}`,
        admin,
        { active: true },
        "PATCH",
      );
      await db.run("UPDATE stores SET min_basket=0 WHERE id=?", [
        seller.seller.store.id,
      ]);
      const masterIds = [];
      for (const [category, name, price] of [
        ["drinks", "نوشیدنی تست", 40000],
        ["bakery", "کیک تست", 30000],
      ]) {
        const result = await ok(
          "/api/admin/products",
          admin,
          form(
            {
              name,
              category,
              unit: "عدد",
              base_price: price,
              stock: 20,
              max_discount: 25,
              description: "توضیحات واقعی محصول تست",
            },
            ["image"],
          ),
          "POST",
          201,
        );
        masterIds.push(Number(result.id));
      }
      const bank = await ok("/api/admin/products", admin);
      for (const p of bank.products) {
        createdPublic.push(p.image_url);
        const meta = await sharp(
          path.join(uploadDir, path.basename(p.image_url)),
        ).metadata();
        assert.equal(meta.width, meta.height);
      }
      const drink = (
        await ok(
          "/api/seller/products",
          seller.token,
          { masterId: masterIds[0], price: 40000, stock: 20 },
          "POST",
          201,
        )
      ).product;
      const cake = (
        await ok(
          "/api/seller/products",
          seller.token,
          { masterId: masterIds[1], price: 30000, stock: 20 },
          "POST",
          201,
        )
      ).product;
      assert.equal(
        (
          await request(
            `/api/seller/products/${drink.id}`,
            seller.token,
            { name: "tampered" },
            "PATCH",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            `/api/seller/products/${drink.id}`,
            seller.token,
            { price: 40000, discountPercent: 26 },
            "PATCH",
          )
        ).status,
        400,
      );
      assert.equal(
        (
          await request(
            "/api/seller/products",
            seller.token,
            { masterId: masterIds[0], price: 40000, stock: 20 },
            "POST",
          )
        ).status,
        409,
      );
      const customer = await ok(
        "/api/auth/register",
        null,
        {
          phone: phone(11),
          password: "customer-password-123",
          firstName: "مشتری",
        },
        "POST",
        201,
      );
      const payload = {
        storeId: seller.seller.store.id,
        items: { [drink.id]: 2, [cake.id]: 2 },
        firstOrderProductId: drink.id,
        addressText: "نشانی مشتری",
        payment: "cash",
        total: 1,
        discount: 999999,
      };
      assert.equal(
        (
          await request(
            "/api/orders",
            customer.token,
            { ...payload, firstOrderProductId: cake.id },
            "POST",
          )
        ).status,
        400,
      );
      const attempts = await Promise.all([
        request("/api/orders", customer.token, payload, "POST"),
        request("/api/orders", customer.token, payload, "POST"),
      ]);
      assert.deepEqual(attempts.map((r) => r.status).sort(), [201, 409]);
      const order = attempts.find((r) => r.status === 201).data.order;
      assert.equal(order.subtotal, 140000);
      assert.equal(order.discount, 20000);
      assert.equal(order.total, 170000);
      assert.equal(order.items[0].discountedQty, 1);
      assert.equal(
        Number(
          (await db.get("SELECT stock FROM products WHERE id=?", [drink.id]))
            .stock,
        ),
        18,
      );
      assert.equal(
        (
          await request(
            `/api/seller/orders/${order.id}/status`,
            seller.token,
            { status: 5 },
            "PATCH",
          )
        ).status,
        400,
      );
      for (const status of [2, 3])
        await ok(
          `/api/seller/orders/${order.id}/status`,
          seller.token,
          { status },
          "PATCH",
        );
      const couriers = [];
      for (const n of [12, 13]) {
        await ok(
          "/api/courier/auth/register",
          null,
          {
            phone: phone(n),
            password: "courier-password-123",
            fullName: "پیک تست",
            vehicle: "motorcycle",
          },
          "POST",
          201,
        );
        const c = await ok(
          "/api/courier/auth/login",
          null,
          { phone: phone(n), password: "courier-password-123" },
          "POST",
        );
        couriers.push(c);
        assert.equal(
          (await request("/api/courier/orders", c.token)).status,
          403,
        );
        const submit = () =>
          ok(
            "/api/courier/verification",
            c.token,
            form({ plate: "۱۲۳ الف ۴۵", vehicleInfo: "موتور تست مشکی" }, [
              "national",
              "motor",
              "motor",
              "motor",
              "motor",
              "license",
              "platePhoto",
            ]),
            "POST",
          );
        await submit();
        const saved = await db.get(
          "SELECT motor_photos FROM courier_accounts WHERE id=?",
          [c.courier.id],
        );
        assert.equal(JSON.parse(saved.motor_photos).length, 4);
        if (n === 12) {
          for (const status of ["needs_correction", "rejected"]) {
            await ok(
              `/api/admin/couriers/${c.courier.id}/review`,
              admin,
              { status, reason: "تصویر خوانا ارسال شود" },
              "PATCH",
            );
            assert.equal(
              (await request("/api/courier/orders", c.token)).status,
              403,
            );
            await submit();
          }
        }
        await ok(
          `/api/admin/couriers/${c.courier.id}/review`,
          admin,
          { status: "approved" },
          "PATCH",
        );
        assert.equal(
          (await request("/api/courier/orders", c.token)).status,
          200,
        );
      }
      await db.run("UPDATE stores SET lat=35.96721,lng=50.65043 WHERE id=?", [
        seller.seller.store.id,
      ]);
      const dispatchCourier = couriers[0];
      assert.equal(
        (await ok("/api/courier/auth/me", dispatchCourier.token)).courier
          .verificationStatus,
        "approved",
      );
      await ok(
        "/api/courier/location",
        dispatchCourier.token,
        { lat: 35.96721, lng: 50.65043 },
        "PATCH",
      );
      assert.equal(
        (await ok("/api/courier/auth/me", dispatchCourier.token)).courier
          .online,
        false,
      );
      const offlineOffers = await ok(
        "/api/courier/orders",
        dispatchCourier.token,
      );
      assert.equal(offlineOffers.dispatchStatus, "offline");
      assert.equal(
        offlineOffers.orders.some((o) => o.id === order.id),
        false,
      );
      await ok(
        "/api/courier/availability",
        dispatchCourier.token,
        { online: true, lat: 32, lng: 48 },
        "PATCH",
      );
      assert.equal(
        (await ok("/api/courier/orders", dispatchCourier.token)).orders.some(
          (o) => o.id === order.id,
        ),
        false,
      );
      for (const c of couriers) {
        await ok(
          "/api/courier/availability",
          c.token,
          { online: true, lat: 35.96721, lng: 50.65043 },
          "PATCH",
        );
      }
      const offered = await ok("/api/courier/orders", dispatchCourier.token);
      assert.equal(offered.dispatchStatus, "offers_available");
      assert.equal(
        offered.orders.some((o) => o.id === order.id),
        true,
      );
      await db.run("UPDATE orders SET status=2 WHERE id=?", [order.id]);
      assert.equal(
        (await ok("/api/courier/orders", dispatchCourier.token)).orders.some(
          (o) => o.id === order.id,
        ),
        false,
      );
      await db.run("UPDATE orders SET status=3 WHERE id=?", [order.id]);
      await db.run(
        "UPDATE courier_accounts SET location_updated_at=? WHERE id=?",
        [
          new Date(Date.now() - 16 * 60 * 1000).toISOString(),
          dispatchCourier.courier.id,
        ],
      );
      assert.equal(
        (await ok("/api/courier/orders", dispatchCourier.token)).dispatchStatus,
        "location_stale",
      );
      await ok(
        "/api/courier/availability",
        dispatchCourier.token,
        { online: true, lat: 35.96721, lng: 50.65043 },
        "PATCH",
      );
      for (const c of couriers) await ok("/api/courier/orders", c.token);
      const claims = await Promise.all(
        couriers.map((c) =>
          request(
            `/api/courier/orders/${order.id}/claim`,
            c.token,
            undefined,
            "POST",
          ),
        ),
      );
      assert.deepEqual(claims.map((c) => c.status).sort(), [200, 409]);
      const winner = couriers[claims.findIndex((c) => c.status === 200)],
        loser = couriers[claims.findIndex((c) => c.status === 409)];
      assert.equal(
        (
          await request(
            `/api/courier/orders/${order.id}/complete`,
            loser.token,
            undefined,
            "POST",
          )
        ).status,
        409,
      );
      const queuedOrder = (
        await ok(
          "/api/orders",
          customer.token,
          { ...payload, items: { [cake.id]: 1 }, firstOrderProductId: null },
          "POST",
          201,
        )
      ).order;
      for (const status of [2, 3])
        await ok(
          `/api/seller/orders/${queuedOrder.id}/status`,
          seller.token,
          { status },
          "PATCH",
        );
      assert.equal(
        (await ok("/api/courier/orders", winner.token)).orders.some(
          (o) => o.id === queuedOrder.id,
        ),
        false,
      );
      assert.equal(
        (
          await request(
            `/api/courier/orders/${queuedOrder.id}/claim`,
            winner.token,
            {},
            "POST",
          )
        ).status,
        409,
      );
      assert.equal(
        (await db.get("SELECT status FROM orders WHERE id=?", [order.id]))
          .status,
        3,
      );
      await ok(
        `/api/courier/orders/${order.id}/claim`,
        winner.token,
        {},
        "POST",
      );
      assert.equal(
        (
          await request(
            `/api/courier/orders/${order.id}/pickup`,
            winner.token,
            {},
            "POST",
          )
        ).status,
        409,
      );
      await ok(
        `/api/courier/orders/${order.id}/arrive`,
        winner.token,
        {},
        "POST",
      );
      await ok(
        `/api/courier/orders/${order.id}/arrive`,
        winner.token,
        {},
        "POST",
      );
      await ok(
        `/api/courier/orders/${order.id}/pickup`,
        winner.token,
        {},
        "POST",
      );
      await ok(
        `/api/courier/orders/${order.id}/pickup`,
        winner.token,
        {},
        "POST",
      );
      assert.equal(
        (await request(`/api/orders/${order.id}/delivery-code`, null)).status,
        401,
      );
      const deliveryCode = await ok(
        `/api/orders/${order.id}/delivery-code`,
        customer.token,
      );
      assert.match(deliveryCode.code, /^\d{6}$/);
      assert.equal(
        (
          await request(
            `/api/courier/orders/${order.id}/complete`,
            winner.token,
            { code: "000000" },
            "POST",
          )
        ).status,
        400,
      );
      await ok(
        `/api/courier/orders/${order.id}/complete`,
        winner.token,
        { code: deliveryCode.code },
        "POST",
      );
      assert.equal(
        (
          await request(
            `/api/courier/orders/${order.id}/complete`,
            winner.token,
            undefined,
            "POST",
          )
        ).status,
        200,
      );
      const history = await ok(`/api/admin/orders/${order.id}/events`, admin);
      assert.deepEqual(
        history.events.map((e) => Number(e.status)),
        [1, 2, 3, 4, 5],
      );
      const dashboard = await ok("/api/admin/dashboard", admin);
      assert.equal(dashboard.stats.status5, 1);
      assert.equal(dashboard.stats.sales, 170000);
      assert.equal(dashboard.stats.discounts, 20000);
      assert.equal(dashboard.stats.approvedCouriers, 2);
      const documentUrl = `/api/admin/couriers/${winner.courier.id}/documents/national`;
      assert.equal((await request(documentUrl, customer.token)).status, 401);
      const doc = await fetch(base + documentUrl, {
        headers: { Authorization: `Bearer ${admin}` },
      });
      assert.equal(doc.status, 200);
      assert.equal(
        (await sharp(Buffer.from(await doc.arrayBuffer())).metadata()).format,
        "jpeg",
      );
      for (const kind of [
        "motor-0",
        "motor-1",
        "motor-2",
        "motor-3",
        "plate",
        "license",
      ]) {
        const imageResponse = await fetch(
          base + `/api/admin/couriers/${winner.courier.id}/documents/${kind}`,
          { headers: { Authorization: `Bearer ${admin}` } },
        );
        assert.equal(imageResponse.status, 200);
        assert.equal(
          (
            await sharp(
              Buffer.from(await imageResponse.arrayBuffer()),
            ).metadata()
          ).format,
          "jpeg",
        );
      }
      const originalDocumentKey = process.env.SELLER_PII_KEY;
      try {
        process.env.SELLER_PII_KEY = "ef".repeat(32);
        const failure = await fetch(base + documentUrl, {
          headers: { Authorization: `Bearer ${admin}` },
        });
        assert.equal(failure.status, 409);
        assert.match(failure.headers.get("content-type"), /application\/json/);
        assert.equal(
          (await failure.json()).error.code,
          "document_decryption_failed",
        );
      } finally {
        process.env.SELLER_PII_KEY = originalDocumentKey;
      }
      const w = await ok("/api/courier/wallet", winner.token);
      assert.equal(w.earned, 50000);
      assert.equal(w.available, 50000);
      const summary = await ok("/api/courier/summary", winner.token);
      assert.equal(summary.totalTrips, 1);
      assert.equal(summary.tripsToday, 1);
      assert.equal(summary.earningsToday, 50000);
      assert.equal(
        summary.week.reduce((n, d) => n + d.earnings, 0),
        50000,
      );
      assert.equal(
        (await ok("/api/courier/summary", loser.token)).totalTrips,
        0,
      );
      const withdrawals = await Promise.all([
        request(
          "/api/courier/withdrawals",
          winner.token,
          { amount: 50000, iban: "IR" + "1".repeat(24) },
          "POST",
        ),
        request(
          "/api/courier/withdrawals",
          winner.token,
          { amount: 50000, iban: "IR" + "1".repeat(24) },
          "POST",
        ),
      ]);
      assert.deepEqual(withdrawals.map((r) => r.status).sort(), [201, 409]);
      const ticket = await ok(
        "/api/courier/tickets",
        winner.token,
        { subject: "پرسش تسویه", body: "پیگیری پرداخت" },
        "POST",
        201,
      );
      assert.equal(
        (await request(`/api/courier/tickets/${ticket.id}`, loser.token))
          .status,
        404,
      );
      await ok(
        `/api/admin/tickets/${ticket.id}/messages`,
        admin,
        { body: "در حال بررسی" },
        "POST",
        201,
      );
      assert.equal(
        (await ok(`/api/courier/tickets/${ticket.id}`, winner.token)).messages
          .length,
        2,
      );
      // Product edits propagate to all existing seller offers, but do not rewrite old order snapshots.
      await ok(
        `/api/admin/products/${masterIds[0]}`,
        admin,
        form({
          name: "نام جدید نوشیدنی",
          description: "ویرایش مرکزی",
          category: "drinks",
          unit: "بطری",
          base_price: 50000,
          stock: 8,
          max_discount: 20,
        }),
        "PUT",
      );
      assert.equal(
        (await db.get("SELECT name FROM products WHERE id=?", [drink.id])).name,
        "نام جدید نوشیدنی",
      );
      await ok(
        `/api/admin/products/${masterIds[0]}`,
        admin,
        { active: false },
        "PATCH",
      );
      assert.equal(
        (await ok("/api/products")).products.some((p) => p.id === drink.id),
        false,
      );
      // Cancellation never restores eligibility for the first-order offer.
      const next = await ok(
        "/api/auth/register",
        null,
        { phone: phone(14), password: "customer-password-123" },
        "POST",
        201,
      );
      const cancelled = await ok(
        "/api/orders",
        next.token,
        { ...payload, items: { [cake.id]: 1 }, firstOrderProductId: null },
        "POST",
        201,
      );
      await ok(
        `/api/orders/${cancelled.order.id}/cancel`,
        next.token,
        {},
        "PATCH",
      );
      assert.equal(
        (await ok("/api/me/state", next.token)).firstOrderEligible,
        false,
      );
      const declineOrder = (
        await ok(
          "/api/orders",
          next.token,
          { ...payload, items: { [cake.id]: 1 }, firstOrderProductId: null },
          "POST",
          201,
        )
      ).order;
      for (const status of [2, 3])
        await ok(
          `/api/seller/orders/${declineOrder.id}/status`,
          seller.token,
          { status },
          "PATCH",
        );
      for (const c of couriers) await ok("/api/courier/orders", c.token);
      await ok(
        `/api/courier/orders/${declineOrder.id}/decline`,
        loser.token,
        undefined,
        "POST",
      );
      await ok(
        `/api/courier/orders/${declineOrder.id}/decline`,
        loser.token,
        undefined,
        "POST",
      );
      assert.equal(
        (await ok("/api/courier/orders", loser.token)).orders.some(
          (o) => o.id === declineOrder.id,
        ),
        false,
      );
      assert.equal(
        (await ok("/api/courier/orders", winner.token)).orders.some(
          (o) => o.id === declineOrder.id,
        ),
        true,
      );
      assert.equal(
        (
          await request(
            `/api/courier/orders/${declineOrder.id}/claim`,
            loser.token,
            undefined,
            "POST",
          )
        ).status,
        409,
      );
      await ok(
        `/api/courier/orders/${declineOrder.id}/claim`,
        winner.token,
        undefined,
        "POST",
      );
      assert.equal(
        (await ok("/api/courier/orders", winner.token)).dispatchStatus,
        "active_trip",
      );
      await ok(
        `/api/courier/orders/${declineOrder.id}/arrive`,
        winner.token,
        {},
        "POST",
      );
      await ok(
        `/api/courier/orders/${declineOrder.id}/pickup`,
        winner.token,
        {},
        "POST",
      );
      // Financial terms are snapshotted independently from seller commissions.
      await db.run("UPDATE orders SET courier_commission_rate=10 WHERE id=?", [
        declineOrder.id,
      ]);
      for (let i = 0; i < 5; i++)
        assert.equal(
          (
            await request(
              `/api/courier/orders/${declineOrder.id}/complete`,
              winner.token,
              { code: "000000" },
              "POST",
            )
          ).status,
          400,
        );
      assert.equal(
        (
          await request(
            `/api/courier/orders/${declineOrder.id}/complete`,
            winner.token,
            { code: "000000" },
            "POST",
          )
        ).status,
        429,
      );
      await ok(
        `/api/admin/orders/${declineOrder.id}/reset-delivery-code`,
        admin,
        {},
        "POST",
      );
      const code2 = (
        await ok(`/api/orders/${declineOrder.id}/delivery-code`, next.token)
      ).code;
      await ok(
        `/api/courier/orders/${declineOrder.id}/complete`,
        winner.token,
        { code: code2 },
        "POST",
      );
      const wallet2 = await ok("/api/courier/wallet", winner.token);
      assert.equal(wallet2.earned, 95000);
      assert.equal(Number(wallet2.periods.commission), 5000);
      const history2 = await ok(
        "/api/courier/history?status=completed",
        winner.token,
      );
      assert.equal(history2.total, 2);
      assert.equal((await ok("/api/courier/history", loser.token)).total, 0);
      const notices = await ok("/api/courier/notifications", winner.token);
      assert.ok(notices.unread > 0);
      await ok(
        "/api/courier/notifications/all/read",
        winner.token,
        {},
        "PATCH",
      );
      assert.equal(
        (await ok("/api/courier/notifications", winner.token)).unread,
        0,
      );
      const passwordResponse = await ok(
        "/api/courier/auth/password",
        winner.token,
        {
          currentPassword: "courier-password-123",
          newPassword: "courier-updated-password-456",
        },
        "POST",
      );
      assert.equal(passwordResponse.ok, true);
      const expiredOrder = (
        await ok(
          "/api/orders",
          next.token,
          { ...payload, items: { [cake.id]: 1 }, firstOrderProductId: null },
          "POST",
          201,
        )
      ).order;
      for (const status of [2, 3])
        await ok(
          `/api/seller/orders/${expiredOrder.id}/status`,
          seller.token,
          { status },
          "PATCH",
        );
      await ok("/api/courier/orders", winner.token);
      await db.run(
        "UPDATE courier_offers SET expires_at=? WHERE courier_id=? AND order_id=?",
        [
          new Date(Date.now() - 1000).toISOString(),
          winner.courier.id,
          expiredOrder.id,
        ],
      );
      assert.equal(
        (
          await request(
            `/api/courier/orders/${expiredOrder.id}/claim`,
            winner.token,
            {},
            "POST",
          )
        ).status,
        409,
      );
      assert.equal(
        (await ok("/api/courier/orders", winner.token)).orders.some(
          (o) => o.id === expiredOrder.id,
        ),
        false,
      );
    } finally {
      // CI database is disposable. Only media files created by the test are removed here.
      for (const url of createdPublic)
        await fs
          .unlink(new URL("../uploads/" + path.basename(url), import.meta.url))
          .catch(() => {});
      const documents = await db.all(
        "SELECT motor_photo,national_photo,license_photo,plate_photo FROM courier_accounts WHERE phone LIKE ?",
        ["%" + suffix],
      );
      for (const row of documents)
        for (const filename of Object.values(row))
          if (filename)
            await fs
              .unlink(path.join(privateDir, path.basename(filename)))
              .catch(() => {});
      await new Promise((r) => server.close(r));
      await pool.end();
    }
  },
);
