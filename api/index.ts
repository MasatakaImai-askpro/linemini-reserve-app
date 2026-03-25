import type { VercelRequest, VercelResponse } from "@vercel/node";
  import express, { type Request, Response, NextFunction } from "express";
  import { neon } from "@neondatabase/serverless";
  import crypto from "crypto";

  // ─── DB接続（生SQL） ───
  const sql = neon(process.env.DATABASE_URL!);

  // ─── 認証ユーティリティ ───
  function hashPassword(password: string): string {
    return crypto.createHash("sha256").update(password).digest("hex");
  }

  // ─── 予約テーブル初期化 ───
  let tablesInitialized = false;
  async function initBookingTables() {
    if (tablesInitialized) return;
    try {
      await sql`CREATE TABLE IF NOT EXISTS booking_staff (
        id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL,
        name TEXT NOT NULL, role TEXT DEFAULT '', avatar TEXT DEFAULT '',
        is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS booking_courses (
        id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL,
        name TEXT NOT NULL, category TEXT DEFAULT '', duration INTEGER DEFAULT 60,
        price INTEGER DEFAULT 0, description TEXT DEFAULT '',
        prepayment_only BOOLEAN DEFAULT false, image_url TEXT,
        staff_ids TEXT[] DEFAULT '{}', is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT NOW(), updated_at TIMESTAMP DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS booking_reservations (
        id SERIAL PRIMARY KEY, shop_id INTEGER NOT NULL,
        customer_name TEXT NOT NULL, customer_phone TEXT, customer_email TEXT,
        date TEXT NOT NULL, time TEXT NOT NULL, staff_id TEXT DEFAULT '__shop__',
        course_id TEXT NOT NULL, status TEXT DEFAULT 'confirmed',
        paid BOOLEAN DEFAULT false, cancel_token TEXT UNIQUE,
        created_at TIMESTAMP DEFAULT NOW()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS booking_settings (
        shop_id INTEGER PRIMARY KEY, store_name TEXT DEFAULT '',
        store_description TEXT DEFAULT '', store_address TEXT DEFAULT '',
        store_phone TEXT DEFAULT '', store_email TEXT DEFAULT '',
        store_hours TEXT DEFAULT '', store_closed_days TEXT DEFAULT '',
        banner_url TEXT DEFAULT '', staff_selection_enabled TEXT DEFAULT 'false',
        updated_at TIMESTAMP DEFAULT NOW()
      )`;
      tablesInitialized = true;
    } catch (e) {
      console.error("initBookingTables error:", e);
    }
  }

  // ─── デモデータ ───
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
      settings: { store_name: "麺処 小田原屋", store_description: "自家製麺と厳選スープのこだわりラーメン店", store_address: "神奈川県小田原市栄町2-1-5", store_phone: "0465-22-1234", store_email: "info@odawaraya.jp", store_hours: "11:00〜22:00（L.O. 21:30）", store_closed_days: "毎週水曜日", banner_url: "", staff_selection_enabled: "false" },
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
      settings: { store_name: "Hair Salon MIKU", store_description: "あなたの魅力を引き出すヘアサロン", store_address: "神奈川県大和市中央3-5-8", store_phone: "046-261-3456", store_email: "info@salon-miku.jp", store_hours: "10:00〜20:00（最終受付19:00）", store_closed_days: "毎週火曜日", banner_url: "", staff_selection_enabled: "true" },
    },
  };

  async function seedShopIfEmpty(shopId: number) {
    const existing = await sql`SELECT id FROM booking_courses WHERE shop_id = ${shopId} LIMIT 1`;
    if (existing.length > 0) return;
    const demo = DEMO_DATA[shopId];
    if (!demo) {
      const shopRows = await sql`SELECT name, description, address, phone, hours, closed_days, image_url FROM shops WHERE id = ${shopId}`;
      if (shopRows.length === 0) return;
      const s = shopRows[0];
      await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only) VALUES (${shopId}, '通常コース', 'スタンダード', 60, 3000, '標準コースです。', false)`;
      await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_hours, store_closed_days, banner_url, staff_selection_enabled)
        VALUES (${shopId}, ${s.name||''}, ${s.description||''}, ${s.address||''}, ${s.phone||''}, ${s.hours||''}, ${s.closed_days||''}, ${s.image_url||''}, 'false')
        ON CONFLICT (shop_id) DO NOTHING`;
      return;
    }
    const allStaffIds: string[] = [];
    for (const st of demo.staff) {
      const row = await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${st.name}, ${st.role}, ${st.avatar}) RETURNING id`;
      allStaffIds.push(row[0].id.toString());
    }
    for (const c of demo.courses) {
      await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, staff_ids)
        VALUES (${shopId}, ${c.name}, ${c.category}, ${c.duration}, ${c.price}, ${c.description}, ${c.prepaymentOnly}, ${allStaffIds})`;
    }
    const s = demo.settings;
    await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_email, store_hours, store_closed_days, banner_url, staff_selection_enabled)
      VALUES (${shopId}, ${s.store_name}, ${s.store_description}, ${s.store_address}, ${s.store_phone}, ${s.store_email||''}, ${s.store_hours}, ${s.store_closed_days}, ${s.banner_url||''}, ${s.staff_selection_enabled||'false'})
      ON CONFLICT (shop_id) DO NOTHING`;
  }

  // ─── Express ───
  const app = express();
  app.use(express.json());
  app.use(express.urlencoded({ extended: false }));
  app.use(async (_req, _res, next) => { try { await initBookingTables(); } catch(e) {} next(); });

  function toShop(r: any) {
    return { ...r, galleryImageUrls: r.gallery_image_urls, isActive: r.is_active, enableStaffAssignment: r.enable_staff_assignment, displayOrder: r.display_order, lineAccountUrl: r.line_account_url, imageUrl: r.image_url, reservationUrl: r.reservation_url, reservationImageUrl: r.reservation_image_url, likeCount: r.like_count, stripeConnectId: r.stripe_connect_id, stripeConnectStatus: r.stripe_connect_status, areaId: r.area_id, closedDays: r.closed_days, updatedAt: r.updated_at, createdAt: r.created_at };
  }

  // ─── エリア ───
  app.get("/api/areas", async (_req, res) => {
    try { res.json(await sql`SELECT * FROM areas ORDER BY id`); }
    catch (e: any) { console.error("areas error:", e); res.status(500).json({ message: "Failed to fetch areas" }); }
  });

  // ─── カテゴリ ───
  app.get("/api/categories", async (_req, res) => {
    try { res.json(await sql`SELECT * FROM categories ORDER BY id`); }
    catch (e: any) { console.error("categories error:", e); res.status(500).json({ message: "Failed to fetch categories" }); }
  });

  // ─── 店舗 ───
  app.get("/api/shops", async (req, res) => {
    try {
      const { areaId, categoryId } = req.query;
      let rows;
      if (areaId) {
        rows = await sql`SELECT * FROM shops WHERE area_id = ${parseInt(areaId as string)} ORDER BY display_order DESC, updated_at DESC`;
      } else if (categoryId) {
        rows = await sql`SELECT s.* FROM shops s JOIN shop_categories sc ON sc.shop_id = s.id WHERE sc.category_id = ${parseInt(categoryId as string)} ORDER BY s.display_order DESC, s.updated_at DESC`;
      } else {
        rows = await sql`SELECT * FROM shops ORDER BY display_order DESC, updated_at DESC`;
      }
      res.json(rows.map(toShop));
    } catch (e: any) { console.error("shops error:", e); res.status(500).json({ message: "Failed to fetch shops" }); }
  });

  app.get("/api/shops/slug/:slug", async (req, res) => {
    try {
      const rows = await sql`SELECT * FROM shops WHERE slug = ${req.params.slug}`;
      if (!rows[0]) return res.status(404).json({ message: "Shop not found" });
      res.json(toShop(rows[0]));
    } catch (e: any) { res.status(500).json({ message: "Failed to fetch shop" }); }
  });

  app.get("/api/shops/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
      const rows = await sql`SELECT * FROM shops WHERE id = ${id}`;
      if (!rows[0]) return res.status(404).json({ message: "Shop not found" });
      res.json(toShop(rows[0]));
    } catch (e: any) { res.status(500).json({ message: "Failed to fetch shop" }); }
  });

  app.post("/api/shops", async (req, res) => {
    try {
      const b = req.body;
      const slug = b.slug || crypto.randomUUID().replace(/-/g,'').slice(0,10);
      const [row] = await sql`INSERT INTO shops (slug, name, description, area_id, area, category, address) VALUES (${slug}, ${b.name||''}, ${b.description||''}, ${b.areaId||1}, ${b.area||''}, ${b.category||''}, ${b.address||''}) RETURNING *`;
      res.status(201).json(toShop(row));
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Failed to create shop" }); }
  });

  app.put("/api/shops/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
      const b = req.body;
      const setClauses: string[] = [];
      const vals: any[] = [];
      const fields: Record<string, string> = {
        name: 'name', description: 'description', area: 'area', category: 'category', subcategory: 'subcategory',
        address: 'address', phone: 'phone', hours: 'hours', closedDays: 'closed_days', website: 'website',
        displayOrder: 'display_order', lineAccountUrl: 'line_account_url', imageUrl: 'image_url',
        galleryImageUrls: 'gallery_image_urls', isActive: 'is_active', enableStaffAssignment: 'enable_staff_assignment',
        reservationUrl: 'reservation_url', reservationImageUrl: 'reservation_image_url',
        likeCount: 'like_count', stripeConnectId: 'stripe_connect_id', stripeConnectStatus: 'stripe_connect_status',
      };
      for (const [jsKey, dbCol] of Object.entries(fields)) {
        if (b[jsKey] !== undefined) { setClauses.push(`${dbCol} = $${vals.length+1}`); vals.push(b[jsKey]); }
      }
      if (setClauses.length === 0) { const rows = await sql`SELECT * FROM shops WHERE id = ${id}`; return res.json(toShop(rows[0])); }
      setClauses.push(`updated_at = NOW()`);
      const q = `UPDATE shops SET ${setClauses.join(', ')} WHERE id = $${vals.length+1} RETURNING *`;
      vals.push(id);
      const rows = await sql(q, vals);
      if (!rows[0]) return res.status(404).json({ message: "Shop not found" });
      res.json(toShop(rows[0]));
    } catch (e: any) { console.error("shop update error:", e); res.status(500).json({ message: "Failed to update shop" }); }
  });

  app.post("/api/shops/:id/like", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
      const rows = await sql`UPDATE shops SET like_count = like_count + 1 WHERE id = ${id} RETURNING like_count`;
      res.json({ likeCount: rows[0]?.like_count });
    } catch (e: any) { res.status(500).json({ message: "Failed to like shop" }); }
  });

  // ─── クーポン ───
  function toCoupon(r: any) {
    return { ...r, shopId: r.shop_id, discountType: r.discount_type, discountValue: r.discount_value, isFirstTimeOnly: r.is_first_time_only, isLineAccountCoupon: r.is_line_account_coupon, isActive: r.is_active, validFrom: r.valid_from, validUntil: r.valid_until, expiryDate: r.expiry_date, createdAt: r.created_at, updatedAt: r.updated_at };
  }

  app.get("/api/shops/:id/coupons", async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
      const rows = await sql`SELECT * FROM coupons WHERE shop_id = ${shopId} ORDER BY updated_at DESC`;
      res.json(rows.map(toCoupon));
    } catch (e: any) { res.status(500).json({ message: "Failed to fetch coupons" }); }
  });

  app.post("/api/shops/:id/coupons", async (req, res) => {
    try {
      const shopId = parseInt(req.params.id);
      if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
      const b = req.body;
      const rows = await sql`INSERT INTO coupons (shop_id, title, description, discount, discount_type, discount_value, expiry_date, is_first_time_only, is_line_account_coupon, is_active)
        VALUES (${shopId}, ${b.title||''}, ${b.description||null}, ${b.discount||null}, ${b.discountType||'FREE'}, ${b.discountValue||0}, ${b.expiryDate||null}, ${b.isFirstTimeOnly||false}, ${b.isLineAccountCoupon||false}, ${b.isActive!==false}) RETURNING *`;
      res.status(201).json(toCoupon(rows[0]));
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Failed to create coupon" }); }
  });

  app.get("/api/coupons", async (_req, res) => {
    try { res.json((await sql`SELECT * FROM coupons ORDER BY updated_at DESC`).map(toCoupon)); }
    catch (e: any) { res.status(500).json({ message: "Failed to fetch coupons" }); }
  });

  app.put("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid coupon ID" });
      const b = req.body;
      const setClauses: string[] = []; const vals: any[] = [];
      const fields: Record<string, string> = { title: 'title', description: 'description', discount: 'discount', discountType: 'discount_type', discountValue: 'discount_value', expiryDate: 'expiry_date', isFirstTimeOnly: 'is_first_time_only', isLineAccountCoupon: 'is_line_account_coupon', isActive: 'is_active' };
      for (const [jsKey, dbCol] of Object.entries(fields)) {
        if (b[jsKey] !== undefined) { setClauses.push(`${dbCol} = $${vals.length+1}`); vals.push(b[jsKey]); }
      }
      if (setClauses.length === 0) { const r = await sql`SELECT * FROM coupons WHERE id = ${id}`; return res.json(toCoupon(r[0])); }
      setClauses.push('updated_at = NOW()');
      const rows = await sql(`UPDATE coupons SET ${setClauses.join(', ')} WHERE id = $${vals.length+1} RETURNING *`, [...vals, id]);
      if (!rows[0]) return res.status(404).json({ message: "Coupon not found" });
      res.json(toCoupon(rows[0]));
    } catch (e: any) { console.error(e); res.status(500).json({ message: "Failed to update coupon" }); }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid coupon ID" });
      const rows = await sql`DELETE FROM coupons WHERE id = ${id} RETURNING id`;
      if (!rows[0]) return res.status(404).json({ message: "Coupon not found" });
      res.json({ message: "Coupon deleted" });
    } catch (e: any) { res.status(500).json({ message: "Failed to delete coupon" }); }
  });

  // ─── 認証 ───
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ message: "Username and password required" });
      const rows = await sql`SELECT * FROM users WHERE username = ${username}`;
      const user = rows[0];
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      const valid = user.password_hash === password || hashPassword(password) === user.password_hash;
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      const payload = { userId: user.id, role: user.role, shopId: user.shop_id, exp: Date.now() + 7*24*60*60*1000 };
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
    } catch (e: any) { res.status(401).json({ message: "Invalid token" }); }
  });

  // ─── スタッフ ───
  app.get("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await seedShopIfEmpty(shopId);
      const rows = await sql`SELECT * FROM booking_staff WHERE shop_id = ${shopId} AND is_active = true ORDER BY id`;
      const courses = await sql`SELECT id, staff_ids FROM booking_courses WHERE shop_id = ${shopId} AND is_active = true`;
      res.json(rows.map((s: any) => ({
        id: s.id.toString(), name: s.name, role: s.role||"", avatar: s.avatar||"",
        courseIds: courses.filter((c: any) => (c.staff_ids||[]).includes(s.id.toString())).map((c: any) => c.id.toString()),
      })));
    } catch (e: any) { console.error("staff error:", e); res.status(500).json({ message: "Failed to fetch staff" }); }
  });

  app.post("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { name, role, avatar } = req.body;
      const rows = await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${name||''}, ${role||''}, ${avatar||''}) RETURNING *`;
      const s = rows[0];
      res.status(201).json({ id: s.id.toString(), name: s.name, role: s.role, avatar: s.avatar, courseIds: [] });
    } catch (e: any) { res.status(500).json({ message: "Failed to create staff" }); }
  });

  app.put("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { id, name, role, avatar } = req.body;
      await sql`UPDATE booking_staff SET name=${name||''}, role=${role||''}, avatar=${avatar||''} WHERE id=${parseInt(id)} AND shop_id=${shopId}`;
      res.json({ id: id.toString(), name, role, avatar });
    } catch (e: any) { res.status(500).json({ message: "Failed to update staff" }); }
  });

  app.delete("/api/shops/:shopId/staff", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await sql`UPDATE booking_staff SET is_active=false WHERE id=${parseInt(req.query.id as string)} AND shop_id=${shopId}`;
      res.json({ message: "Staff deleted" });
    } catch (e: any) { res.status(500).json({ message: "Failed to delete staff" }); }
  });

  // ─── コース ───
  function toCourse(c: any) {
    return { id: c.id.toString(), name: c.name, category: c.category||"", duration: c.duration||60, price: c.price||0, description: c.description||"", prepaymentOnly: c.prepayment_only||false, imageUrl: c.image_url||null, staffIds: (c.staff_ids||[]).map((x: any)=>x.toString()) };
  }

  app.get("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await seedShopIfEmpty(shopId);
      const rows = await sql`SELECT * FROM booking_courses WHERE shop_id=${shopId} AND is_active=true ORDER BY id`;
      res.json(rows.map(toCourse));
    } catch (e: any) { console.error("courses error:", e); res.status(500).json({ message: "Failed to fetch courses" }); }
  });

  app.post("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { name, category, duration, price, description, prepaymentOnly, imageUrl, staffIds } = req.body;
      const rows = await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, image_url, staff_ids)
        VALUES (${shopId}, ${name||''}, ${category||''}, ${duration||60}, ${price||0}, ${description||''}, ${prepaymentOnly||false}, ${imageUrl||null}, ${staffIds||[]}) RETURNING *`;
      res.status(201).json(toCourse(rows[0]));
    } catch (e: any) { res.status(500).json({ message: "Failed to create course" }); }
  });

  app.put("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { id, name, category, duration, price, description, prepaymentOnly, imageUrl, staffIds } = req.body;
      const rows = await sql`UPDATE booking_courses SET name=${name||''}, category=${category||''}, duration=${duration||60}, price=${price||0}, description=${description||''}, prepayment_only=${prepaymentOnly||false}, image_url=${imageUrl||null}, staff_ids=${staffIds||[]}, updated_at=NOW()
        WHERE id=${parseInt(id)} AND shop_id=${shopId} RETURNING *`;
      if (!rows[0]) return res.status(404).json({ message: "Course not found" });
      res.json(toCourse(rows[0]));
    } catch (e: any) { res.status(500).json({ message: "Failed to update course" }); }
  });

  app.delete("/api/shops/:shopId/courses", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await sql`UPDATE booking_courses SET is_active=false WHERE id=${parseInt(req.query.id as string)} AND shop_id=${shopId}`;
      res.json({ message: "Course deleted" });
    } catch (e: any) { res.status(500).json({ message: "Failed to delete course" }); }
  });

  // ─── スロット ───
  app.get("/api/shops/:shopId/slots", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const date = req.query.date as string;
      const slots: string[] = [];
      for (let h = 10; h <= 18; h++) { slots.push(`${String(h).padStart(2,"0")}:00`); if (h<18) slots.push(`${String(h).padStart(2,"0")}:30`); }
      if (!date) return res.json(slots.map(t=>({time:t,available:true})));
      const booked = await sql`SELECT time FROM booking_reservations WHERE shop_id=${shopId} AND date=${date} AND status!='cancelled'`;
      const bookedSet = new Set(booked.map((r: any)=>r.time));
      res.json(slots.map(t=>({time:t,available:!bookedSet.has(t)})));
    } catch (e: any) { res.status(500).json({ message: "Failed to fetch slots" }); }
  });

  app.put("/api/shops/:shopId/slots", async (_req, res) => res.json({ ok: true }));
  app.post("/api/shops/:shopId/slots", async (_req, res) => res.json({ ok: true }));

  // ─── 設定 ───
  app.get("/api/shops/:shopId/settings", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await seedShopIfEmpty(shopId);
      const rows = await sql`SELECT * FROM booking_settings WHERE shop_id=${shopId}`;
      if (rows[0]) {
        const s = rows[0];
        return res.json({ store_name: s.store_name||"", store_description: s.store_description||"", store_address: s.store_address||"", store_phone: s.store_phone||"", store_email: s.store_email||"", store_hours: s.store_hours||"", store_closed_days: s.store_closed_days||"", banner_url: s.banner_url||"", staff_selection_enabled: s.staff_selection_enabled||"false" });
      }
      const shopRows = await sql`SELECT * FROM shops WHERE id=${shopId}`;
      if (!shopRows[0]) return res.status(404).json({ message: "Shop not found" });
      const s = shopRows[0];
      res.json({ store_name: s.name||"", store_description: s.description||"", store_address: s.address||"", store_phone: s.phone||"", store_email: "", store_hours: s.hours||"", store_closed_days: s.closed_days||"", banner_url: s.image_url||"", staff_selection_enabled: s.enable_staff_assignment?"true":"false" });
    } catch (e: any) { console.error("settings error:", e); res.status(500).json({ message: "Failed to fetch settings" }); }
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
    } catch (e: any) { res.status(500).json({ message: "Failed to update settings" }); }
  });

  // ─── 予約 ───
  function toReservation(r: any) {
    return { id: r.id.toString(), customerName: r.customer_name, customerPhone: r.customer_phone||undefined, customerEmail: r.customer_email||undefined, date: r.date, time: r.time, staffId: r.staff_id||"__shop__", courseId: r.course_id, status: r.status||"confirmed", paid: r.paid||false, reservationToken: r.cancel_token||undefined };
  }

  app.get("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const rows = await sql`SELECT * FROM booking_reservations WHERE shop_id=${shopId} ORDER BY date DESC, time DESC`;
      res.json(rows.map(toReservation));
    } catch (e: any) { res.status(500).json({ message: "Failed to fetch reservations" }); }
  });

  app.post("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { customerName, customerPhone, customerEmail, date, time, staffId, courseId } = req.body;
      if (!customerName || !date || !time || !courseId) return res.status(400).json({ message: "Missing required fields" });
      const token = crypto.randomUUID().replace(/-/g,"");
      const rows = await sql`INSERT INTO booking_reservations (shop_id, customer_name, customer_phone, customer_email, date, time, staff_id, course_id, status, paid, cancel_token)
        VALUES (${shopId}, ${customerName}, ${customerPhone||null}, ${customerEmail||null}, ${date}, ${time}, ${staffId||'__shop__'}, ${courseId.toString()}, 'confirmed', false, ${token}) RETURNING *`;
      res.status(201).json(toReservation(rows[0]));
    } catch (e: any) { console.error("reservation error:", e); res.status(500).json({ message: "Failed to create reservation" }); }
  });

  app.put("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const { id, status, paid, customerName, customerPhone, customerEmail, date, time } = req.body;
      const setClauses: string[] = []; const vals: any[] = [];
      if (status !== undefined) { setClauses.push(`status=$${vals.length+1}`); vals.push(status); }
      if (paid !== undefined) { setClauses.push(`paid=$${vals.length+1}`); vals.push(paid); }
      if (customerName) { setClauses.push(`customer_name=$${vals.length+1}`); vals.push(customerName); }
      if (customerPhone) { setClauses.push(`customer_phone=$${vals.length+1}`); vals.push(customerPhone); }
      if (customerEmail) { setClauses.push(`customer_email=$${vals.length+1}`); vals.push(customerEmail); }
      if (date) { setClauses.push(`date=$${vals.length+1}`); vals.push(date); }
      if (time) { setClauses.push(`time=$${vals.length+1}`); vals.push(time); }
      if (setClauses.length === 0) return res.status(400).json({ message: "No fields to update" });
      const rows = await sql(`UPDATE booking_reservations SET ${setClauses.join(',')} WHERE id=$${vals.length+1} AND shop_id=$${vals.length+2} RETURNING *`, [...vals, parseInt(id), shopId]);
      if (!rows[0]) return res.status(404).json({ message: "Reservation not found" });
      res.json(toReservation(rows[0]));
    } catch (e: any) { res.status(500).json({ message: "Failed to update reservation" }); }
  });

  app.delete("/api/shops/:shopId/reservations", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      await sql`DELETE FROM booking_reservations WHERE id=${parseInt(req.query.id as string)} AND shop_id=${shopId}`;
      res.json({ message: "Reservation deleted" });
    } catch (e: any) { res.status(500).json({ message: "Failed to delete reservation" }); }
  });

  // ─── キャンセル ───
  app.get("/api/shops/:shopId/cancel/:token", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const rows = await sql`
        SELECT r.*, c.name as course_name, c.duration as course_duration, c.price as course_price
        FROM booking_reservations r
        LEFT JOIN booking_courses c ON c.id::text = r.course_id AND c.shop_id = ${shopId}
        WHERE r.cancel_token=${req.params.token} AND r.shop_id=${shopId}`;
      if (!rows[0]) return res.status(404).json({ message: "Reservation not found" });
      const r = rows[0];
      res.json({ id: r.id.toString(), customerName: r.customer_name, date: r.date, time: r.time, courseId: r.course_id, courseName: r.course_name||"コース", courseDuration: r.course_duration||60, coursePrice: r.course_price||0, status: r.status });
    } catch (e: any) { res.status(500).json({ message: "Failed to fetch reservation" }); }
  });

  app.post("/api/shops/:shopId/cancel/:token", async (req, res) => {
    const shopId = parseInt(req.params.shopId);
    if (isNaN(shopId)) return res.status(400).json({ message: "Invalid shop ID" });
    try {
      const rows = await sql`SELECT status FROM booking_reservations WHERE cancel_token=${req.params.token} AND shop_id=${shopId}`;
      if (!rows[0]) return res.status(404).json({ message: "Reservation not found" });
      if (rows[0].status === "cancelled") return res.json({ ok: true, already: true });
      await sql`UPDATE booking_reservations SET status='cancelled' WHERE cancel_token=${req.params.token} AND shop_id=${shopId}`;
      res.json({ ok: true });
    } catch (e: any) { res.status(500).json({ message: "Failed to cancel reservation" }); }
  });

  // ─── 問い合わせ ───
  app.post("/api/shops/:shopId/inquiries", async (_req, res) => res.status(201).json({ ok: true }));
  app.get("/api/shops/:shopId/inquiries", async (_req, res) => res.json([]));

  // ─── Error handler ───
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Internal error:", err);
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  });

  export default async function handler(req: VercelRequest, res: VercelResponse) {
    return app(req as any, res as any);
  }
  