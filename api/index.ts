import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq, desc, inArray } from "drizzle-orm";
import {
  pgTable, pgEnum, text, integer, serial,
  boolean, timestamp, uniqueIndex
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { nanoid } from "nanoid";
import crypto from "crypto";
import { randomBytes } from "crypto";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";

// シンプルなSHA256ハッシュ関数
function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

// ─────────────────────────────
// DB接続
// ─────────────────────────────
const sql = neon(process.env.DATABASE_URL!);

// ─────────────────────────────
// スキーマ定義（インライン）
// ─────────────────────────────
const userRoleEnum = pgEnum("user_role", ["admin", "shop_admin"]);
const discountTypeEnum = pgEnum("discount_type", ["AMOUNT", "PERCENTAGE", "FREE"]);
const reservationStatusEnum = pgEnum("reservation_status", ["PENDING", "CONFIRMED", "CANCELLED", "VISITED"]);

const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: userRoleEnum("role").notNull().default("shop_admin"),
  shopId: integer("shop_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

const areas = pgTable("areas", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  label: text("label").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  icon: text("icon").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const shops = pgTable("shops", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug: text("slug").notNull().unique(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  areaId: integer("area_id").notNull(),
  area: text("area").notNull().default(""),
  category: text("category").notNull().default(""),
  subcategory: text("subcategory"),
  address: text("address").notNull(),
  phone: text("phone"),
  hours: text("hours"),
  closedDays: text("closed_days"),
  website: text("website"),
  displayOrder: integer("display_order").notNull().default(0),
  lineAccountUrl: text("line_account_url"),
  imageUrl: text("image_url").notNull(),
  galleryImageUrls: text("gallery_image_urls").array(),
  isActive: boolean("is_active").notNull().default(true),
  enableStaffAssignment: boolean("enable_staff_assignment").notNull().default(false),
  reservationUrl: text("reservation_url"),
  reservationImageUrl: text("reservation_image_url"),
  likeCount: integer("like_count").notNull().default(0),
  stripeConnectId: text("stripe_connect_id"),
  stripeConnectStatus: text("stripe_connect_status").default("none"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

const coupons = pgTable("coupons", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shopId: integer("shop_id").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  discount: text("discount"),
  discountType: discountTypeEnum("discount_type").notNull().default("FREE"),
  discountValue: integer("discount_value").notNull().default(0),
  validFrom: timestamp("valid_from"),
  validUntil: timestamp("valid_until"),
  expiryDate: text("expiry_date"),
  isFirstTimeOnly: boolean("is_first_time_only").notNull().default(false),
  isLineAccountCoupon: boolean("is_line_account_coupon").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const shopCategories = pgTable("shop_categories", {
  shopId: integer("shop_id").notNull(),
  categoryId: integer("category_id").notNull(),
}, (t) => [
  uniqueIndex("shop_categories_idx").on(t.shopId, t.categoryId),
]);

const insertShopSchema = createInsertSchema(shops).omit({ id: true });
const insertCouponSchema = createInsertSchema(coupons).omit({ id: true });

const db = drizzle(sql, { 
  schema: { users, areas, categories, shops, coupons, shopCategories } 
});

// ─────────────────────────────
// Express設定
// ─────────────────────────────
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// ─────────────────────────────
// エリア
// ─────────────────────────────
app.get("/api/areas", async (_req, res) => {
  try {
    const result = await db.select().from(areas);
    res.json(result);
  } catch (error) {
    console.error("Error fetching areas:", error);
    res.status(500).json({ message: "Failed to fetch areas" });
  }
});

// ─────────────────────────────
// カテゴリ
// ─────────────────────────────
app.get("/api/categories", async (_req, res) => {
  try {
    const result = await db.select().from(categories);
    res.json(result);
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
});

// ─────────────────────────────
// 店舗
// ─────────────────────────────
app.get("/api/shops", async (req, res) => {
  try {
    const { areaId, categoryId } = req.query;
    let result;
    if (areaId) {
      result = await db.select().from(shops)
        .where(eq(shops.areaId, parseInt(areaId as string)))
        .orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
    } else if (categoryId) {
      const shopCategoryRows = await db.select()
        .from(shopCategories)
        .where(eq(shopCategories.categoryId, parseInt(categoryId as string)));
      const shopIds = shopCategoryRows.map(r => r.shopId);
      if (shopIds.length === 0) {
        return res.json([]);
      }
      result = await db.select().from(shops)
        .where(inArray(shops.id, shopIds))
        .orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
    } else {
      result = await db.select().from(shops)
        .orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
    }
    res.json(result);
  } catch (error) {
    console.error("Error fetching shops:", error);
    res.status(500).json({ message: "Failed to fetch shops" });
  }
});

app.post("/api/shops", async (req, res) => {
  try {
    const body = req.body;
    let areaId = body.areaId;
    if (!areaId && body.area) {
      const allAreas = await db.select().from(areas);
      const found = allAreas.find((a) => a.slug === body.area);
      if (found) areaId = found.id;
    }
    const parsed = insertShopSchema.safeParse({
      displayOrder: 0,
      slug: nanoid(10),
      ...body,
      areaId: areaId ?? body.areaId,
    });
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
    }
    const [shop] = await db.insert(shops).values(parsed.data).returning();
    res.status(201).json(shop);
  } catch (error) {
    console.error("Error creating shop:", error);
    res.status(500).json({ message: "Failed to create shop" });
  }
});

app.get("/api/shops/slug/:slug", async (req, res) => {
  try {
    const [shop] = await db.select().from(shops).where(eq(shops.slug, req.params.slug));
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json(shop);
  } catch (error) {
    console.error("Error fetching shop:", error);
    res.status(500).json({ message: "Failed to fetch shop" });
  }
});

app.get("/api/shops/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }
    const [shop] = await db.select().from(shops).where(eq(shops.id, id));
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json(shop);
  } catch (error) {
    console.error("Error fetching shop:", error);
    res.status(500).json({ message: "Failed to fetch shop" });
  }
});

app.put("/api/shops/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }
    const partial = insertShopSchema.partial().safeParse(req.body);
    if (!partial.success) {
      return res.status(400).json({ message: "Invalid request body", errors: partial.error.errors });
    }
    const [shop] = await db.update(shops)
      .set({ ...partial.data, updatedAt: new Date() })
      .where(eq(shops.id, id))
      .returning();
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    res.json(shop);
  } catch (error) {
    console.error("Error updating shop:", error);
    res.status(500).json({ message: "Failed to update shop" });
  }
});

app.post("/api/shops/:id/like", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }
    const [shop] = await db.select().from(shops).where(eq(shops.id, id));
    if (!shop) {
      return res.status(404).json({ message: "Shop not found" });
    }
    const [updated] = await db.update(shops)
      .set({ likeCount: shop.likeCount + 1 })
      .where(eq(shops.id, id))
      .returning();
    res.json({ likeCount: updated?.likeCount });
  } catch (error) {
    console.error("Error liking shop:", error);
    res.status(500).json({ message: "Failed to like shop" });
  }
});

