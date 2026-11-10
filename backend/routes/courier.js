import courierOperations from "./courier-operations.js";
import { distanceKm, validPoint } from "../delivery.js";
import { recordOrderEvent } from "../order-workflow.js";
import { Router } from "express";
import crypto from "node:crypto";
import { db, mapOrder } from "../db.js";
import {
  bearerToken,
  hashPassword,
  loginThrottle,
  normalizePhone,
  verifyPassword,
} from "../auth.js";

import multer from "multer";
import fs from "node:fs";
import {
  privateDir,
  documentKey,
  secureDocument,
} from "../private-documents.js";
const router = Router();
fs.mkdirSync(privateDir, { recursive: true, mode: 0o700 });
const documents = multer({
  storage: multer.diskStorage({
    destination: privateDir,
    filename: (_r, _f, cb) => cb(null, crypto.randomUUID() + ".jpg"),
  }),
  limits: { fileSize: 5 * 1024 * 1024, files: 7 },
  fileFilter: (_r, f, cb) =>
    cb(null, ["image/jpeg", "image/png", "image/webp"].includes(f.mimetype)),
}).fields([
  { name: "motor", maxCount: 4 },
  { name: "national", maxCount: 1 },
  { name: "license", maxCount: 1 },
  { name: "platePhoto", maxCount: 1 },
]);
const fail = (res, status, code, message) =>
  res.status(status).json({ error: { code, message } });
const shapeCourier = (row) => ({
  id: Number(row.id),
  fullName: row.full_name,
  phone: row.phone,
  vehicle: row.vehicle,
  active: Boolean(row.active),
  online: Boolean(row.online),
  lat: row.lat == null ? null : Number(row.lat),
  lng: row.lng == null ? null : Number(row.lng),
  verificationStatus: row.verification_status,
  rejectionReason: row.rejection_reason,
});

async function requireCourier(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token)
      return fail(
        res,
        401,
        "courier_unauthorized",
        "برای ادامه وارد پنل پیک شوید.",
      );
    const row = await db.get(
      `SELECT a.*
      FROM courier_sessions s JOIN courier_accounts a ON a.id=s.courier_id WHERE s.token=?`,
      [token],
    );
    if (!row)
      return fail(
        res,
        401,
        "courier_unauthorized",
        "نشست پیک معتبر یا فعال نیست.",
      );
    req.courier = shapeCourier(row);
    req.courierToken = token;
    next();
  } catch (error) {
    next(error);
  }
}

router.post("/auth/register", async (req, res) => {
  const phone = normalizePhone(req.body?.phone),
    password = String(req.body?.password ?? "");
  const fullName = String(req.body?.fullName ?? "")
    .trim()
    .slice(0, 120);
  const vehicle = String(req.body?.vehicle ?? "motorcycle");
  if (
    !/^09\d{9}$/.test(phone) ||
    password.length < 10 ||
    !fullName ||
    vehicle !== "motorcycle"
  )
    return fail(
      res,
      400,
      "invalid_registration",
      "نام، شماره موبایل معتبر، رمز حداقل ۱۰ نویسه و وسیلهٔ موتورسیکلت الزامی است.",
    );
  try {
    const result = await db.run(
      "INSERT INTO courier_accounts (phone, password_hash, full_name, vehicle, active, created_at) VALUES (?, ?, ?, 'motorcycle', 0, ?)",
      [phone, hashPassword(password), fullName, new Date().toISOString()],
    );
    return res.status(201).json({
      pendingApproval: true,
      message: "درخواست ثبت شد و پس از بررسی مدارک توسط مدیریت فعال می‌شود.",
      courierId: Number(result.insertId),
    });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY")
      return fail(
        res,
        409,
        "phone_taken",
        "با این شماره قبلاً درخواست پیک ثبت شده است.",
      );
    throw error;
  }
});

router.post("/auth/login", loginThrottle, async (req, res) => {
  const phone = normalizePhone(req.body?.phone),
    password = String(req.body?.password ?? "");
  if (!/^09\d{9}$/.test(phone) || !password)
    return fail(
      res,
      400,
      "invalid_credentials",
      "شماره موبایل و رمز عبور را وارد کنید.",
    );
  const account = await db.get("SELECT * FROM courier_accounts WHERE phone=?", [
    phone,
  ]);
  if (!account || !verifyPassword(password, account.password_hash))
    return fail(
      res,
      401,
      "invalid_credentials",
      "شماره موبایل یا رمز عبور پیک نادرست است.",
    );

  const token = crypto.randomBytes(32).toString("hex");
  await db.run(
    "INSERT INTO courier_sessions (token, courier_id, created_at) VALUES (?, ?, ?)",
    [token, account.id, new Date().toISOString()],
  );
  res.json({ token, courier: shapeCourier(account) });
});

router.use(requireCourier);
router.post("/auth/logout", async (req, res) => {
  await db.run("DELETE FROM courier_sessions WHERE token=?", [
    req.courierToken,
  ]);
  res.json({ ok: true });
});
router.get("/auth/me", (req, res) => res.json({ courier: req.courier }));

