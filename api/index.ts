import type { VercelRequest, VercelResponse } from "@vercel/node";
import express from "express";
import { createServer } from "http";
import type { Request, Response, NextFunction } from "express";
import { neon } from "@neondatabase/serverless";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";

// ─── Express app ───
export const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
export const httpServer = createServer(app);

// ─── DB接続 ───
const sql = neon(process.env.DATABASE_URL!);

// ─── ファイルアップロード ───
const uploadsDir = path.join(process.cwd(), "server", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg", "image/png": ".png", "image/gif": ".gif", "image/webp": ".webp",
};
const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || ".jpg";
      cb(null, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) cb(null, true);
    else cb(new Error("Only image files (jpeg, png, gif, webp) are allowed"));
  },
});

// ─── 認証ユーティリティ ───

// ─── 予約テーブル初期化 ───
let tablesInitialized = false;
async function initBookingTables() {
  if (tablesInitialized) return;
  try {
    await sql`CREATE TABLE IF NOT EXISTS booking_staff (id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL, name TEXT NOT NULL, role TEXT DEFAULT '', avatar TEXT DEFAULT '', is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS booking_courses (id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL, name TEXT NOT NULL, category TEXT DEFAULT '', duration INTEGER DEFAULT 60, price INTEGER DEFAULT 0, description TEXT DEFAULT '', prepayment_only BOOLEAN DEFAULT false, image_url TEXT, staff_ids TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS booking_reservations (id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL, customer_name TEXT NOT NULL, customer_phone TEXT, customer_email TEXT, date TEXT NOT NULL, time TEXT NOT NULL, staff_id TEXT DEFAULT '__shop__', course_id TEXT NOT NULL, status TEXT DEFAULT 'confirmed', paid BOOLEAN DEFAULT false, cancel_token TEXT UNIQUE, created_at TIMESTAMP DEFAULT NOW())`;
    await sql`CREATE TABLE IF NOT EXISTS booking_settings (shop_id INTEGER PRIMARY KEY, store_name TEXT DEFAULT '', store_description TEXT DEFAULT '', store_address TEXT DEFAULT '', store_phone TEXT DEFAULT '', store_email TEXT DEFAULT '', store_hours TEXT DEFAULT '', store_closed_days TEXT DEFAULT '', banner_url TEXT DEFAULT '', staff_selection_enabled TEXT DEFAULT 'false', table_count INTEGER DEFAULT 0, max_party_size INTEGER DEFAULT 0, updated_at TIMESTAMP DEFAULT NOW())`;
    await sql`ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS table_count INTEGER DEFAULT 0`;
    await sql`ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS max_party_size INTEGER DEFAULT 0`;
    tablesInitialized = true;
  } catch (e) { console.error("initBookingTables error:", e); }
}

// ─── デモデータ ───
const DEMO_DATA: Record<number, { staff: { name: string; role: string; avatar: string }[]; courses: { name: string; category: string; duration: number; price: number; description: string; prepaymentOnly: boolean }[]; settings: Record<string, string>; }> = {
  1: {
    staff: [{ name: "佐藤 健太", role: "料理長", avatar: "佐健" }, { name: "高橋 裕子", role: "副料理長", avatar: "高裕" }],
    courses: [
      { name: "特製ラーメンコース", category: "食事", duration: 60, price: 2800, description: "自家製麺と特製スープの極上ラーメンコース。前菜・餃子・デザート付き。", prepaymentOnly: false },
      { name: "宴会プラン（2時間）", category: "宴会", duration: 120, price: 4500, description: "飲み放題付き宴会プラン。ラーメン・チャーハン・餃子など全8品。", prepaymentOnly: true },
      { name: "ランチセット予約", category: "食事", duration: 45, price: 1200, description: "日替わりラーメン＋ミニチャーハン＋ドリンクのお得なランチセット。", prepaymentOnly: false },
    ],
    settings: { store_name: "麺処 小田原屋", store_description: "自家製麺と厳選スープのこだわりラーメン店", store_address: "神奈川県小田原市栄町2-1-5", store_phone: "0465-22-1234", store_email: "info@odawaraya.jp", store_hours: "11:00〜22:00（L.O. 21:30）", store_closed_days: "毎週水曜日", banner_url: "", staff_selection_enabled: "false" },
  },
  3: {
    staff: [
      { name: "田中 美咲", role: "オーナースタイリスト", avatar: "田美" }, { name: "佐藤 優花", role: "シニアスタイリスト", avatar: "佐優" },
      { name: "山本 凛", role: "スタイリスト", avatar: "山凛" }, { name: "鈴木 愛", role: "ジュニアスタイリスト", avatar: "鈴愛" },
    ],
    courses: [
      { name: "カット", category: "ヘア", duration: 60, price: 4400, description: "カウンセリング・シャンプー・カット・ブロー込みのスタンダードメニュー。", prepaymentOnly: false },
      { name: "カット＋カラー", category: "ヘア", duration: 120, price: 9800, description: "カットとカラーのセットメニュー。オーガニックカラー使用。", prepaymentOnly: false },
      { name: "カット＋パーマ", category: "ヘア", duration: 150, price: 13200, description: "カットとパーマのセットメニュー。デジタルパーマも対応。", prepaymentOnly: false },
      { name: "ヘッドスパ", category: "リラクゼーション", duration: 45, price: 5500, description: "頭皮ケア＆リラクゼーション。炭酸泉使用。", prepaymentOnly: false },
    ],
    settings: { store_name: "Hair Salon MIKU", store_description: "あなたの魅力を引き出すヘアサロン", store_address: "神奈川県大和市中央3-5-8", store_phone: "046-261-3456", store_email: "info@salon-miku.jp", store_hours: "10:00〜20:00（最終受付19:00）", store_closed_days: "毎週火曜日", banner_url: "", staff_selection_enabled: "true" },
  },
};