// ─────────────────────────────
// クーポン
// ─────────────────────────────
app.get("/api/shops/:id/coupons", async (req, res) => {
  try {
    const shopId = parseInt(req.params.id);
    if (isNaN(shopId)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }
    const result = await db.select().from(coupons)
      .where(eq(coupons.shopId, shopId))
      .orderBy(desc(coupons.updatedAt));
    res.json(result);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
});

app.post("/api/shops/:id/coupons", async (req, res) => {
  try {
    const shopId = parseInt(req.params.id);
    if (isNaN(shopId)) {
      return res.status(400).json({ message: "Invalid shop ID" });
    }
    const parsed = insertCouponSchema.omit({ shopId: true }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
    }
    const [coupon] = await db.insert(coupons).values({ ...parsed.data, shopId }).returning();
    res.status(201).json(coupon);
  } catch (error) {
    console.error("Error creating coupon:", error);
    res.status(500).json({ message: "Failed to create coupon" });
  }
});

app.get("/api/coupons", async (_req, res) => {
  try {
    const result = await db.select().from(coupons).orderBy(desc(coupons.updatedAt));
    res.json(result);
  } catch (error) {
    console.error("Error fetching coupons:", error);
    res.status(500).json({ message: "Failed to fetch coupons" });
  }
});

app.put("/api/coupons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid coupon ID" });
    }
    const partial = insertCouponSchema.partial().safeParse(req.body);
    if (!partial.success) {
      return res.status(400).json({ message: "Invalid request body", errors: partial.error.errors });
    }
    const [coupon] = await db.update(coupons)
      .set({ ...partial.data, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    if (!coupon) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    res.json(coupon);
  } catch (error) {
    console.error("Error updating coupon:", error);
    res.status(500).json({ message: "Failed to update coupon" });
  }
});