router.use(courierOperations);
router.post(
  "/verification",
  (req, res, next) => {
    try {
      documentKey();
      next();
    } catch (e) {
      return fail(res, 503, "security_configuration", e.message);
    }
  },
  documents,
  async (req, res) => {
    const files = Object.values(req.files || {}).flat();
    const clean = () =>
      files.forEach((f) => fs.promises.unlink(f.path).catch(() => {}));
    if (
      !req.files?.motor?.[0] ||
      !req.files?.national?.[0] ||
      !req.files?.license?.[0] ||
      !req.files?.platePhoto?.[0] ||
      !String(req.body.vehicleInfo || "").trim() ||
      !String(req.body.plate || "").trim()
    ) {
      clean();
      return fail(
        res,
        400,
        "required_documents",
        "پلاک، تصویر موتور، کارت ملی و گواهینامه الزامی است.",
      );
    }
    try {
      // Decode/encrypt one image at a time: seven large photographs in parallel
      // can exhaust memory and kill the process during verification upload.
      for (const file of files) await secureDocument(file);
      const result = await db.run(
        "UPDATE courier_accounts SET plate=?,motor_photo=?,national_photo=?,license_photo=?,plate_photo=?,vehicle_info=?,motor_photos=?,verification_status='pending',active=0,rejection_reason='' WHERE id=? AND verification_status IN ('unsubmitted','rejected','needs_correction')",
        [
          String(req.body.plate).trim().slice(0, 40),
          req.files.motor[0].filename,
          req.files.national[0].filename,
          req.files.license[0].filename,
          req.files.platePhoto[0].filename,
          String(req.body.vehicleInfo).trim().slice(0, 255),
          JSON.stringify(req.files.motor.map((f) => f.filename)),
          req.courier.id,
        ],
      );
      if (!result.affectedRows) {
        clean();
        return fail(
          res,
          409,
          "already_submitted",
          "مدارک در حال بررسی یا تأیید شده‌اند.",
        );
      }
      res.json({
        courier: shapeCourier(
          await db.get("SELECT * FROM courier_accounts WHERE id=?", [
            req.courier.id,
          ]),
        ),
      });
    } catch (e) {
      clean();
      if (!e.code)
        return fail(res, 400, "invalid_image", "مدرک باید تصویر معتبر باشد.");
      throw e;
    }
  },
);
router.use((req, res, next) => {
  if (!req.courier.active || req.courier.verificationStatus !== "approved")
    return fail(
      res,
      403,
      "verification_required",
      "ابتدا مدارک باید توسط مدیریت تأیید شوند.",
    );
  next();
});

router.get("/orders", async (req, res) => {
  const c = await db.get("SELECT * FROM courier_accounts WHERE id=?", [
    req.courier.id,
  ]);
  const fresh =
    c.online &&
    c.location_updated_at &&
    Date.now() - new Date(c.location_updated_at).getTime() < 15 * 60 * 1000 &&
    validPoint(c.lat, c.lng);
  const rows = await db.all(
    `SELECT o.*,s.address AS store_address,s.area AS store_area,s.lat AS store_lat,s.lng AS store_lng,d.courier_id,d.claimed_at,d.completed_at,u.phone AS customer_phone FROM orders o JOIN stores s ON s.id=o.store_id JOIN users u ON u.id=o.user_id LEFT JOIN order_deliveries d ON d.order_id=o.id WHERE (o.status=3 AND d.order_id IS NULL AND NOT EXISTS (SELECT 1 FROM courier_declined_orders declined WHERE declined.order_id COLLATE utf8mb4_unicode_ci=o.id COLLATE utf8mb4_unicode_ci AND declined.courier_id=?)) OR (d.courier_id=? AND o.status IN (4,5)) ORDER BY o.created_at DESC LIMIT 500`,
    [req.courier.id, req.courier.id],
  );
  const orders = rows
    .map((r) => {
      const mine = Number(r.courier_id) === req.courier.id;
      const distance = distanceKm(c, { lat: r.store_lat, lng: r.store_lng });
      return {
        ...mapOrder(r),
        pickupKm: distance === null ? null : Math.round(distance * 100) / 100,
        courierFee: Number(
          r.courier_fee ?? Math.max(50000, Math.min(80000, Number(r.delivery))),
        ),
        fareDetails:
          typeof r.fare_details === "string"
            ? JSON.parse(r.fare_details)
            : r.fare_details,
        storeAddress: r.store_address,
        storeLat: r.store_lat,
        storeLng: r.store_lng,
        storeArea: r.store_area,
        addressText: mine ? r.address_text : r.address_title,
        customerPhone: mine ? r.customer_phone : "",
        destinationLat: mine ? r.destination_lat : null,
        destinationLng: mine ? r.destination_lng : null,
        claimedByMe: mine,
        claimedAt: r.claimed_at,
        completedAt: r.completed_at,
      };
    })
    .filter(
      (o) =>
        o.claimedByMe || (fresh && o.pickupKm !== null && o.pickupKm <= 15),
    )
    .sort(
      (a, b) =>
        Number(b.claimedByMe) - Number(a.claimedByMe) ||
        (a.pickupKm ?? 999) - (b.pickupKm ?? 999),
    );
  res.json({
    orders,
    online: Boolean(c.online),
    locationFresh: Boolean(fresh),
    dispatchStatus: !c.online
      ? "offline"
      : !fresh
        ? "location_stale"
        : orders.some((o) => !o.claimedByMe)
          ? "offers_available"
          : "no_nearby_ready",
  });
});

