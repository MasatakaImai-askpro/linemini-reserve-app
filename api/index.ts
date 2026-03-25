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
  import crypto from "crypto";

  const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";

  function hashPassword(password: string): string {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  // ─── DB接続 ───
  const sql = neon(process.env.DATABASE_URL!);

  // ─── Drizzle スキーマ（shops / coupons / users / auth 用） ───
  const userRoleEnum = pgEnum("user_role", ["admin", "shop_admin"]);
  const discountTypeEnum = pgEnum("discount_type", ["AMOUNT", "PERCENTAGE", "FREE"]);

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
  }, (t) => [uniqueIndex("shop_categories_idx").on(t.shopId, t.categoryId)]);

  const insertShopSchema = createInsertSchema(shops).omit({ id: true });
  const insertCouponSchema = createInsertSchema(coupons).omit({ id: true });

  const db = drizzle(sql, { schema: { users, areas, categories, shops, coupons, shopCategories } });

  // ─── 予約テーブル初期化（起動時に一度だけ実行） ───
  let tablesInitialized = false;
  async function initBookingTables() {
    if (tablesInitialized) return;
    try {
      await sql`
        CREATE TABLE IF NOT EXISTS booking_staff (
          id SERIAL PRIMARY KEY,
          shop_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          role TEXT DEFAULT '',
          avatar TEXT DEFAULT '',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS booking_courses (
          id SERIAL PRIMARY KEY,
          shop_id INTEGER NOT NULL,
          name TEXT NOT NULL,
          category TEXT DEFAULT '',
          duration INTEGER DEFAULT 60,
          price INTEGER DEFAULT 0,
          description TEXT DEFAULT '',
          prepayment_only BOOLEAN DEFAULT false,
          image_url TEXT,
          staff_ids TEXT[] DEFAULT '{}',
          is_active BOOLEAN DEFAULT true,
          created_at TIMESTAMP DEFAULT NOW(),
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS booking_reservations (
          id SERIAL PRIMARY KEY,
          shop_id INTEGER NOT NULL,
          customer_name TEXT NOT NULL,
          customer_phone TEXT,
          customer_email TEXT,
          date TEXT NOT NULL,
          time TEXT NOT NULL,
          staff_id TEXT DEFAULT '__shop__',
          course_id TEXT NOT NULL,
          status TEXT DEFAULT 'confirmed',
          paid BOOLEAN DEFAULT false,
          cancel_token TEXT UNIQUE,
          created_at TIMESTAMP DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS booking_settings (
          shop_id INTEGER PRIMARY KEY,
          store_name TEXT DEFAULT '',
          store_description TEXT DEFAULT '',
          store_address TEXT DEFAULT '',
          store_phone TEXT DEFAULT '',
          store_email TEXT DEFAULT '',
          store_hours TEXT DEFAULT '',
          store_closed_days TEXT DEFAULT '',
          banner_url TEXT DEFAULT '',
          staff_selection_enabled TEXT DEFAULT 'false',
          updated_at TIMESTAMP DEFAULT NOW()
        )
      `;
      tablesInitialized = true;
    } catch (e) {
      console.error("initBookingTables error:", e);
    }
  }

  // ─── デモデータ（PR#8 booking-store.ts から） ───
  const DEMO_DATA: Record<number, {
    staff: { name: string; role: string; avatar: string }[];
    courses: { name: string; category: string; duration: number; price: number; description: string; prepaymentOnly: boolean }[];
    settings: Record<string, string>;
  }> = {
    1: {
      staff: [
        { name: "佐藤 健太", role: "料理長", avatar: "佐健" },
        { name: "高橋 裕子", role: "副料理長", avatar: "高裕" },
      ],
      courses: [
        { name: "特製ラーメンコース", category: "食事", duration: 60, price: 2800, description: "自家製麺と特製スープの極上ラーメンコース。前菜・餃子・デザート付き。", prepaymentOnly: false },
        { name: "宴会プラン（2時間）", category: "宴会", duration: 120, price: 4500, description: "飲み放題付き宴会プラン。ラーメン・チャーハン・餃子など全8品。", prepaymentOnly: true },
        { name: "ランチセット予約", category: "食事", duration: 45, price: 1200, description: "日替わりラーメン＋ミニチャーハン＋ドリンクのお得なランチセット。", prepaymentOnly: false },
      ],
      settings: {
        store_name: "麺処 小田原屋",
        store_description: "自家製麺と厳選スープのこだわりラーメン店",
        store_address: "神奈川県小田原市栄町2-1-5",
        store_phone: "0465-22-1234",
        store_email: "info@odawaraya.jp",
        store_hours: "11:00〜22:00（L.O. 21:30）",
        store_closed_days: "毎週水曜日",
        banner_url: "",
        staff_selection_enabled: "false",
      },
    },
    3: {
      staff: [
        { name: "田中 美咲", role: "オーナースタイリスト", avatar: "田美" },
        { name: "佐藤 優花", role: "シニアスタイリスト", avatar: "佐優" },
        { name: "山本 凛", role: "スタイリスト", avatar: "山凛" },
        { name: "鈴木 愛", role: "ジュニアスタイリスト", avatar: "鈴愛" },
      ],
      courses: [
        { name: "カット", category: "ヘア", duration: 60, price: 4400, description: "カウンセリング・シャンプー・カット・ブロー込みのスタンダードメニュー。", prepaymentOnly: false },
        { name: "カット＋カラー", category: "ヘア", duration: 120, price: 9800, description: "カットとカラーのセットメニュー。オーガニックカラー使用。", prepaymentOnly: false },
        { name: "カット＋パーマ", category: "ヘア", duration: 150, price: 13200, description: "カットとパーマのセットメニュー。デジタルパーマも対応。", prepaymentOnly: false },
        { name: "ヘッドスパ", category: "リラクゼーション", duration: 45, price: 5500, description: "頭皮ケア＆リラクゼーション。炭酸泉使用。", prepaymentOnly: false },
      ],
      settings: {
        store_name: "Hair Salon MIKU",
        store_description: "あなたの魅力を引き出すヘアサロン",
        store_address: "神奈川県大和市中央3-5-8",
        store_phone: "046-261-3456",
        store_email: "info@salon-miku.jp",
        store_hours: "10:00〜20:00（最終受付19:00）",
        store_closed_days: "毎週火曜日",
        banner_url: "",
        staff_selection_enabled: "true",
      },
    },
  };

  async function seedShopIfEmpty(shopId: number) {
    const existing = await sql`SELECT id FROM booking_courses WHERE shop_id = ${shopId} LIMIT 1`;
    if (existing.length > 0) return;

    const demo = DEMO_DATA[shopId];
    if (!demo) {
      // Generic demo data for unknown shops
      const shop = await sql`SELECT name, description, address, phone, hours, closed_days, image_url FROM shops WHERE id = ${shopId}`;
      if (shop.length === 0) return;
      const s = shop[0];
      await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only) VALUES (${shopId}, '通常コース', 'スタンダード', 60, 3000, '標準コースです。', false)`;
      await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_hours, store_closed_days, banner_url, staff_selection_enabled)
        VALUES (${shopId}, ${s.name || ''}, ${s.description || ''}, ${s.address || ''}, ${s.phone || ''}, ${s.hours || ''}, ${s.closed_days || ''}, ${s.image_url || ''}, 'false')
        ON CONFLICT (shop_id) DO NOTHING`;
      return;
    }

    // Insert staff
    const staffIds: Record<number, string> = {};
    for (let i = 0; i < demo.staff.length; i++) {
      const st = demo.staff[i];
      const row = await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${st.name}, ${st.role}, ${st.avatar}) RETURNING id`;
      staffIds[i] = row[0].id.toString();
    }

    // Insert courses with staff IDs
    const allStaffIds = Object.values(staffIds);
    for (let i = 0; i < demo.courses.length; i++) {
      const c = demo.courses[i];
      // Each course gets all staff or subset - for simplicity give all staff
      await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, staff_ids)
        VALUES (${shopId}, ${c.name}, ${c.category}, ${c.duration}, ${c.price}, ${c.description}, ${c.prepaymentOnly}, ${allStaffIds})`;
    }

    // Insert settings
    const s = demo.settings;
    await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_email, store_hours, store_closed_days, banner_url, staff_selection_enabled)
      VALUES (${shopId}, ${s.store_name}, ${s.store_description}, ${s.store_address}, ${s.store_phone}, ${s.store_email || ''}, ${s.store_hours}, ${s.store_closed_days}, ${s.banner_url || ''}, ${s.staff_selection_enabled || 'false'})
      ON CONFLICT (shop_id) DO NOTHING`;
  }

  // ─── Express 設定 ───
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));

  // 予約テーブル初期化ミドルウェア
  app.use(async (_req, _res, next) => {
    await initBookingTables();
    next();
  });

  // ─── エリア ───
  app.get("/api/areas", async (_req, res) => {
    try {
      const result = await db.select().from(areas);
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch areas" });
    }
  });

  // ─── カテゴリ ───
  app.get("/api/categories", async (_req, res) => {
    try {
      const result = await db.select().from(categories);
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // ─── 店舗 ───
  app.get("/api/shops", async (req, res) => {
    try {
      const { areaId, categoryId } = req.query;
      let result;
      if (areaId) {
        result = await db.select().from(shops).where(eq(shops.areaId, parseInt(areaId as string))).orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
      } else if (categoryId) {
        const rows = await db.select().from(shopCategories).where(eq(shopCategories.categoryId, parseInt(categoryId as string)));
        const ids = rows.map(r => r.shopId);
        if (ids.length === 0) return res.json([]);
        result = await db.select().from(shops).where(inArray(shops.id, ids)).orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
      } else {
        result = await db.select().from(shops).orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
      }
      res.json(result);
    } catch (e) {
      console.error(e);
      res.status(500).json({ message: "Failed to fetch shops" });
    }
  });

  app.get("/api/shops/slug/:slug", async (req, res) => {
    try {
      const [shop] = await db.select().from(shops).where(eq(shops.slug, req.params.slug));
      if (!shop) return res.status(404).json({ message: "Shop not found" });
      res.json(shop);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch shop" });
    }
  });

  app.get("/api/shops/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
      const [shop] = await db.select().from(shops).where(eq(shops.id, id));
      if (!shop) return res.status(404).json({ message: "Shop not found" });
      res.json(shop);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch shop" });
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
      const slug = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
      const parsed = insertShopSchema.safeParse({ displayOrder: 0, slug, ...body, areaId: areaId ?? body.areaId });
      if (!parsed.success) return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      const [shop] = await db.insert(shops).values(parsed.data).returning();
      res.status(201).json(shop);
    } catch (e) {
      res.status(500).json({ message: "Failed to create shop" });
    }
  });

  app.put("/api/shops/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
      const partial = insertShopSchema.partial().safeParse(req.body);
      if (!partial.success) return res.status(400).json({ message: "Invalid request body", errors: partial.error.errors });
      const [shop] = await db.update(shops).set({ ...partial.data, updatedAt: new Date() }).where(eq(shops.id, id)).returning();
      if (!shop) return res.status(404).json({ message: "Shop not found" });
      res.json(shop);
    } catch (e) {
      res.status(500).json({ message: "Failed to update shop" });
    }
  });

  app.post("/api/shops/:id/like", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
      const [shop] = await db.select().from(shops).where(eq(shops.id, id));
      if (!shop) return res.status(404).json({ message: "Shop not found" });
      const [updated] = await db.update(shops).set({ likeCount: shop.likeCount + 1 }).where(eq(shops.id, id)).returning();
      res.json({ likeCount: updated?.likeCount });
    } catch (e) {
      res.status(500).json({ message: "Failed to like shop" });
    }
  });

  // ─── クーポン ───
  app.get("/api/shops/:id/coupons", async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
      const result = await db.select().from(coupons).where(eq(coupons.shopId, shopId)).orderBy(desc(coupons.updatedAt));
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.post("/api/shops/:id/coupons", async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
      const parsed = insertCouponSchema.omit({ shopId: true }).safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      const [coupon] = await db.insert(coupons).values({ ...parsed.data, shopId }).returning();
      res.status(201).json(coupon);
    } catch (e) {
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.get("/api/coupons", async (_req, res) => {
    try {
      const result = await db.select().from(coupons).orderBy(desc(coupons.updatedAt));
      res.json(result);
    } catch (e) {
      res.status(500).json({ message: "Failed to fetch coupons" });
    }
  });

  app.put("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid coupon ID" });
      const partial = insertCouponSchema.partial().safeParse(req.body);
      if (!partial.success) return res.status(400).json({ message: "Invalid request body", errors: partial.error.errors });
      const [coupon] = await db.update(coupons).set({ ...partial.data, updatedAt: new Date() }).where(eq(coupons.id, id)).returning();
      if (!coupon) return res.status(404).json({ message: "Coupon not found" });
      res.json(coupon);
    } catch (e) {
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid coupon ID" });
      const result = await db.delete(coupons).where(eq(coupons.id, id)).returning();
      if (result.length === 0) return res.status(404).json({ message: "Coupon not found" });
      res.json({ message: "Coupon deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  // ─── 認証 (JWT) ───
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      const [user] = await db.select().from(users).where(eq(users.username, username));
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const valid = user.passwordHash === password || hashPassword(password) === user.passwordHash;
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      const payload = { userId: user.id, role: user.role, shopId: user.shopId, exp: Date.now() + 7 * 24 * 60 * 60 * 1000 };
      const token = Buffer.from(JSON.stringify(payload)).toString("base64");
      res.json({ id: user.id, username: user.username, role: user.role, shopId: user.shopId, token });
    } catch (e) {
      console.error("Login error:", e);
      res.status(500).json({ message: "Login failed" });
    }
  });

  app.post("/api/auth/logout", (_req, res) => res.json({ message: "Logged out" }));

  app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return res.status(401).json({ message: "Not authenticated" });
    const token = authHeader.substring(7);
    try {
      const decoded = JSON.parse(Buffer.from(token, "base64").toString()) as { userId: number; role: string; shopId: number | null; exp: number };
      if (decoded.exp < Date.now()) return res.status(401).json({ message: "Token expired" });
      const [user] = await db.select().from(users).where(eq(users.id, decoded.userId));
      if (!user) return res.status(401).json({ message: "User not found" });
      res.json({ id: user.id, username: user.username, role: user.role, shopId: user.shopId });
    } catch (e) {
      res.status(401).json({ message: "Invalid token" });
    }
  });

  // ─── スタッフ ───
  app.get("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await seedShopIfEmpty(shopId);
      const rows = await sql`SELECT * FROM booking_staff WHERE shop_id = ${shopId} AND is_active = true ORDER BY id`;
      const courses = await sql`SELECT id, staff_ids FROM booking_courses WHERE shop_id = ${shopId} AND is_active = true`;
      const staffList = rows.map((s: any) => ({
        id: s.id.toString(),
        name: s.name,
        role: s.role || "",
        avatar: s.avatar || "",
        courseIds: courses.filter((c: any) => (c.staff_ids || []).includes(s.id.toString())).map((c: any) => c.id.toString()),
      }));
      res.json(staffList);
    } catch (e) {
      console.error("staff GET error:", e);
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { name, role, avatar } = req.body;
      const [row] = await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${name || ''}, ${role || ''}, ${avatar || ''}) RETURNING *`;
      res.status(201).json({ id: row.id.toString(), name: row.name, role: row.role, avatar: row.avatar, courseIds: [] });
    } catch (e) {
      res.status(500).json({ message: "Failed to create staff" });
    }
  });

  app.put("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { id, name, role, avatar } = req.body;
      const staffId = parseInt(id);
      if (isNaN(staffId)) return res.status(400).json({ message: "Invalid staff ID" });
      await sql`UPDATE booking_staff SET name = ${name || ''}, role = ${role || ''}, avatar = ${avatar || ''} WHERE id = ${staffId} AND shop_id = ${shopId}`;
      res.json({ id: id.toString(), name, role, avatar });
    } catch (e) {
      res.status(500).json({ message: "Failed to update staff" });
    }
  });

  app.delete("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const id = parseInt(req.query.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid staff ID" });
      await sql`UPDATE booking_staff SET is_active = false WHERE id = ${id} AND shop_id = ${shopId}`;
      res.json({ message: "Staff deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete staff" });
    }
  });

  // ─── コース ───
  app.get("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await seedShopIfEmpty(shopId);
      const rows = await sql`SELECT * FROM booking_courses WHERE shop_id = ${shopId} AND is_active = true ORDER BY id`;
      const courses = rows.map((c: any) => ({
        id: c.id.toString(),
        name: c.name,
        category: c.category || "",
        duration: c.duration || 60,
        price: c.price || 0,
        description: c.description || "",
        prepaymentOnly: c.prepayment_only || false,
        imageUrl: c.image_url || null,
        staffIds: (c.staff_ids || []).map((s: any) => s.toString()),
      }));
      res.json(courses);
    } catch (e) {
      console.error("courses GET error:", e);
      res.status(500).json({ message: "Failed to fetch courses" });
    }
  });

  app.post("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { name, category, duration, price, description, prepaymentOnly, imageUrl, staffIds } = req.body;
      const [row] = await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, image_url, staff_ids)
        VALUES (${shopId}, ${name || ''}, ${category || ''}, ${duration || 60}, ${price || 0}, ${description || ''}, ${prepaymentOnly || false}, ${imageUrl || null}, ${staffIds || []})
        RETURNING *`;
      res.status(201).json({ id: row.id.toString(), name: row.name, category: row.category, duration: row.duration, price: row.price, description: row.description, prepaymentOnly: row.prepayment_only, imageUrl: row.image_url, staffIds: row.staff_ids || [] });
    } catch (e) {
      res.status(500).json({ message: "Failed to create course" });
    }
  });

  app.put("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { id, name, category, duration, price, description, prepaymentOnly, imageUrl, staffIds } = req.body;
      const courseId = parseInt(id);
      if (isNaN(courseId)) return res.status(400).json({ message: "Invalid course ID" });
      const [row] = await sql`UPDATE booking_courses SET name = ${name || ''}, category = ${category || ''}, duration = ${duration || 60}, price = ${price || 0}, description = ${description || ''}, prepayment_only = ${prepaymentOnly || false}, image_url = ${imageUrl || null}, staff_ids = ${staffIds || []}, updated_at = NOW()
        WHERE id = ${courseId} AND shop_id = ${shopId} RETURNING *`;
      if (!row) return res.status(404).json({ message: "Course not found" });
      res.json({ id: row.id.toString(), name: row.name, category: row.category, duration: row.duration, price: row.price, description: row.description, prepaymentOnly: row.prepayment_only, imageUrl: row.image_url, staffIds: row.staff_ids || [] });
    } catch (e) {
      res.status(500).json({ message: "Failed to update course" });
    }
  });

  app.delete("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const id = parseInt(req.query.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid course ID" });
      await sql`UPDATE booking_courses SET is_active = false WHERE id = ${id} AND shop_id = ${shopId}`;
      res.json({ message: "Course deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete course" });
    }
  });

  // ─── 予約枠（スロット） ───
  function generateSlots(startHour: number, endHour: number, intervalMin: number): string[] {
    const slots: string[] = [];
    for (let h = startHour; h <= endHour; h++) {
      for (let m = 0; m < 60; m += intervalMin) {
        if (h === endHour && m > 0) break;
        slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      }
    }
    return slots;
  }

  app.get("/api/shops/:shopId/slots", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { date } = req.query as { staffId?: string; date?: string };
      const allSlots = generateSlots(10, 18, 30);
      if (!date) return res.json(allSlots.map(time => ({ time, available: true })));

      // Find booked times for this date
      const booked = await sql`SELECT time FROM booking_reservations WHERE shop_id = ${shopId} AND date = ${date} AND status != 'cancelled'`;
      const bookedTimes = new Set(booked.map((r: any) => r.time));
      const result = allSlots.map(time => ({ time, available: !bookedTimes.has(time) }));
      res.json(result);
    } catch (e) {
      console.error("slots GET error:", e);
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.put("/api/shops/:shopId/slots", async (req, res) => res.json({ ok: true }));
  app.post("/api/shops/:shopId/slots", async (req, res) => res.json({ ok: true }));

  // ─── 設定 ───
  app.get("/api/shops/:shopId/settings", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await seedShopIfEmpty(shopId);
      const rows = await sql`SELECT * FROM booking_settings WHERE shop_id = ${shopId}`;
      if (rows.length > 0) {
        const s = rows[0];
        return res.json({
          store_name: s.store_name || "",
          store_description: s.store_description || "",
          store_address: s.store_address || "",
          store_phone: s.store_phone || "",
          store_email: s.store_email || "",
          store_hours: s.store_hours || "",
          store_closed_days: s.store_closed_days || "",
          banner_url: s.banner_url || "",
          staff_selection_enabled: s.staff_selection_enabled || "false",
        });
      }
      // Fallback: read from shop
      const shopRows = await db.select().from(shops).where(eq(shops.id, shopId));
      if (shopRows.length === 0) return res.status(404).json({ message: "Shop not found" });
      const shop = shopRows[0];
      res.json({
        store_name: shop.name,
        store_description: shop.description,
        store_address: shop.address,
        store_phone: shop.phone || "",
        store_email: "",
        store_hours: shop.hours || "",
        store_closed_days: shop.closedDays || "",
        banner_url: shop.imageUrl || "",
        staff_selection_enabled: shop.enableStaffAssignment ? "true" : "false",
      });
    } catch (e) {
      console.error("settings GET error:", e);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.put("/api/shops/:shopId/settings", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const s = req.body;
      await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_email, store_hours, store_closed_days, banner_url, staff_selection_enabled, updated_at)
        VALUES (${shopId}, ${s.store_name||''}, ${s.store_description||''}, ${s.store_address||''}, ${s.store_phone||''}, ${s.store_email||''}, ${s.store_hours||''}, ${s.store_closed_days||''}, ${s.banner_url||''}, ${s.staff_selection_enabled||'false'}, NOW())
        ON CONFLICT (shop_id) DO UPDATE SET store_name=${s.store_name||''}, store_description=${s.store_description||''}, store_address=${s.store_address||''}, store_phone=${s.store_phone||''}, store_email=${s.store_email||''}, store_hours=${s.store_hours||''}, store_closed_days=${s.store_closed_days||''}, banner_url=${s.banner_url||''}, staff_selection_enabled=${s.staff_selection_enabled||'false'}, updated_at=NOW()`;
      res.json(s);
    } catch (e) {
      res.status(500).json({ message: "Failed to update settings" });
    }
  });

  // ─── 予約 ───
  app.get("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const rows = await sql`SELECT * FROM booking_reservations WHERE shop_id = ${shopId} ORDER BY date DESC, time DESC`;
      const result = rows.map((r: any) => ({
        id: r.id.toString(),
        customerName: r.customer_name,
        customerPhone: r.customer_phone || undefined,
        customerEmail: r.customer_email || undefined,
        date: r.date,
        time: r.time,
        staffId: r.staff_id || "__shop__",
        courseId: r.course_id,
        status: r.status || "confirmed",
        paid: r.paid || false,
        reservationToken: r.cancel_token || undefined,
      }));
      res.json(result);
    } catch (e) {
      console.error("reservations GET error:", e);
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.post("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { customerName, customerPhone, customerEmail, date, time, staffId, courseId } = req.body;
      if (!customerName || !date || !time || !courseId) return res.status(400).json({ message: "Missing required fields" });
      const cancelToken = crypto.randomUUID().replace(/-/g, "");
      const [row] = await sql`INSERT INTO booking_reservations (shop_id, customer_name, customer_phone, customer_email, date, time, staff_id, course_id, status, paid, cancel_token)
        VALUES (${shopId}, ${customerName}, ${customerPhone || null}, ${customerEmail || null}, ${date}, ${time}, ${staffId || '__shop__'}, ${courseId.toString()}, 'confirmed', false, ${cancelToken})
        RETURNING *`;
      res.status(201).json({
        id: row.id.toString(),
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email,
        date: row.date,
        time: row.time,
        staffId: row.staff_id || "__shop__",
        courseId: row.course_id,
        status: row.status,
        paid: row.paid,
        reservationToken: row.cancel_token,
      });
    } catch (e) {
      console.error("reservation POST error:", e);
      res.status(500).json({ message: "Failed to create reservation" });
    }
  });

  app.put("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { id, status, paid, customerName, customerPhone, customerEmail, date, time } = req.body;
      const resId = parseInt(id);
      if (isNaN(resId)) return res.status(400).json({ message: "Invalid reservation ID" });
      const [row] = await sql`UPDATE booking_reservations SET
        status = COALESCE(${status || null}, status),
        paid = COALESCE(${paid !== undefined ? paid : null}, paid),
        customer_name = COALESCE(${customerName || null}, customer_name),
        customer_phone = COALESCE(${customerPhone || null}, customer_phone),
        customer_email = COALESCE(${customerEmail || null}, customer_email),
        date = COALESCE(${date || null}, date),
        time = COALESCE(${time || null}, time)
        WHERE id = ${resId} AND shop_id = ${shopId} RETURNING *`;
      if (!row) return res.status(404).json({ message: "Reservation not found" });
      res.json({ id: row.id.toString(), customerName: row.customer_name, date: row.date, time: row.time, staffId: row.staff_id, courseId: row.course_id, status: row.status, paid: row.paid });
    } catch (e) {
      res.status(500).json({ message: "Failed to update reservation" });
    }
  });

  app.delete("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const id = parseInt(req.query.id as string);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid reservation ID" });
      await sql`DELETE FROM booking_reservations WHERE id = ${id} AND shop_id = ${shopId}`;
      res.json({ message: "Reservation deleted" });
    } catch (e) {
      res.status(500).json({ message: "Failed to delete reservation" });
    }
  });

  // ─── キャンセル ───
  app.get("/api/shops/:shopId/cancel/:token", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const token = req.params.token;
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const rows = await sql`SELECT r.*, c.name as course_name, c.duration as course_duration, c.price as course_price
        FROM booking_reservations r
        LEFT JOIN booking_courses c ON c.id::text = r.course_id AND c.shop_id = ${shopId}
        WHERE r.cancel_token = ${token} AND r.shop_id = ${shopId}`;
      if (rows.length === 0) return res.status(404).json({ message: "Reservation not found" });
      const r = rows[0];
      res.json({
        id: r.id.toString(),
        customerName: r.customer_name,
        date: r.date,
        time: r.time,
        courseId: r.course_id,
        courseName: r.course_name || "コース",
        courseDuration: r.course_duration || 60,
        coursePrice: r.course_price || 0,
        status: r.status,
      });
    } catch (e) {
      console.error("cancel GET error:", e);
      res.status(500).json({ message: "Failed to fetch reservation" });
    }
  });

  app.post("/api/shops/:shopId/cancel/:token", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const token = req.params.token;
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const rows = await sql`SELECT * FROM booking_reservations WHERE cancel_token = ${token} AND shop_id = ${shopId}`;
      if (rows.length === 0) return res.status(404).json({ message: "Reservation not found" });
      const r = rows[0];
      if (r.status === "cancelled") return res.json({ ok: true, already: true });
      await sql`UPDATE booking_reservations SET status = 'cancelled' WHERE cancel_token = ${token} AND shop_id = ${shopId}`;
      res.json({ ok: true });
    } catch (e) {
      res.status(500).json({ message: "Failed to cancel reservation" });
    }
  });

  // ─── 問い合わせ ───
  app.post("/api/shops/:shopId/inquiries", async (req, res) => res.status(201).json({ ok: true }));
  app.get("/api/shops/:shopId/inquiries", async (req, res) => res.json([]));

  // ─── Error handler ───
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Internal error:", err);
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  });

  // ─── Vercel handler ───
  export default async function handler(req: VercelRequest, res: VercelResponse) {
    return app(req as any, res as any);
  }
  