app.delete("/api/coupons/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ message: "Invalid coupon ID" });
    }
    const result = await db.delete(coupons).where(eq(coupons.id, id)).returning();
    if (result.length === 0) {
      return res.status(404).json({ message: "Coupon not found" });
    }
    res.json({ message: "Coupon deleted" });
  } catch (error) {
    console.error("Error deleting coupon:", error);
    res.status(500).json({ message: "Failed to delete coupon" });
  }
});

// ─────────────────────────────
// 認証 (JWT)
// ─────────────────────────────
app.post("/api/auth/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log("[v0] Login attempt:", { username, password });
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    const [user] = await db.select().from(users).where(eq(users.username, username));
    console.log("[v0] User found:", user ? { id: user.id, username: user.username, passwordHash: user.passwordHash } : "null");
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    // プレーンテキスト比較（ハッシュかプレーンテキストどちらでも対応）
    const plainMatch = user.passwordHash === password;
    const hashMatch = hashPassword(password) === user.passwordHash;
    console.log("[v0] Password comparison:", { plainMatch, hashMatch, inputPassword: password, storedHash: user.passwordHash, inputHashed: hashPassword(password) });
    const valid = plainMatch || hashMatch;
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    // JWTトークン生成 (シンプルなBase64エンコード)
    const payload = { userId: user.id, role: user.role, shopId: user.shopId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    const token = Buffer.from(JSON.stringify(payload)).toString("base64");
    res.json({ 
      id: user.id, 
      username: user.username, 
      role: user.role, 
      shopId: user.shopId,
      token 
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/auth/logout", (_req, res) => {
  // JWTはステートレスなのでサーバー側で何もしない
  res.json({ message: "Logged out" });
});

app.get("/api/auth/me", async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64").toString()) as { userId: number; role: string; shopId: number | null; exp: number };
    if (decoded.exp < Date.now()) {
      return res.status(401).json({ message: "Token expired" });
    }
    const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
    if (!user) {
      return res.status(401).json({ message: "User not found" });
    }
    res.json({ id: user.id, username: user.username, role: user.role, shopId: user.shopId });
  } catch (error) {
    console.error("Error verifying token:", error);
    res.status(401).json({ message: "Invalid token" });
  }
});

// ─────────────────────────────
// 予約システム（In-Memory + DB設定永続化）
// ─────────────────────────────

interface Staff { id: string; name: string; role: string; avatar: string; courseIds: string[]; }
interface Course { id: string; name: string; category: string; duration: number; price: number; description: string; prepaymentOnly: boolean; imageUrl: string | null; staffIds: string[]; }
interface Reservation { id: string; customerName: string; customerPhone?: string; customerEmail?: string; date: string; time: string; staffId: string; courseId: string; status: "confirmed" | "pending" | "cancelled"; paid: boolean; partySize?: number; reservationToken?: string; cancelledAt?: string; }
interface SlotEntry { id: string; staffId: string; dayOfWeek: number; time: string; available: boolean; }
interface InquiryEntry { id: string; name: string; email?: string; phone?: string; message: string; createdAt: string; }