async function seedShopIfEmpty(shopId: number) {
  const cnt = await sql`SELECT COUNT(*) as cnt FROM booking_courses WHERE shop_id = ${shopId}`;
  if (parseInt(cnt[0]?.cnt || "0") > 0) return;
  const demo = DEMO_DATA[shopId];
  if (!demo) {
    const shopRows = (await sql`SELECT name, description, address, phone, hours, closed_days, image_url FROM shops WHERE id = ${shopId}`) || [];
    if (shopRows.length === 0) return;
    const s = shopRows[0];
    await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only) VALUES (${shopId}, '通常コース', 'スタンダード', 60, 3000, '標準コースです。', false)`;
    await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_hours, store_closed_days, banner_url, staff_selection_enabled) VALUES (${shopId}, ${s.name||''}, ${s.description||''}, ${s.address||''}, ${s.phone||''}, ${s.hours||''}, ${s.closed_days||''}, ${s.image_url||''}, 'false') ON CONFLICT (shop_id) DO NOTHING`;
    return;
  }
  await sql`DELETE FROM booking_staff WHERE shop_id = ${shopId}`;
  const allStaffIds: string[] = [];
  for (const st of demo.staff) {
    await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${st.name}, ${st.role}, ${st.avatar})`;
    const maxRow = await sql`SELECT MAX(id) as id FROM booking_staff WHERE shop_id = ${shopId}`;
    if (maxRow[0]?.id != null) allStaffIds.push(String(maxRow[0].id));
  }
  for (const c of demo.courses) {
    await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, staff_ids) VALUES (${shopId}, ${c.name}, ${c.category}, ${c.duration}, ${c.price}, ${c.description}, ${c.prepaymentOnly}, ${allStaffIds})`;
  }
  const s = demo.settings;
  await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_email, store_hours, store_closed_days, banner_url, staff_selection_enabled) VALUES (${shopId}, ${s.store_name}, ${s.store_description}, ${s.store_address}, ${s.store_phone}, ${s.store_email||''}, ${s.store_hours}, ${s.store_closed_days}, ${s.banner_url||''}, ${s.staff_selection_enabled||'false'}) ON CONFLICT (shop_id) DO NOTHING`;
}

// ─── Stripeクライアント ───
async function getStripeClient() {
  const { default: Stripe } = await import("stripe");
  if (process.env.STRIPE_SECRET_KEY) return new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-03-31.basil" as any });
  const { getStripeSecretKey } = await import("../server/stripeClient");
  return new Stripe(await getStripeSecretKey(), { apiVersion: "2025-03-31.basil" as any });
}
async function getStripePublishableKeyValue(): Promise<string> {
  if (process.env.STRIPE_PUBLISHABLE_KEY) return process.env.STRIPE_PUBLISHABLE_KEY;
  try { const { getStripePublishableKey } = await import("../server/stripeClient"); return await getStripePublishableKey(); } catch { return ""; }
}

// ─── 型変換ヘルパー ───
function toShop(r: any) { return { ...r, galleryImageUrls: r.gallery_image_urls, isActive: r.is_active, enableStaffAssignment: r.enable_staff_assignment, displayOrder: r.display_order, lineAccountUrl: r.line_account_url, imageUrl: r.image_url, reservationUrl: r.reservation_url, reservationImageUrl: r.reservation_image_url, likeCount: r.like_count, stripeConnectId: r.stripe_connect_id, stripeConnectStatus: r.stripe_connect_status, areaId: r.area_id, closedDays: r.closed_days, updatedAt: r.updated_at, createdAt: r.created_at }; }
function toCoupon(r: any) { return { ...r, shopId: r.shop_id, discountType: r.discount_type, discountValue: r.discount_value, isFirstTimeOnly: r.is_first_time_only, isLineAccountCoupon: r.is_line_account_coupon, isActive: r.is_active, validFrom: r.valid_from, validUntil: r.valid_until, expiryDate: r.expiry_date, createdAt: r.created_at, updatedAt: r.updated_at }; }
function toCourse(c: any) { return { id: c.id.toString(), name: c.name, category: c.category || "", duration: c.duration || 60, price: c.price || 0, description: c.description || "", prepaymentOnly: c.prepayment_only || false, imageUrl: c.image_url || null, staffIds: (c.staff_ids || []).map((x: any) => x.toString()) }; }
function toReservation(r: any) { return { id: r.id.toString(), customerName: r.customer_name, customerPhone: r.customer_phone || undefined, customerEmail: r.customer_email || undefined, date: r.date, time: r.time, staffId: r.staff_id || "__shop__", courseId: r.course_id, status: r.status || "confirmed", paid: r.paid || false, reservationToken: r.cancel_token || undefined }; }
async function safeQuery(fn: () => Promise<any>): Promise<any[]> {
  try { return (await fn()) || []; } catch (e: any) { if (e?.message?.includes("Cannot read properties of null")) return []; throw e; }
}

// ─── セットアップ（シングルトン） ───
let _setup: Promise<void> | null = null;

export function ensureSetup(): Promise<void> {
  if (!_setup) {
    _setup = (async () => {
      const { runMigrations } = await import("../server/migrate");
      await runMigrations();
      const { seedDatabase } = await import("../server/seed");
      await seedDatabase();

      // 静的ファイル
      app.use("/uploads", express.static(uploadsDir, { setHeaders: (res) => res.setHeader("X-Content-Type-Options", "nosniff") }));
      app.post("/api/upload", upload.single("image"), (req, res) => {
        if (!req.file) return res.status(400).json({ message: "No image file provided" });
        res.json({ url: `/uploads/${req.file.filename}` });
      });

      // 予約テーブル初期化ミドルウェア
      app.use(async (_req, _res, next) => { try { await initBookingTables(); } catch {} next(); });

      // ─── エリア・カテゴリ ───
      app.get("/api/areas", async (_req, res) => { try { res.json(await sql`SELECT * FROM areas ORDER BY id`); } catch { res.status(500).json({ message: "Failed to fetch areas" }); } });
      app.get("/api/categories", async (_req, res) => { try { res.json(await sql`SELECT * FROM categories ORDER BY id`); } catch { res.status(500).json({ message: "Failed to fetch categories" }); } });

      // ─── 店舗 ───
      app.get("/api/shops", async (req, res) => {
        try {
          const { areaId, categoryId } = req.query;
          let rows;
          if (areaId) rows = await sql`SELECT * FROM shops WHERE area_id = ${parseInt(areaId as string)} ORDER BY display_order DESC, updated_at DESC`;
          else if (categoryId) rows = await sql`SELECT s.* FROM shops s JOIN shop_categories sc ON sc.shop_id = s.id WHERE sc.category_id = ${parseInt(categoryId as string)} ORDER BY s.display_order DESC, s.updated_at DESC`;
          else rows = await sql`SELECT * FROM shops ORDER BY display_order DESC, updated_at DESC`;
          res.json(rows.map(toShop));
        } catch { res.status(500).json({ message: "Failed to fetch shops" }); }
      });
      app.get("/api/shops/slug/:slug", async (req, res) => {
        try {
          const rows = await sql`SELECT * FROM shops WHERE slug = ${req.params.slug}`;
          if (!rows[0]) return res.status(404).json({ message: "Shop not found" });
          res.json(toShop(rows[0]));
        } catch { res.status(500).json({ message: "Failed to fetch shop" }); }
      });
      app.get("/api/shops/:id", async (req, res) => {
        try {
          const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
          const rows = await sql`SELECT * FROM shops WHERE id = ${id}`;
          if (!rows[0]) return res.status(404).json({ message: "Shop not found" });
          res.json(toShop(rows[0]));
        } catch { res.status(500).json({ message: "Failed to fetch shop" }); }
      });
      app.post("/api/shops", async (req, res) => {
        try {
          const b = req.body; const slug = b.slug || crypto.randomUUID().replace(/-/g, "").slice(0, 10);
          await sql`INSERT INTO shops (slug, name, description, area_id, area, category, subcategory, address, phone, hours, closed_days, website, display_order, line_account_url, image_url, gallery_image_urls, is_active, enable_staff_assignment, reservation_url, reservation_image_url, like_count) VALUES (${slug}, ${b.name||""}, ${b.description||""}, ${b.areaId||1}, ${b.area||""}, ${b.category||""}, ${b.subcategory||null}, ${b.address||""}, ${b.phone||null}, ${b.hours||null}, ${b.closedDays||null}, ${b.website||null}, ${b.displayOrder||0}, ${b.lineAccountUrl||null}, ${b.imageUrl||""}, ${b.galleryImageUrls||[]}, ${b.isActive!==false}, ${b.enableStaffAssignment||false}, ${b.reservationUrl||null}, ${b.reservationImageUrl||null}, ${b.likeCount||0})`;
          const rows = await sql`SELECT * FROM shops WHERE slug = ${slug}`;
          if (!rows[0]) return res.status(500).json({ message: "Failed to create shop" });
          res.status(201).json(toShop(rows[0]));
        } catch (e: any) { console.error("shop create error:", e); res.status(500).json({ message: "Failed to create shop" }); }
      });
      app.put("/api/shops/:id", async (req, res) => {
        try {
          const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
          const b = req.body;
          if (b.name !== undefined) await sql`UPDATE shops SET name=${b.name} WHERE id=${id}`;
          if (b.description !== undefined) await sql`UPDATE shops SET description=${b.description} WHERE id=${id}`;
          if (b.area !== undefined) await sql`UPDATE shops SET area=${b.area} WHERE id=${id}`;
          if (b.category !== undefined) await sql`UPDATE shops SET category=${b.category} WHERE id=${id}`;
          if (b.subcategory !== undefined) await sql`UPDATE shops SET subcategory=${b.subcategory} WHERE id=${id}`;
          if (b.address !== undefined) await sql`UPDATE shops SET address=${b.address} WHERE id=${id}`;
          if (b.phone !== undefined) await sql`UPDATE shops SET phone=${b.phone} WHERE id=${id}`;
          if (b.hours !== undefined) await sql`UPDATE shops SET hours=${b.hours} WHERE id=${id}`;
          if (b.closedDays !== undefined) await sql`UPDATE shops SET closed_days=${b.closedDays} WHERE id=${id}`;
          if (b.website !== undefined) await sql`UPDATE shops SET website=${b.website} WHERE id=${id}`;
          if (b.displayOrder !== undefined) await sql`UPDATE shops SET display_order=${b.displayOrder} WHERE id=${id}`;
          if (b.lineAccountUrl !== undefined) await sql`UPDATE shops SET line_account_url=${b.lineAccountUrl} WHERE id=${id}`;
          if (b.imageUrl !== undefined) await sql`UPDATE shops SET image_url=${b.imageUrl} WHERE id=${id}`;
          if (b.galleryImageUrls !== undefined) await sql`UPDATE shops SET gallery_image_urls=${b.galleryImageUrls} WHERE id=${id}`;
          if (b.isActive !== undefined) await sql`UPDATE shops SET is_active=${b.isActive} WHERE id=${id}`;
          if (b.enableStaffAssignment !== undefined) await sql`UPDATE shops SET enable_staff_assignment=${b.enableStaffAssignment} WHERE id=${id}`;
          if (b.reservationUrl !== undefined) await sql`UPDATE shops SET reservation_url=${b.reservationUrl} WHERE id=${id}`;
          if (b.reservationImageUrl !== undefined) await sql`UPDATE shops SET reservation_image_url=${b.reservationImageUrl} WHERE id=${id}`;
          if (b.likeCount !== undefined) await sql`UPDATE shops SET like_count=${b.likeCount} WHERE id=${id}`;
          if (b.stripeConnectId !== undefined) await sql`UPDATE shops SET stripe_connect_id=${b.stripeConnectId} WHERE id=${id}`;
          if (b.stripeConnectStatus !== undefined) await sql`UPDATE shops SET stripe_connect_status=${b.stripeConnectStatus} WHERE id=${id}`;
          await sql`UPDATE shops SET updated_at=NOW() WHERE id=${id}`;
          const rows = await sql`SELECT * FROM shops WHERE id=${id}`;
          if (!rows[0]) return res.status(404).json({ message: "Shop not found" });
          res.json(toShop(rows[0]));
        } catch (e: any) { console.error("shop update error:", e); res.status(500).json({ message: "Failed to update shop" }); }
      });
      app.post("/api/shops/:id/like", async (req, res) => {
        try {
          const id = parseInt(req.params.id);
          await sql`UPDATE shops SET like_count = like_count + 1 WHERE id = ${id}`;
          const rows = await sql`SELECT like_count FROM shops WHERE id = ${id}`;
          res.json({ likeCount: rows[0]?.like_count });
        } catch { res.status(500).json({ message: "Failed to like shop" }); }
      });

      // ─── クーポン ───
      app.get("/api/shops/:id/coupons", async (req, res) => {
        try {
          const shopId = parseInt(req.params.id); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
          res.json((await sql`SELECT * FROM coupons WHERE shop_id = ${shopId} ORDER BY updated_at DESC`).map(toCoupon));
        } catch { res.status(500).json({ message: "Failed to fetch coupons" }); }
      });
      app.post("/api/shops/:id/coupons", async (req, res) => {
        try {
          const shopId = parseInt(req.params.id); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
          const b = req.body;
          await sql`INSERT INTO coupons (shop_id, title, description, discount, discount_type, discount_value, expiry_date, is_first_time_only, is_line_account_coupon, is_active) VALUES (${shopId}, ${b.title||""}, ${b.description||null}, ${b.discount||null}, ${b.discountType||"FREE"}, ${b.discountValue||0}, ${b.expiryDate||null}, ${b.isFirstTimeOnly||false}, ${b.isLineAccountCoupon||false}, ${b.isActive!==false})`;
          const maxRow = await sql`SELECT MAX(id) as id FROM coupons WHERE shop_id = ${shopId}`;
          const newId = maxRow[0]?.id; if (newId == null) return res.status(500).json({ message: "Failed to create coupon" });
          const rows = await sql`SELECT * FROM coupons WHERE id = ${newId}`;
          res.status(201).json(toCoupon(rows[0]));
        } catch (e: any) { console.error(e); res.status(500).json({ message: "Failed to create coupon" }); }
      });
      app.get("/api/coupons", async (_req, res) => { try { res.json((await sql`SELECT * FROM coupons ORDER BY updated_at DESC`).map(toCoupon)); } catch { res.status(500).json({ message: "Failed to fetch coupons" }); } });
      app.put("/api/coupons/:id", async (req, res) => {
        try {
          const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ message: "Invalid coupon ID" });
          const b = req.body;
          if (b.title !== undefined) await sql`UPDATE coupons SET title=${b.title} WHERE id=${id}`;
          if (b.description !== undefined) await sql`UPDATE coupons SET description=${b.description} WHERE id=${id}`;
          if (b.discount !== undefined) await sql`UPDATE coupons SET discount=${b.discount} WHERE id=${id}`;
          if (b.discountType !== undefined) await sql`UPDATE coupons SET discount_type=${b.discountType}::discount_type WHERE id=${id}`;
          if (b.discountValue !== undefined) await sql`UPDATE coupons SET discount_value=${b.discountValue} WHERE id=${id}`;
          if (b.expiryDate !== undefined) await sql`UPDATE coupons SET expiry_date=${b.expiryDate} WHERE id=${id}`;
          if (b.isFirstTimeOnly !== undefined) await sql`UPDATE coupons SET is_first_time_only=${b.isFirstTimeOnly} WHERE id=${id}`;
          if (b.isLineAccountCoupon !== undefined) await sql`UPDATE coupons SET is_line_account_coupon=${b.isLineAccountCoupon} WHERE id=${id}`;
          if (b.isActive !== undefined) await sql`UPDATE coupons SET is_active=${b.isActive} WHERE id=${id}`;
          await sql`UPDATE coupons SET updated_at=NOW() WHERE id=${id}`;
          const rows = await sql`SELECT * FROM coupons WHERE id=${id}`;
          if (!rows[0]) return res.status(404).json({ message: "Coupon not found" });
          res.json(toCoupon(rows[0]));
        } catch (e: any) { console.error("coupon update error:", e); res.status(500).json({ message: "Failed to update coupon" }); }
      });
      app.delete("/api/coupons/:id", async (req, res) => {
        try {
          const id = parseInt(req.params.id); if (isNaN(id)) return res.status(400).json({ message: "Invalid coupon ID" });
          const cnt = await sql`SELECT COUNT(*) as cnt FROM coupons WHERE id = ${id}`;
          if (parseInt(cnt[0]?.cnt || "0") === 0) return res.status(404).json({ message: "Coupon not found" });
          await sql`DELETE FROM coupons WHERE id = ${id}`;
          res.json({ message: "Coupon deleted" });
        } catch { res.status(500).json({ message: "Failed to delete coupon" }); }
      });

      // ─── 認証 ───
      app.post("/api/auth/login", async (req, res) => {
        try {
          const { username, password } = req.body;
          if (!username || !password) return res.status(400).json({ message: "Username and password required" });
          const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
          const user = rows[0]; if (!user) return res.status(401).json({ message: "Invalid credentials" });
          const valid = await bcrypt.compare(password, user.password_hash);
          if (!valid) return res.status(401).json({ message: "Invalid credentials" });
          const payload = { userId: user.id, role: user.role, shopId: user.shop_id, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
          const token = Buffer.from(JSON.stringify(payload)).toString("base64");
          res.json({ id: user.id, username: user.username, role: user.role, shopId: user.shop_id, token });
        } catch (e: any) { console.error("login error:", e); res.status(500).json({ message: "Login failed" }); }
      });
      app.post("/api/auth/logout", (_req, res) => res.json({ message: "Logged out" }));
      app.get("/api/auth/me", async (req, res) => {
        const h = req.headers.authorization;
        if (!h?.startsWith("Bearer ")) return res.status(401).json({ message: "Not authenticated" });
        try {
          const decoded = JSON.parse(Buffer.from(h.substring(7), "base64").toString()) as { userId: number; role: string; shopId: number | null; exp: number };
          if (decoded.exp < Date.now()) return res.status(401).json({ message: "Token expired" });
          const rows = await sql`SELECT * FROM users WHERE id = ${decoded.userId}`;
          if (!rows[0]) return res.status(401).json({ message: "User not found" });
          res.json({ id: rows[0].id, username: rows[0].username, role: rows[0].role, shopId: rows[0].shop_id });
        } catch { res.status(401).json({ message: "Invalid token" }); }
      });

      // ─── スタッフ ───
      app.get("/api/shops/:shopId/staff", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          await seedShopIfEmpty(shopId);
          const rows = await safeQuery(() => sql`SELECT * FROM booking_staff WHERE shop_id = ${shopId} AND is_active = true ORDER BY id`);
          const courseRows = await safeQuery(() => sql`SELECT id, staff_ids FROM booking_courses WHERE shop_id = ${shopId} AND is_active = true`);
          res.json(rows.map((s: any) => ({ id: s.id.toString(), name: s.name, role: s.role || "", avatar: s.avatar || "", courseIds: courseRows.filter((c: any) => (c.staff_ids || []).includes(s.id.toString())).map((c: any) => c.id.toString()) })));
        } catch (e: any) { console.error("staff error:", e); res.status(500).json({ message: "Failed to fetch staff" }); }
      });
      app.post("/api/shops/:shopId/staff", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          const { name, role, avatar } = req.body;
          await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${name||""}, ${role||""}, ${avatar||""})`;
          const maxRow = await sql`SELECT MAX(id) as id FROM booking_staff WHERE shop_id = ${shopId}`;
          const newId = maxRow[0]?.id; if (newId == null) return res.status(500).json({ message: "Failed to create staff" });
          res.status(201).json({ id: String(newId), name: name||"", role: role||"", avatar: avatar||"", courseIds: [] });
        } catch { res.status(500).json({ message: "Failed to create staff" }); }
      });
      app.put("/api/shops/:shopId/staff", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          const { id, name, role, avatar } = req.body;
          await sql`UPDATE booking_staff SET name=${name||""}, role=${role||""}, avatar=${avatar||""} WHERE id=${parseInt(id)} AND shop_id=${shopId}`;
          res.json({ id: id.toString(), name, role, avatar });
        } catch { res.status(500).json({ message: "Failed to update staff" }); }
      });
      app.delete("/api/shops/:shopId/staff", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try { await sql`UPDATE booking_staff SET is_active=false WHERE id=${parseInt(req.query.id as string)} AND shop_id=${shopId}`; res.json({ message: "Staff deleted" }); }
        catch { res.status(500).json({ message: "Failed to delete staff" }); }
      });

      // ─── コース ───
      app.get("/api/shops/:shopId/courses", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          await seedShopIfEmpty(shopId);
          const rows = await safeQuery(() => sql`SELECT * FROM booking_courses WHERE shop_id=${shopId} AND is_active=true ORDER BY id`);
          res.json(rows.map(toCourse));
        } catch (e: any) { console.error("courses error:", e); res.status(500).json({ message: "Failed to fetch courses" }); }
      });
      app.post("/api/shops/:shopId/courses", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          const { name, category, duration, price, description, prepaymentOnly, imageUrl, staffIds } = req.body;
          await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, image_url, staff_ids) VALUES (${shopId}, ${name||""}, ${category||""}, ${duration||60}, ${price||0}, ${description||""}, ${prepaymentOnly||false}, ${imageUrl||null}, ${staffIds||[]})`;
          const maxRow = await sql`SELECT MAX(id) as id FROM booking_courses WHERE shop_id = ${shopId}`;
          const newId = maxRow[0]?.id; if (newId == null) return res.status(500).json({ message: "Failed to create course" });
          const rows = await sql`SELECT * FROM booking_courses WHERE id = ${newId}`;
          res.status(201).json(toCourse(rows[0]));
        } catch { res.status(500).json({ message: "Failed to create course" }); }
      });
      app.put("/api/shops/:shopId/courses", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          const { id, name, category, duration, price, description, prepaymentOnly, imageUrl, staffIds } = req.body;
          const courseId = parseInt(id);
          const cnt = await sql`SELECT COUNT(*) as cnt FROM booking_courses WHERE id = ${courseId} AND shop_id = ${shopId}`;
          if (parseInt(cnt[0]?.cnt || "0") === 0) return res.status(404).json({ message: "Course not found" });
          await sql`UPDATE booking_courses SET name=${name||""}, category=${category||""}, duration=${duration||60}, price=${price||0}, description=${description||""}, prepayment_only=${prepaymentOnly||false}, image_url=${imageUrl||null}, staff_ids=${staffIds||[]}, updated_at=NOW() WHERE id=${courseId} AND shop_id=${shopId}`;
          const rows = await sql`SELECT * FROM booking_courses WHERE id = ${courseId} AND shop_id = ${shopId}`;
          res.json(toCourse(rows[0]));
        } catch { res.status(500).json({ message: "Failed to update course" }); }
      });
      app.delete("/api/shops/:shopId/courses", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try { await sql`UPDATE booking_courses SET is_active=false WHERE id=${parseInt(req.query.id as string)} AND shop_id=${shopId}`; res.json({ message: "Course deleted" }); }
        catch { res.status(500).json({ message: "Failed to delete course" }); }
      });

      // ─── スロット ───
      app.get("/api/shops/:shopId/slots", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          const date = req.query.date as string; const courseId = req.query.courseId as string | undefined;
          const allSlots: string[] = [];
          for (let h = 10; h <= 19; h++) { allSlots.push(`${String(h).padStart(2,"0")}:00`); if (h < 19) allSlots.push(`${String(h).padStart(2,"0")}:30`); }
          if (!date) return res.json(allSlots.map(t => ({ time: t, available: true })));
          const settingsCnt = await sql`SELECT COUNT(*) as cnt FROM booking_settings WHERE shop_id=${shopId}`;
          let tableCount = 1;
          if (parseInt(settingsCnt[0]?.cnt || "0") > 0) { const sr = await sql`SELECT table_count FROM booking_settings WHERE shop_id=${shopId}`; tableCount = Math.max(parseInt(sr[0]?.table_count || "1",10)||1,1); }
          let courseDuration = 30;
          if (courseId) { const cc = await sql`SELECT COUNT(*) as cnt FROM booking_courses WHERE id=${courseId} AND shop_id=${shopId}`; if (parseInt(cc[0]?.cnt||"0")>0) { const cr = await sql`SELECT duration FROM booking_courses WHERE id=${courseId} AND shop_id=${shopId}`; if (cr[0]) courseDuration = parseInt(cr[0].duration,10)||30; } }
          const slotsNeeded = Math.ceil(courseDuration / 30);
          const reservations = await safeQuery(() => sql`SELECT r.time, COALESCE(c.duration,30) AS duration FROM booking_reservations r LEFT JOIN booking_courses c ON c.id::text = r.course_id AND c.shop_id = r.shop_id WHERE r.shop_id=${shopId} AND r.date=${date} AND r.status != 'cancelled'`);
          const slotCount = new Map<string,number>();
          for (const r of reservations) { const [rh,rm]=(r.time as string).split(":").map(Number); const rStart=rh*60+rm; const rEnd=rStart+(parseInt(r.duration,10)||30); for (const slot of allSlots) { const [sh,sm]=slot.split(":").map(Number); const sStart=sh*60+sm; if (rStart<sStart+30&&rEnd>sStart) slotCount.set(slot,(slotCount.get(slot)||0)+1); } }
          res.json(allSlots.map(slot => { const [sh,sm]=slot.split(":").map(Number); const sStart=sh*60+sm; if (sStart+courseDuration>19*60) return {time:slot,available:false}; let max=0; for(let i=0;i<slotsNeeded;i++){const cm=sStart+i*30;const cs=`${String(Math.floor(cm/60)).padStart(2,"0")}:${String(cm%60).padStart(2,"0")}`;max=Math.max(max,slotCount.get(cs)||0);} return {time:slot,available:max<tableCount}; }));
        } catch (e: any) { console.error("slots error:", e); res.status(500).json({ message: "Failed to fetch slots" }); }
      });
      app.put("/api/shops/:shopId/slots", async (_req, res) => res.json({ ok: true }));
      app.post("/api/shops/:shopId/slots", async (_req, res) => res.json({ ok: true }));

      // ─── 設定 ───
      app.get("/api/shops/:shopId/settings", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
        try {
          await seedShopIfEmpty(shopId);
          const cnt = await sql`SELECT COUNT(*) as cnt FROM booking_settings WHERE shop_id=${shopId}`;
          if (parseInt(cnt[0]?.cnt||"0")>0) { const rows = await sql`SELECT * FROM booking_settings WHERE shop_id=${shopId}`; const s=rows[0]; return res.json({store_name:s.store_name||"",store_description:s.store_description||"",store_address:s.store_address||"",store_phone:s.store_phone||"",store_email:s.store_email||"",store_hours:s.store_hours||"",store_closed_days:s.store_closed_days||"",banner_url:s.banner_url||"",staff_selection_enabled:s.staff_selection_enabled||"false",table_count:s.table_count!=null?String(s.table_count):"0",max_party_size:s.max_party_size!=null?String(s.max_party_size):"0"}); }
          const shopRows = await sql`SELECT * FROM shops WHERE id=${shopId}`; if (!shopRows[0]) return res.status(404).json({message:"Shop not found"});
          const s=shopRows[0]; res.json({store_name:s.name||"",store_description:s.description||"",store_address:s.address||"",store_phone:s.phone||"",store_email:"",store_hours:s.hours||"",store_closed_days:s.closed_days||"",banner_url:s.image_url||"",staff_selection_enabled:s.enable_staff_assignment?"true":"false"});
        } catch (e: any) { console.error("settings error:", e); res.status(500).json({message:"Failed to fetch settings"}); }
      });
      app.put("/api/shops/:shopId/settings", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({message:"Invalid shop ID"});
        try {
          const s=req.body; const tc=parseInt(s.table_count||"0",10)||0; const mp=parseInt(s.max_party_size||"0",10)||0;
          await sql`INSERT INTO booking_settings (shop_id,store_name,store_description,store_address,store_phone,store_email,store_hours,store_closed_days,banner_url,staff_selection_enabled,table_count,max_party_size,updated_at) VALUES (${shopId},${s.store_name||""},${s.store_description||""},${s.store_address||""},${s.store_phone||""},${s.store_email||""},${s.store_hours||""},${s.store_closed_days||""},${s.banner_url||""},${s.staff_selection_enabled||"false"},${tc},${mp},NOW()) ON CONFLICT (shop_id) DO UPDATE SET store_name=${s.store_name||""},store_description=${s.store_description||""},store_address=${s.store_address||""},store_phone=${s.store_phone||""},store_email=${s.store_email||""},store_hours=${s.store_hours||""},store_closed_days=${s.store_closed_days||""},banner_url=${s.banner_url||""},staff_selection_enabled=${s.staff_selection_enabled||"false"},table_count=${tc},max_party_size=${mp},updated_at=NOW()`;
          res.json(s);
        } catch { res.status(500).json({message:"Failed to update settings"}); }
      });

      // ─── 予約 ───
      app.get("/api/shops/:shopId/reservations", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({message:"Invalid shop ID"});
        try { res.json((await safeQuery(()=>sql`SELECT * FROM booking_reservations WHERE shop_id=${shopId} ORDER BY date DESC, time DESC`)).map(toReservation)); }
        catch { res.status(500).json({message:"Failed to fetch reservations"}); }
      });
      app.post("/api/shops/:shopId/reservations", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({message:"Invalid shop ID"});
        try {
          const {customerName,customerPhone,customerEmail,date,time,staffId,courseId}=req.body;
          if (!customerName||!date||!time||!courseId) return res.status(400).json({message:"Missing required fields"});
          const token=crypto.randomUUID().replace(/-/g,"");
          await sql`INSERT INTO booking_reservations (shop_id,customer_name,customer_phone,customer_email,date,time,staff_id,course_id,status,paid,cancel_token) VALUES (${shopId},${customerName},${customerPhone||null},${customerEmail||null},${date},${time},${staffId||"__shop__"},${courseId.toString()},'confirmed',false,${token})`;
          const rows=await sql`SELECT * FROM booking_reservations WHERE cancel_token = ${token}`;
          if (!rows[0]) return res.status(500).json({message:"Failed to create reservation"});
          res.status(201).json(toReservation(rows[0]));
        } catch (e: any) { console.error("reservation error:", e); res.status(500).json({message:"Failed to create reservation"}); }
      });
      app.put("/api/shops/:shopId/reservations", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({message:"Invalid shop ID"});
        try {
          const {id,status,paid,customerName,customerPhone,customerEmail,date,time}=req.body;
          const resId=parseInt(id); if (isNaN(resId)) return res.status(400).json({message:"Invalid reservation ID"});
          if (status!==undefined) await sql`UPDATE booking_reservations SET status=${status} WHERE id=${resId} AND shop_id=${shopId}`;
          if (paid!==undefined) await sql`UPDATE booking_reservations SET paid=${paid} WHERE id=${resId} AND shop_id=${shopId}`;
          if (customerName!==undefined) await sql`UPDATE booking_reservations SET customer_name=${customerName} WHERE id=${resId} AND shop_id=${shopId}`;
          if (customerPhone!==undefined) await sql`UPDATE booking_reservations SET customer_phone=${customerPhone} WHERE id=${resId} AND shop_id=${shopId}`;
          if (customerEmail!==undefined) await sql`UPDATE booking_reservations SET customer_email=${customerEmail} WHERE id=${resId} AND shop_id=${shopId}`;
          if (date!==undefined) await sql`UPDATE booking_reservations SET date=${date} WHERE id=${resId} AND shop_id=${shopId}`;
          if (time!==undefined) await sql`UPDATE booking_reservations SET time=${time} WHERE id=${resId} AND shop_id=${shopId}`;
          const rows=await sql`SELECT * FROM booking_reservations WHERE id=${resId} AND shop_id=${shopId}`;
          if (!rows[0]) return res.status(404).json({message:"Reservation not found"});
          res.json(toReservation(rows[0]));
        } catch (e: any) { console.error("res update error:", e); res.status(500).json({message:"Failed to update reservation"}); }
      });
      app.delete("/api/shops/:shopId/reservations", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({message:"Invalid shop ID"});
        try { await sql`DELETE FROM booking_reservations WHERE id=${parseInt(req.query.id as string)} AND shop_id=${shopId}`; res.json({message:"Reservation deleted"}); }
        catch { res.status(500).json({message:"Failed to delete reservation"}); }
      });

      // ─── キャンセル ───
      app.get("/api/shops/:shopId/cancel/:token", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({message:"Invalid shop ID"});
        try {
          const cnt=await sql`SELECT COUNT(*) as cnt FROM booking_reservations WHERE cancel_token=${req.params.token} AND shop_id=${shopId}`;
          if (parseInt(cnt[0]?.cnt||"0")===0) return res.status(404).json({message:"Reservation not found"});
          const rows=await sql`SELECT r.*, c.name as course_name, c.duration as course_duration, c.price as course_price FROM booking_reservations r LEFT JOIN booking_courses c ON c.id::text = r.course_id AND c.shop_id = ${shopId} WHERE r.cancel_token=${req.params.token} AND r.shop_id=${shopId}`;
          if (!rows[0]) return res.status(404).json({message:"Reservation not found"});
          const r=rows[0]; res.json({id:r.id.toString(),customerName:r.customer_name,date:r.date,time:r.time,courseId:r.course_id,courseName:r.course_name||"コース",courseDuration:r.course_duration||60,coursePrice:r.course_price||0,status:r.status});
        } catch { res.status(500).json({message:"Failed to fetch reservation"}); }
      });
      app.post("/api/shops/:shopId/cancel/:token", async (req, res) => {
        const shopId = parseInt(req.params.shopId); if (isNaN(shopId)) return res.status(400).json({message:"Invalid shop ID"});
        try {
          const cnt=await sql`SELECT COUNT(*) as cnt FROM booking_reservations WHERE cancel_token=${req.params.token} AND shop_id=${shopId}`;
          if (parseInt(cnt[0]?.cnt||"0")===0) return res.status(404).json({message:"Reservation not found"});
          const rows=await sql`SELECT status FROM booking_reservations WHERE cancel_token=${req.params.token} AND shop_id=${shopId}`;
          if (rows[0]?.status==="cancelled") return res.json({ok:true,already:true});
          await sql`UPDATE booking_reservations SET status='cancelled' WHERE cancel_token=${req.params.token} AND shop_id=${shopId}`;
          res.json({ok:true});
        } catch { res.status(500).json({message:"Failed to cancel reservation"}); }
      });

      // ─── 問い合わせ ───
      app.post("/api/shops/:shopId/inquiries", async (_req, res) => res.status(201).json({ok:true}));
      app.get("/api/shops/:shopId/inquiries", async (_req, res) => res.json([]));

      // ─── Stripe ───
      app.get("/api/stripe/config", async (_req, res) => { try { res.json({publishableKey:await getStripePublishableKeyValue()}); } catch { res.json({publishableKey:""}); } });
      app.get("/api/stripe/connect/status/:shopId", async (req, res) => {
        try {
          const shopId=parseInt(req.params.shopId);
          const rows=await sql`SELECT id,name,stripe_connect_id,stripe_connect_status FROM shops WHERE id=${shopId}`;
          if (!rows.length) return res.status(404).json({error:"Shop not found"});
          const shop=rows[0]; if (!shop.stripe_connect_id) return res.json({shopId,accountId:null,status:"none",connected:false});
          try {
            const stripe=await getStripeClient(); const account=await stripe.accounts.retrieve(shop.stripe_connect_id);
            const newStatus=(account.capabilities?.transfers==="active"&&account.capabilities?.card_payments==="active")?"active":"pending";
            if (newStatus!==shop.stripe_connect_status) await sql`UPDATE shops SET stripe_connect_status=${newStatus} WHERE id=${shopId}`;
            return res.json({shopId,accountId:shop.stripe_connect_id,status:newStatus,connected:newStatus==="active",chargesEnabled:account.charges_enabled,payoutsEnabled:account.payouts_enabled,detailsSubmitted:account.details_submitted});
          } catch { return res.json({shopId,accountId:shop.stripe_connect_id,status:shop.stripe_connect_status||"pending",connected:shop.stripe_connect_status==="active"}); }
        } catch (e: any) { res.status(500).json({error:e.message}); }
      });
      app.post("/api/stripe/connect/payment-intent", async (req, res) => {
        try {
          const {shopId,amount,courseId,courseName}=req.body; if (!shopId||!amount) return res.status(400).json({error:"shopId and amount required"});
          const rows=await sql`SELECT id,name,stripe_connect_id FROM shops WHERE id=${shopId}`;
          if (!rows.length) return res.status(404).json({error:"Shop not found"});
          const shop=rows[0]; if (!shop.stripe_connect_id) return res.status(400).json({error:"この店舗はStripe Connect未設定です"});
          const stripe=await getStripeClient();
          let pi; try { pi=await stripe.paymentIntents.create({amount:Math.round(amount),currency:"jpy",payment_method_types:["card"],description:courseName||"コース予約",on_behalf_of:shop.stripe_connect_id,transfer_data:{destination:shop.stripe_connect_id},metadata:{shop_id:String(shopId),shop_name:shop.name,course_id:courseId||"",course_name:courseName||""}}); }
          catch (ce: any) { console.warn("Stripe Connect fallback:",ce.code); pi=await stripe.paymentIntents.create({amount:Math.round(amount),currency:"jpy",payment_method_types:["card"],description:courseName||"コース予約",metadata:{shop_id:String(shopId),shop_name:shop.name,course_id:courseId||"",course_name:courseName||"",note:"pending_onboarding_fallback"}}); }
          res.json({clientSecret:pi.client_secret});
        } catch (e: any) { console.error("PaymentIntent error:",e.message); res.status(500).json({error:e.message}); }
      });
      app.post("/api/stripe/connect/onboard/:shopId", async (req, res) => {
        try {
          const shopId=req.params.shopId;
          const rows=await sql`SELECT id,name,stripe_connect_id FROM shops WHERE id=${shopId}`;
          if (!rows.length) return res.status(404).json({error:"Shop not found"});
          const shop=rows[0]; const stripe=await getStripeClient(); let accountId=shop.stripe_connect_id;
          if (!accountId) { const account=await stripe.accounts.create({type:"express",country:"JP",capabilities:{card_payments:{requested:true},transfers:{requested:true}}}); accountId=account.id; await sql`UPDATE shops SET stripe_connect_id=${accountId},stripe_connect_status='pending' WHERE id=${shopId}`; }
          else { await stripe.accounts.update(accountId,{capabilities:{card_payments:{requested:true},transfers:{requested:true}}}); }
          const domain=process.env.VERCEL_URL?`https://${process.env.VERCEL_URL}`:(process.env.APP_URL||"https://linemini-reserve-app.vercel.app");
          const link=await stripe.accountLinks.create({account:accountId,refresh_url:`${domain}/admin/shop/${shopId}`,return_url:`${domain}/admin/shop/${shopId}`,type:"account_onboarding"});
          res.json({url:link.url});
        } catch (e: any) { console.error("Onboard error:",e.message); res.status(500).json({error:e.message}); }
      });
      app.post("/api/stripe/connect/dashboard/:shopId", async (req, res) => {
        try {
          const shopId=req.params.shopId;
          const rows=await sql`SELECT id,stripe_connect_id FROM shops WHERE id=${shopId}`;
          if (!rows.length||!rows[0].stripe_connect_id) return res.status(400).json({error:"Stripe未連携です"});
          const stripe=await getStripeClient(); const loginLink=await stripe.accounts.createLoginLink(rows[0].stripe_connect_id);
          res.json({url:loginLink.url});
        } catch (e: any) { console.error("Dashboard error:",e.message); res.status(500).json({error:e.message}); }
      });

      // ─── メンテナンス用 ───
      app.post("/api/fix-stripe-accounts", async (_req, res) => {
        try {
          await sql`UPDATE shops SET stripe_connect_id='acct_1TEsH7DJNIHpMLg5',stripe_connect_status='active' WHERE id=6`;
          await sql`UPDATE shops SET stripe_connect_id='acct_1TEsHBDOMXLg7N59',stripe_connect_status='active' WHERE id=14`;
          res.json({ok:true,updated:await sql`SELECT id,name,stripe_connect_id,stripe_connect_status FROM shops WHERE stripe_connect_id IS NOT NULL`});
        } catch (e: any) { res.status(500).json({error:e.message}); }
      });
      app.post("/api/fix-subcategory-slugs", async (_req, res) => {
        try {
          const subcatMap: Record<string,string>={...{"寿司・和食":"sushi","寿司・海鮮":"sushi","和食":"washoku","洋食":"yoshoku","中華":"chuka","イタリアン":"italian","居酒屋":"izakaya","居酒屋・和食":"izakaya","カフェ":"cafe","ラーメン":"ramen","焼肉":"washoku","パン・スイーツ":"sweets","和菓子":"sweets","スイーツ":"sweets","ヘアサロン":"hair","エステ":"esthe","ネイル":"nail","マッサージ":"massage","整体":"massage","整骨・整体":"massage","マッサージ・整体":"massage","トータルビューティー":"other","フィットネス":"fitness","温泉・スパ":"onsen","スパ":"onsen","アウトドア":"outdoor","体験・教室":"experience","スポーツジム":"experience","観光スポット":"sightseeing","ファッション":"fashion","雑貨":"goods","食料品":"food","食料品・惣菜":"food","修理":"repair","修理・メンテナンス":"repair","教室・スクール":"school","病院・クリニック":"clinic","歯科":"dental"}};
          let updated=0; const shops=await sql`SELECT id,name,subcategory FROM shops`;
          for (const shop of shops) { const cur=shop.subcategory; if(!cur||cur==="null"){await sql`UPDATE shops SET subcategory=NULL WHERE id=${shop.id}`;updated++;continue;} const ns=subcatMap[cur]; if(ns&&ns!==cur){await sql`UPDATE shops SET subcategory=${ns} WHERE id=${shop.id}`;updated++;} }
          res.json({ok:true,updated,shops:await sql`SELECT id,name,category,subcategory FROM shops ORDER BY id`});
        } catch (e: any) { res.status(500).json({message:"Fix subcategory slugs failed",error:e.message}); }
      });
      app.post("/api/fix-shop-slugs", async (_req, res) => {
        try {
          const areaMap: Record<string,string>={"小田原":"odawara","大和":"yamato","秦野":"hadano","平塚":"hiratsuka","厚木":"atsugi","海老名":"ebina","伊勢原":"isehara","茅ヶ崎":"chigasaki","藤沢":"fujisawa","鎌倉":"kamakura","横浜":"yokohama","二宮":"ninomiya"};
          const categoryMap: Record<string,string>={"グルメ":"gourmet","美容":"beauty","美容・健康":"beauty","ショッピング":"shopping","レジャー":"leisure","レジャー・体験":"leisure","サービス":"service","医療":"medical","医療・福祉":"medical"};
          let updated=0; const shops=await sql`SELECT id,area,category FROM shops`;
          for (const shop of shops) { const na=areaMap[shop.area]||shop.area; const nc=categoryMap[shop.category]||shop.category; if(na!==shop.area||nc!==shop.category){await sql`UPDATE shops SET area=${na},category=${nc} WHERE id=${shop.id}`;updated++;} }
          res.json({ok:true,updated,shops:await sql`SELECT id,name,area,category FROM shops ORDER BY id`});
        } catch (e: any) { res.status(500).json({message:"Fix slugs failed",error:e.message}); }
      });

      // ─── テスト・シード ───
      app.post("/api/seed-test", async (_req, res) => {
        try {
          const existing=await sql`SELECT id FROM shops WHERE slug='test-salon-hanagokoro'`; let shopId: number;
          if (existing.length>0) { shopId=existing[0].id; await sql`DELETE FROM booking_courses WHERE shop_id=${shopId}`; await sql`DELETE FROM booking_staff WHERE shop_id=${shopId}`; await sql`DELETE FROM booking_settings WHERE shop_id=${shopId}`; await sql`DELETE FROM booking_reservations WHERE shop_id=${shopId}`; await sql`DELETE FROM coupons WHERE shop_id=${shopId}`; }
          else {
            await sql`INSERT INTO shops (slug,name,description,area_id,area,category,subcategory,address,phone,hours,closed_days,website,display_order,line_account_url,image_url,gallery_image_urls,is_active,enable_staff_assignment,like_count) VALUES ('test-salon-hanagokoro','総合サロン はなごころ','小田原駅徒歩5分。ヘア・エステ・ネイル・リラクゼーションを一か所で。完全予約制の上質な空間。',1,'小田原','美容','トータルビューティー','神奈川県小田原市南町2-3-15 はなごころビル2F','0465-33-8899','10:00〜20:00（最終受付 19:00）','毎週火曜日・第1月曜日','https://salon-hanagokoro.jp',99,'https://line.me/R/ti/p/@salon-hanagokoro','https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',ARRAY['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80','https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80','https://images.unsplash.com/photo-1573461160327-a85cf5a11ad5?w=800&q=80'],true,true,56)`;
            const sr=await sql`SELECT id FROM shops WHERE slug='test-salon-hanagokoro'`; shopId=sr[0].id;
          }
          await sql`UPDATE shops SET reservation_url='/app/reservation/'||${shopId}::text WHERE id=${shopId}`;
          res.json({ok:true,shopId});
        } catch (e: any) { console.error("seed-test error:", e); res.status(500).json({message:"Seed test failed",error:e.message}); }
      });
      app.post("/api/seed-shops", async (_req, res) => {
        try { const total=await sql`SELECT COUNT(*) as cnt FROM shops`; res.json({ok:true,total:parseInt(total[0].cnt),message:"Use /api/seed-test for individual shop seeding"}); }
        catch (e: any) { res.status(500).json({message:"Seed shops failed",error:e.message}); }
      });

      // エラーハンドラー
      app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
        const status = err.status || err.statusCode || 500;
        const message = err.message || "Internal Server Error";
        console.error("Internal Server Error:", err);
        if (res.headersSent) return next(err);
        return res.status(status).json({ message });
      });
    })();
  }
  return _setup;
}

// Vercel serverless handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  await ensureSetup();
  return app(req as any, res as any);
}