router.post("/orders/:id/decline", async (req, res) => {
  const c = await db.get("SELECT * FROM courier_accounts WHERE id=?", [
    req.courier.id,
  ]);
  const order = await db.get(
    "SELECT o.id,s.lat,s.lng FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.id=? AND o.status=3",
    [req.params.id],
  );
  const distance = order ? distanceKm(c, order) : null;
  if (
    !c.online ||
    !c.location_updated_at ||
    Date.now() - new Date(c.location_updated_at).getTime() > 15 * 60000 ||
    distance === null ||
    distance > 15
  )
    return fail(
      res,
      409,
      "order_unavailable",
      "این پیشنهاد دیگر در دسترس نیست.",
    );
  await db.run(
    "INSERT IGNORE INTO courier_declined_orders (courier_id,order_id,created_at) VALUES (?,?,?)",
    [req.courier.id, req.params.id, new Date().toISOString()],
  );
  res.json({ ok: true });
});

router.post("/orders/:id/claim", async (req, res) => {
  try {
    const claimed = await db.transaction(async (tx) => {
      const c = await tx.get(
        "SELECT * FROM courier_accounts WHERE id=? FOR UPDATE",
        [req.courier.id],
      );
      if (
        !c?.online ||
        !c.active ||
        c.verification_status !== "approved" ||
        !c.location_updated_at ||
        Date.now() - new Date(c.location_updated_at).getTime() > 15 * 60 * 1000
      )
        return false;
      const order = await tx.get(
        "SELECT o.id,s.lat,s.lng FROM orders o JOIN stores s ON s.id=o.store_id WHERE o.id=? AND o.status=3 FOR UPDATE",
        [req.params.id],
      );
      if (!order || distanceKm(c, order) === null || distanceKm(c, order) > 15)
        return false;
      if (
        await tx.get(
          "SELECT 1 AS found FROM courier_declined_orders WHERE courier_id=? AND order_id=?",
          [req.courier.id, order.id],
        )
      )
        return false;
      await tx.run(
        "INSERT INTO order_deliveries (order_id,courier_id,claimed_at,completed_at) VALUES (?,?,?,NULL)",
        [order.id, req.courier.id, new Date().toISOString()],
      );
      await tx.run("UPDATE orders SET status=4 WHERE id=? AND status=3", [
        order.id,
      ]);
      await recordOrderEvent(tx, order.id, 4, "courier", req.courier.id);
      return true;
    });
    if (!claimed)
      return fail(res, 409, "order_unavailable", "سفارش آماده دریافت نیست.");
    res.json({ ok: true });
  } catch (error) {
    if (error?.code === "ER_DUP_ENTRY")
      return fail(
        res,
        409,
        "order_claimed",
        "این سفارش را پیک دیگری دریافت کرده است.",
      );
    throw error;
  }
});

router.post("/orders/:id/complete", async (req, res) => {
  const now = new Date().toISOString();
  const result = await db.transaction(async (tx) => {
    const delivery = await tx.get(
      "SELECT order_id FROM order_deliveries WHERE order_id=? AND courier_id=? AND completed_at IS NULL FOR UPDATE",
      [req.params.id, req.courier.id],
    );
    if (!delivery) return null;
    const changed = await tx.run(
      "UPDATE orders SET status=5 WHERE id=? AND status=4",
      [req.params.id],
    );
    if (!changed.affectedRows) return null;
    await tx.run(
      "UPDATE order_deliveries SET completed_at=? WHERE order_id=? AND courier_id=? AND completed_at IS NULL",
      [now, req.params.id, req.courier.id],
    );
    const completed = await tx.get(
      "SELECT courier_fee,delivery FROM orders WHERE id=?",
      [req.params.id],
    );
    const amount = Number(
      completed.courier_fee ??
        Math.max(50000, Math.min(80000, Number(completed.delivery))),
    );
    await tx.run(
      "INSERT INTO courier_ledger (courier_id,order_id,amount,created_at) VALUES (?,?,?,?)",
      [req.courier.id, req.params.id, amount, now],
    );
    await recordOrderEvent(tx, req.params.id, 5, "courier", req.courier.id);
    return tx.get("SELECT * FROM orders WHERE id=?", [req.params.id]);
  });
  if (!result)
    return fail(
      res,
      409,
      "order_not_completable",
      "برای تکمیل، ابتدا همین سفارش را دریافت کنید و مطمئن شوید هنوز آمادهٔ تحویل است.",
    );
  res.json({ order: mapOrder(result) });
});

export default router;