interface ShopBookingData { staff: Staff[]; courses: Course[]; reservations: Reservation[]; settings: Record<string, string>; }

const BOOKING_DATA: Record<number, ShopBookingData> = {
  1: {
    staff: [
      { id: "s1-1", name: "山田 店長", role: "店長", avatar: "山店", courseIds: ["c1-1", "c1-2", "c1-3"] },
      { id: "s1-2", name: "鈴木 副店長", role: "副店長", avatar: "鈴副", courseIds: ["c1-1", "c1-2"] },
    ],
    courses: [
      { id: "c1-1", name: "醤油ラーメン定食コース", category: "ラーメン", duration: 60, price: 0, description: "自家製麺の醤油ラーメン＋ライス＋餃子3個", prepaymentOnly: false, imageUrl: null, staffIds: ["s1-1", "s1-2"] },
      { id: "c1-2", name: "つけ麺コース", category: "つけ麺", duration: 60, price: 0, description: "濃厚つけダレで食べる特製つけ麺", prepaymentOnly: false, imageUrl: null, staffIds: ["s1-1", "s1-2"] },
      { id: "c1-3", name: "プレミアムコース", category: "特別", duration: 90, price: 3800, description: "特製ラーメン＋全品コース。事前決済限定", prepaymentOnly: true, imageUrl: null, staffIds: ["s1-1"] },
    ],
    reservations: [
      { id: "r1-1", customerName: "田中 太郎", date: "2026-03-10", time: "12:00", staffId: "__shop__", courseId: "c1-1", status: "confirmed", paid: false },
      { id: "r1-2", customerName: "佐藤 花子", date: "2026-03-10", time: "12:00", staffId: "__shop__", courseId: "c1-2", status: "confirmed", paid: false },
    ],
    settings: { store_name: "小田原屋ラーメン", store_description: "自家製麺と厳選スープのこだわりラーメン店", store_address: "神奈川県小田原市栄町2-1-5", store_phone: "0465-22-1234", store_email: "info@odawaraya.jp", store_hours: "11:00〜22:00（L.O. 21:30）", store_closed_days: "毎週水曜日", banner_url: "", staff_selection_enabled: "false", table_count: "5", max_party_size: "6" },
  },
  3: {
    staff: [
      { id: "s3-1", name: "田中 美咲", role: "オーナースタイリスト", avatar: "田美", courseIds: ["c3-1", "c3-2", "c3-3", "c3-4"] },
      { id: "s3-2", name: "佐藤 優花", role: "シニアスタイリスト", avatar: "佐優", courseIds: ["c3-1", "c3-2", "c3-3"] },
      { id: "s3-3", name: "山本 凛", role: "スタイリスト", avatar: "山凛", courseIds: ["c3-1", "c3-2"] },
    ],
    courses: [
      { id: "c3-1", name: "カット", category: "カット", duration: 60, price: 6600, description: "シャンプー・ブロー込みのカット", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1", "s3-2", "s3-3"] },
      { id: "c3-2", name: "カット＋カラー", category: "カラー", duration: 120, price: 14300, description: "カット＋フルカラー（シャンプー・ブロー込み）", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1", "s3-2", "s3-3"] },
      { id: "c3-3", name: "カット＋パーマ", category: "パーマ", duration: 150, price: 16500, description: "カット＋デジタルパーマ", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1", "s3-2"] },
      { id: "c3-4", name: "トリートメント", category: "トリートメント", duration: 60, price: 5500, description: "集中ケアトリートメント", prepaymentOnly: false, imageUrl: null, staffIds: ["s3-1"] },
    ],
    reservations: [
      { id: "r3-1", customerName: "伊藤 七海", date: "2026-03-10", time: "10:00", staffId: "s3-1", courseId: "c3-2", status: "confirmed", paid: false },
    ],
    settings: { store_name: "Hair Salon MIKU", store_description: "大和市の人気ヘアサロン", store_address: "神奈川県大和市大和東1-2-3", store_phone: "046-260-1234", store_email: "info@salon-miku.jp", store_hours: "10:00〜19:00", store_closed_days: "毎週火曜日", banner_url: "", staff_selection_enabled: "true" },
  },
  6: {
    staff: [
      { id: "s6-1", name: "小林 大将", role: "大将（板前）", avatar: "小大", courseIds: ["c6-1", "c6-2", "c6-3"] },
      { id: "s6-2", name: "加藤 職人", role: "二番手", avatar: "加職", courseIds: ["c6-1", "c6-2"] },
    ],
    courses: [
      { id: "c6-1", name: "おまかせ握りコース", category: "寿司", duration: 90, price: 8800, description: "旬のネタを大将が厳選。握り10貫＋お椀＋デザート。", prepaymentOnly: true, imageUrl: null, staffIds: ["s6-1", "s6-2"] },
      { id: "c6-2", name: "特上握りコース", category: "寿司", duration: 120, price: 15800, description: "最高級ネタの特上握り15貫＋前菜3種＋お椀＋デザート。", prepaymentOnly: true, imageUrl: null, staffIds: ["s6-1", "s6-2"] },
      { id: "c6-3", name: "カウンター席予約", category: "席予約", duration: 60, price: 0, description: "カウンター席の予約。お料理は当日注文。", prepaymentOnly: false, imageUrl: null, staffIds: ["s6-1"] },
    ],
    reservations: [],
    settings: { store_name: "鮨処 匠", store_description: "小田原の新鮮な魚介を職人技で握る本格寿司店", store_address: "神奈川県小田原市本町1-8-12", store_phone: "0465-34-5678", store_email: "info@sushi-takumi.jp", store_hours: "11:30〜14:00 / 17:00〜22:00", store_closed_days: "毎週月曜日", banner_url: "", staff_selection_enabled: "true" },
  },
};

class BookingStore {
  staff: Staff[];
  courses: Course[];
  reservations: Reservation[];
  slots: SlotEntry[];
  settings: Record<string, string>;
  inquiries: InquiryEntry[];
  private nextId = 100;

  constructor(data: ShopBookingData) {
    this.staff = JSON.parse(JSON.stringify(data.staff));
    this.courses = JSON.parse(JSON.stringify(data.courses));
    this.reservations = JSON.parse(JSON.stringify(data.reservations));
    this.settings = { ...data.settings };
    this.slots = [];
    this.inquiries = [];
  }

  genId() { return String(this.nextId++); }
  genToken() { return randomBytes(32).toString("hex"); }

  private getBlockedSlots(staffId: string, date: string): Set<string> {
    const blocked = new Set<string>();
    for (const r of this.reservations.filter(r => r.date === date && r.staffId === staffId && r.status !== "cancelled")) {
      const course = this.courses.find(c => c.id === r.courseId);
      const duration = course?.duration ?? 30;
      const [rh, rm] = r.time.split(":").map(Number);
      let totalMin = rh * 60 + rm;
      for (let i = 0; i < Math.ceil(duration / 30); i++) {
        blocked.add(`${Math.floor(totalMin/60)}:${String(totalMin%60).padStart(2,"0")}`);
        totalMin += 30;
      }
    }
    return blocked;
  }

  getTimeSlots(staffId: string, date: string, courseId?: string) {
    const dateObj = new Date(date + "T00:00:00");
    const dayOfWeek = dateObj.getDay();
    const course = courseId ? this.courses.find(c => c.id === courseId) : null;
    const duration = course?.duration ?? 30;
    const slotsNeeded = Math.ceil(duration / 30);

    const isAvail = (time: string, blocked: Set<string>): boolean => {
      const [h, m] = time.split(":").map(Number);
      let totalMin = h * 60 + m;
      if (totalMin + (slotsNeeded - 1) * 30 > 19 * 60) return false;
      for (let i = 0; i < slotsNeeded; i++) {
        if (blocked.has(`${Math.floor(totalMin/60)}:${String(totalMin%60).padStart(2,"0")}`)) return false;
        totalMin += 30;
      }
      return true;
    };

    const defaultTimes: string[] = [];
    for (let h = 10; h <= 19; h++) for (const m of [0, 30]) {
      if (h === 19 && m === 30) continue;
      defaultTimes.push(`${h}:${String(m).padStart(2,"0")}`);
    }

    if (staffId === "__shop__") {
      const tableCount = parseInt(this.settings.table_count || "0", 10);
      if (tableCount > 0) {
        return defaultTimes.map(time => {
          const [h, m] = time.split(":").map(Number);
          const startMin = h * 60 + m;
          if (startMin + duration > 19 * 60) return { time, available: false };
          const count = this.reservations.filter(r => {
            if (r.status === "cancelled" || r.date !== date || r.staffId !== "__shop__") return false;
            const rc = this.courses.find(c => c.id === r.courseId);
            const rd = rc?.duration ?? 30;
            const [rh, rm] = r.time.split(":").map(Number);
            const rStart = rh * 60 + rm;
            return rStart < startMin + duration && rStart + rd > startMin;
          }).length;
          return { time, available: count < tableCount };
        });
      }
      const candidateIds = course?.staffIds?.length ? course.staffIds : this.staff.map(s => s.id);
      const candidateBlocked = candidateIds.map(sid => this.getBlockedSlots(sid, date));
      return defaultTimes.map(time => ({ time, available: candidateBlocked.some(b => isAvail(time, b)) }));
    }

    const customSlots = this.slots.filter(s => s.staffId === staffId && s.dayOfWeek === dayOfWeek);
    const blocked = this.getBlockedSlots(staffId, date);
    if (customSlots.length > 0) {
      return customSlots.map(s => ({ time: s.time, available: s.available && isAvail(s.time, blocked) })).sort((a, b) => a.time.localeCompare(b.time));
    }
    return defaultTimes.map(time => ({ time, available: isAvail(time, blocked) }));
  }

  getStaffSlots(staffId: string) { return this.slots.filter(s => s.staffId === staffId); }

  findAvailableStaff(date: string, time: string, courseId?: string): string | null {
    const course = courseId ? this.courses.find(c => c.id === courseId) : null;
    const duration = course?.duration ?? 30;
    const [h, m] = time.split(":").map(Number);
    const startMin = h * 60 + m;
    const candidateIds = course?.staffIds?.length ? course.staffIds : this.staff.map(s => s.id);
    for (const sid of candidateIds) {
      const blocked = this.getBlockedSlots(sid, date);
      let ok = true;
      let totalMin = startMin;
      for (let i = 0; i < Math.ceil(duration / 30); i++) {
        if (blocked.has(`${Math.floor(totalMin/60)}:${String(totalMin%60).padStart(2,"0")}`)) { ok = false; break; }
        totalMin += 30;
      }
      if (ok) return sid;
    }
    return null;
  }
}

class BookingStoreManager {
  private stores = new Map<number, BookingStore>();

  getStore(shopId: number): BookingStore | undefined {
    if (!this.stores.has(shopId)) {
      const data = BOOKING_DATA[shopId];
      if (!data) return undefined;
      this.stores.set(shopId, new BookingStore(data));
    }
    return this.stores.get(shopId);
  }

  getOrCreateStore(shopId: number): BookingStore {
    if (!this.stores.has(shopId)) {
      const data = BOOKING_DATA[shopId] ?? { staff: [], courses: [], reservations: [], settings: { store_name: "", store_description: "", store_address: "", store_phone: "", store_email: "", store_hours: "", store_closed_days: "", banner_url: "", staff_selection_enabled: "false" } };
      this.stores.set(shopId, new BookingStore(data));
    }
    return this.stores.get(shopId)!;
  }
}

const bookingMgr = new BookingStoreManager();

// 設定（In-Memory store、DB非同期）
app.get("/api/shops/:shopId/settings", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  res.json(store.settings);
});

app.put("/api/shops/:shopId/settings", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  store.settings = { ...store.settings, ...req.body };
  res.json(store.settings);
});

// スタッフ
app.get("/api/shops/:shopId/staff", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.json([]);
  const result = store.staff.map((s: Staff) => ({
    ...s,
    courseIds: store.courses.filter((c: Course) => c.staffIds.includes(s.id)).map((c: Course) => c.id),
  }));
  res.json(result);
});

