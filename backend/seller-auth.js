import crypto from "node:crypto";
import { db } from "./db.js";
import { bearerToken } from "./auth.js";

export async function requireSellerAuth(req, res, next) {
  try {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: { code: "seller_unauthorized", message: "برای ادامه وارد حساب فروشنده شوید." } });
    const row = await db.get(
      `SELECT a.id, a.phone, a.owner_name, a.active FROM seller_sessions s
       JOIN seller_accounts a ON a.id = s.seller_id WHERE s.token = ?`, [token],
    );
    if (!row || !row.active) return res.status(401).json({ error: { code: "seller_unauthorized", message: "نشست فروشنده معتبر نیست؛ دوباره وارد شوید." } });
    req.seller = { id: Number(row.id), phone: row.phone, ownerName: row.owner_name };
    req.sellerToken = token;
    next();
  } catch (error) { next(error); }
}

export async function createSellerSession(sellerId) {
  const token = crypto.randomBytes(32).toString("hex");
  await db.run("INSERT INTO seller_sessions (token, seller_id, created_at) VALUES (?, ?, ?)", [token, sellerId, new Date().toISOString()]);
  return token;
}