app.post("/api/shops/:shopId/staff", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  const { courseIds, ...rest } = req.body;
  const newStaff = { id: `s${shopId}-${store.genId()}`, courseIds: courseIds || [], ...rest };
  store.staff.push(newStaff);
  if (courseIds?.length) {
    for (const cid of courseIds) {
      const course = store.courses.find(c => c.id === cid);
      if (course && !course.staffIds.includes(newStaff.id)) course.staffIds.push(newStaff.id);
    }
  }
  res.status(201).json(newStaff);
});

app.put("/api/shops/:shopId/staff", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const { id, courseIds, ...rest } = req.body;
  const idx = store.staff.findIndex(s => s.id === id);
  if (idx < 0) return res.status(404).json({ message: "Staff not found" });
  store.staff[idx] = { ...store.staff[idx], ...rest };
  if (courseIds !== undefined) {
    for (const c of store.courses) {
      if (courseIds.includes(c.id)) { if (!c.staffIds.includes(id)) c.staffIds.push(id); }
      else { c.staffIds = c.staffIds.filter(sid => sid !== id); }
    }
  }
  res.json(store.staff[idx]);
});

app.delete("/api/shops/:shopId/staff", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const { id } = req.query as { id: string };
  store.staff = store.staff.filter(s => s.id !== id);
  for (const c of store.courses) c.staffIds = c.staffIds.filter(sid => sid !== id);
  res.json({ ok: true });
});

// コース
app.get("/api/shops/:shopId/courses", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.json([]);
  res.json(store.courses);
});

app.post("/api/shops/:shopId/courses", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  const { staffIds, ...rest } = req.body;
  const newCourse = { id: `c${shopId}-${store.genId()}`, staffIds: staffIds || [], ...rest };
  store.courses.push(newCourse);
  if (staffIds?.length) {
    for (const sid of staffIds) {
      const staff = store.staff.find(s => s.id === sid);
      if (staff && !staff.courseIds.includes(newCourse.id)) staff.courseIds.push(newCourse.id);
    }
  }
  res.status(201).json(newCourse);
});

app.put("/api/shops/:shopId/courses", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const { id, staffIds, ...rest } = req.body;
  const idx = store.courses.findIndex(c => c.id === id);
  if (idx < 0) return res.status(404).json({ message: "Course not found" });
  if (staffIds !== undefined) store.courses[idx].staffIds = staffIds;
  store.courses[idx] = { ...store.courses[idx], ...rest };
  res.json(store.courses[idx]);
});

app.delete("/api/shops/:shopId/courses", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const { id } = req.query as { id: string };
  store.courses = store.courses.filter(c => c.id !== id);
  for (const s of store.staff) s.courseIds = s.courseIds.filter(cid => cid !== id);
  res.json({ ok: true });
});

// スロット
app.get("/api/shops/:shopId/slots", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  const { staffId, date, courseId } = req.query as { staffId?: string; date?: string; courseId?: string };
  if (staffId && date) return res.json(store.getTimeSlots(staffId, date, courseId));
  if (staffId) return res.json(store.getStaffSlots(staffId));
  res.json(store.slots);
});

app.put("/api/shops/:shopId/slots", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  const { staffId, dayOfWeek, time, available } = req.body;
  const existing = store.slots.find(s => s.staffId === staffId && s.dayOfWeek === dayOfWeek && s.time === time);
  if (existing) { existing.available = available; }
  else { store.slots.push({ id: store.genId(), staffId, dayOfWeek, time, available }); }
  res.json({ ok: true });
});

app.post("/api/shops/:shopId/slots", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  const { staffId, dayOfWeek, times, available } = req.body;
  for (const time of (times || [])) {
    const existing = store.slots.find(s => s.staffId === staffId && s.dayOfWeek === dayOfWeek && s.time === time);
    if (existing) { existing.available = available; }
    else { store.slots.push({ id: store.genId(), staffId, dayOfWeek, time, available }); }
  }
  res.json({ ok: true });
});

// 予約
app.get("/api/shops/:shopId/reservations", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.json([]);
  res.json(store.reservations);
});

app.post("/api/shops/:shopId/reservations", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  let { staffId, date, time, courseId, ...rest } = req.body;
  if (staffId === "__shop__" && store.settings.staff_selection_enabled === "true") {
    const assigned = store.findAvailableStaff(date, time, courseId);
    if (assigned) staffId = assigned;
  }
  const reservation: Reservation = {
    id: `r${shopId}-${store.genId()}`,
    staffId, date, time, courseId,
    reservationToken: store.genToken(),
    ...rest,
  };
  store.reservations.push(reservation);
  res.status(201).json(reservation);
});

app.put("/api/shops/:shopId/reservations", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const { id, ...rest } = req.body;
  const idx = store.reservations.findIndex(r => r.id === id);
  if (idx < 0) return res.status(404).json({ message: "Reservation not found" });
  store.reservations[idx] = { ...store.reservations[idx], ...rest };
  res.json(store.reservations[idx]);
});

app.delete("/api/shops/:shopId/reservations", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const { id } = req.query as { id: string };
  store.reservations = store.reservations.filter(r => r.id !== id);
  res.json({ ok: true });
});

// キャンセル
app.get("/api/shops/:shopId/cancel/:token", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const r = store.reservations.find(r => r.reservationToken === req.params.token);
  if (!r) return res.status(404).json({ message: "Reservation not found" });
  const course = store.courses.find(c => c.id === r.courseId);
  const staff = store.staff.find(s => s.id === r.staffId);
  res.json({ ...r, courseName: course?.name, staffName: staff?.name });
});

app.post("/api/shops/:shopId/cancel/:token", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.status(404).json({ message: "Shop not found" });
  const r = store.reservations.find(r => r.reservationToken === req.params.token);
  if (!r) return res.status(404).json({ message: "Reservation not found" });
  if (r.status === "cancelled") return res.status(400).json({ message: "Already cancelled" });
  r.status = "cancelled";
  r.cancelledAt = new Date().toISOString();
  res.json(r);
});

// お問い合わせ
app.get("/api/shops/:shopId/inquiries", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getStore(shopId);
  if (!store) return res.json([]);
  res.json(store.inquiries);
});

app.post("/api/shops/:shopId/inquiries", (req: Request, res: Response) => {
  const shopId = parseInt(req.params.shopId);
  const store = bookingMgr.getOrCreateStore(shopId);
  const inquiry: InquiryEntry = { id: store.genId(), ...req.body, createdAt: new Date().toISOString() };
  store.inquiries.push(inquiry);
  res.status(201).json(inquiry);
});

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  console.error("Internal Server Error:", err);
  return res.status(status).json({ message });
});

// Vercel handler
export default async function handler(req: VercelRequest, res: VercelResponse) {
  return app(req as any, res as any);
}
