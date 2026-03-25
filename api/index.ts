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
      const rows = await sql`INSERT INTO shops (
        slug, name, description, area_id, area, category, subcategory,
        address, phone, hours, closed_days, website, display_order,
        line_account_url, image_url, gallery_image_urls,
        is_active, enable_staff_assignment, reservation_url, reservation_image_url, like_count
      ) VALUES (
        ${slug}, ${b.name||''}, ${b.description||''}, ${b.areaId||1}, ${b.area||''}, ${b.category||''}, ${b.subcategory||null},
        ${b.address||''}, ${b.phone||null}, ${b.hours||null}, ${b.closedDays||null}, ${b.website||null}, ${b.displayOrder||0},
        ${b.lineAccountUrl||null}, ${b.imageUrl||''}, ${b.galleryImageUrls||[]},
        ${b.isActive!==false}, ${b.enableStaffAssignment||false}, ${b.reservationUrl||null}, ${b.reservationImageUrl||null}, ${b.likeCount||0}
      ) RETURNING *`;
      res.status(201).json(toShop(rows[0]));
    } catch (e: any) { console.error("shop create error:", e); res.status(500).json({ message: "Failed to create shop" }); }
  })

);

  app.put("/api/shops/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid shop ID" });
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

);

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

);

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
      const resId = parseInt(id);
      if (isNaN(resId)) return res.status(400).json({ message: "Invalid reservation ID" });
      // Update each field with tagged template literals
      if (status !== undefined) await sql`UPDATE booking_reservations SET status=${status} WHERE id=${resId} AND shop_id=${shopId}`;
      if (paid !== undefined) await sql`UPDATE booking_reservations SET paid=${paid} WHERE id=${resId} AND shop_id=${shopId}`;
      if (customerName !== undefined) await sql`UPDATE booking_reservations SET customer_name=${customerName} WHERE id=${resId} AND shop_id=${shopId}`;
      if (customerPhone !== undefined) await sql`UPDATE booking_reservations SET customer_phone=${customerPhone} WHERE id=${resId} AND shop_id=${shopId}`;
      if (customerEmail !== undefined) await sql`UPDATE booking_reservations SET customer_email=${customerEmail} WHERE id=${resId} AND shop_id=${shopId}`;
      if (date !== undefined) await sql`UPDATE booking_reservations SET date=${date} WHERE id=${resId} AND shop_id=${shopId}`;
      if (time !== undefined) await sql`UPDATE booking_reservations SET time=${time} WHERE id=${resId} AND shop_id=${shopId}`;
      const rows = await sql`SELECT * FROM booking_reservations WHERE id=${resId} AND shop_id=${shopId}`;
      if (!rows[0]) return res.status(404).json({ message: "Reservation not found" });
      res.json(toReservation(rows[0]));
    } catch (e: any) { console.error("res update error:", e); res.status(500).json({ message: "Failed to update reservation" }); }
  });

);

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

  
  // ─── テストデータ一括生成 ───
  app.post("/api/seed-test", async (_req, res) => {
    try {
      const existing = await sql`SELECT id FROM shops WHERE slug = 'test-salon-hanagokoro'`;
      let shopId: number;
      if (existing.length > 0) {
        shopId = existing[0].id;
        await sql`DELETE FROM booking_courses WHERE shop_id = ${shopId}`;
        await sql`DELETE FROM booking_staff WHERE shop_id = ${shopId}`;
        await sql`DELETE FROM booking_settings WHERE shop_id = ${shopId}`;
        await sql`DELETE FROM booking_reservations WHERE shop_id = ${shopId}`;
        await sql`DELETE FROM coupons WHERE shop_id = ${shopId}`;
        await sql`UPDATE shops SET
          name='総合サロン はなごころ', description='小田原駅徒歩5分。ヘア・エステ・ネイル・リラクゼーションを一か所で。完全予約制の上質な空間。',
          area_id=1, area='小田原', category='美容', subcategory='トータルビューティー',
          address='神奈川県小田原市南町2-3-15 はなごころビル2F', phone='0465-33-8899',
          hours='10:00〜20:00（最終受付 19:00）', closed_days='毎週火曜日・第1月曜日',
          website='https://salon-hanagokoro.jp', display_order=99,
          line_account_url='https://line.me/R/ti/p/@salon-hanagokoro',
          image_url='https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
          gallery_image_urls=ARRAY['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80','https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80','https://images.unsplash.com/photo-1573461160327-a85cf5a11ad5?w=800&q=80'],
          is_active=true, enable_staff_assignment=true, like_count=56, updated_at=NOW()
          WHERE id=${shopId}`;
      } else {
        const shopRows = await sql`INSERT INTO shops (
          slug, name, description, area_id, area, category, subcategory,
          address, phone, hours, closed_days, website, display_order,
          line_account_url, image_url, gallery_image_urls,
          is_active, enable_staff_assignment, like_count
        ) VALUES (
          'test-salon-hanagokoro', '総合サロン はなごころ',
          '小田原駅徒歩5分。ヘア・エステ・ネイル・リラクゼーションを一か所で。完全予約制の上質な空間。',
          1, '小田原', '美容', 'トータルビューティー',
          '神奈川県小田原市南町2-3-15 はなごころビル2F', '0465-33-8899',
          '10:00〜20:00（最終受付 19:00）', '毎週火曜日・第1月曜日',
          'https://salon-hanagokoro.jp', 99,
          'https://line.me/R/ti/p/@salon-hanagokoro',
          'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80',
          ARRAY['https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&q=80','https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=800&q=80','https://images.unsplash.com/photo-1573461160327-a85cf5a11ad5?w=800&q=80'],
          true, true, 56
        ) RETURNING id`;
        shopId = shopRows[0].id;
      }
      await sql`UPDATE shops SET reservation_url = '/app/reservation/' || ${shopId}::text WHERE id = ${shopId}`;

      // ─── スタッフ4名 ───
      const staffData = [
        { name: "山田 咲花", role: "オーナーサロニスト", avatar: "山咲" },
        { name: "中村 恵理", role: "シニアスタイリスト", avatar: "中恵" },
        { name: "木村 美羽", role: "エステシャン", avatar: "木美" },
        { name: "林 桜子", role: "ネイリスト", avatar: "林桜" },
      ];
      const sIds: string[] = [];
      for (const st of staffData) {
        const row = await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${st.name}, ${st.role}, ${st.avatar}) RETURNING id`;
        sIds.push(row[0].id.toString());
      }

      // ─── コース15件 ───
      const coursesData = [
        { name: "スタンダードカット", category: "ヘア", duration: 60, price: 4400, description: "カウンセリング・シャンプー・カット・ブロー込み。季節に合わせたスタイル提案。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1592339637627-3568de3c91dc?w=600&q=80", sIdxs: [0,1] },
        { name: "カット＋カラー（フルカラー）", category: "ヘア", duration: 150, price: 12800, description: "カットとオーガニックフルカラーのセット。ダメージを最小限に抑えた上質なカラーリング。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1522337660859-02fbefca4702?w=600&q=80", sIdxs: [0,1] },
        { name: "カット＋ハイライトカラー", category: "ヘア", duration: 180, price: 18500, description: "立体感を演出するハイライトカラー＋カット。外国人風スタイルや旬の透明感カラーに対応。", prepaymentOnly: true, imageUrl: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=600&q=80", sIdxs: [0] },
        { name: "デジタルパーマ（カット込み）", category: "ヘア", duration: 210, price: 22000, description: "熱を使い持続性・再現性の高いウェーブを実現。スタイリングが楽になる人気メニュー。", prepaymentOnly: true, imageUrl: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=600&q=80", sIdxs: [0,1] },
        { name: "縮毛矯正（ストレートパーマ）", category: "ヘア", duration: 240, price: 28600, description: "くせ毛・うねりを根本から改善。艶やかなストレートヘアを実現する高技術メニュー。", prepaymentOnly: true, imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80", sIdxs: [0] },
        { name: "フェイシャルエステ（60分）", category: "エステ", duration: 60, price: 8800, description: "毛穴洗浄・保湿・引き締めの3ステップで透明感のある肌へ。最新機器使用。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&q=80", sIdxs: [2] },
        { name: "フェイシャルエステ（90分・プレミアム）", category: "エステ", duration: 90, price: 14300, description: "クレンジング・スチーム・超音波・高周波・保湿パックの本格コース。特別な日の前に。", prepaymentOnly: true, imageUrl: "https://images.unsplash.com/photo-1552693673-1bf958298935?w=600&q=80", sIdxs: [2] },
        { name: "痩身エステ（ボディ60分）", category: "エステ", duration: 60, price: 11000, description: "EMSとキャビテーションを組み合わせた本格ボディケア。気になる部位に集中アプローチ。", prepaymentOnly: true, imageUrl: "https://images.unsplash.com/photo-1540555700478-4be289fbecef?w=600&q=80", sIdxs: [2] },
        { name: "毛穴クレンジング（ハイドラフェイシャル）", category: "エステ", duration: 45, price: 6600, description: "水流を使って毛穴の黒ずみや皮脂を徹底除去。ダウンタイムなしで即効性あり。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1573461160327-a85cf5a11ad5?w=600&q=80", sIdxs: [2] },
        { name: "ジェルネイル（手・ワンカラー）", category: "ネイル", duration: 90, price: 6600, description: "ワンカラーのシンプルジェルネイル。オフ込みで仕上がりが美しい人気定番メニュー。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80", sIdxs: [3] },
        { name: "ジェルネイル（手・アート込み）", category: "ネイル", duration: 120, price: 9900, description: "季節感のあるアートデザイン込みジェルネイル。SNS映えするスタイリッシュなデザイン。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80", sIdxs: [3] },
        { name: "フットネイル（ペディキュア＋ジェル）", category: "ネイル", duration: 90, price: 7700, description: "フット角質ケア・ペディキュア・ジェルカラーのフルコース。夏のサンダルシーズンに。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=600&q=80", sIdxs: [3] },
        { name: "アロマトリートメント（60分）", category: "リラクゼーション", duration: 60, price: 9900, description: "厳選された天然アロマオイルを使ったスウェディッシュマッサージ。心身の疲れを癒します。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=600&q=80", sIdxs: [2] },
        { name: "ヘッドスパ（炭酸泉＋マッサージ45分）", category: "リラクゼーション", duration: 45, price: 5500, description: "炭酸泉シャンプー後に頭皮マッサージ。血行促進・育毛・リフレッシュ効果が高い人気メニュー。", prepaymentOnly: false, imageUrl: "https://images.unsplash.com/photo-1519823551278-64ac92734fb1?w=600&q=80", sIdxs: [0,1] },
        { name: "総合美容フルコース（3時間）", category: "プレミアム", duration: 180, price: 39600, description: "カット＋カラー＋フェイシャルエステ＋ヘッドスパの贅沢コース。特別な日に最高の自分に。", prepaymentOnly: true, imageUrl: "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=600&q=80", sIdxs: [0,1,2,3] },
      ];
      const createdCourseIds: string[] = [];
      for (const c of coursesData) {
        const staffIdsForCourse = c.sIdxs.map((i: number) => sIds[i]);
        const row = await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, image_url, staff_ids)
          VALUES (${shopId}, ${c.name}, ${c.category}, ${c.duration}, ${c.price}, ${c.description}, ${c.prepaymentOnly}, ${c.imageUrl}, ${staffIdsForCourse}) RETURNING id`;
        createdCourseIds.push(row[0].id.toString());
      }

      // ─── 設定 ───
      await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_email, store_hours, store_closed_days, banner_url, staff_selection_enabled)
        VALUES (${shopId}, '総合サロン はなごころ', '小田原駅徒歩5分。ヘア・エステ・ネイル・リラクゼーションを一か所で。', '神奈川県小田原市南町2-3-15 はなごころビル2F', '0465-33-8899', 'info@salon-hanagokoro.jp', '10:00〜20:00（最終受付19:00）', '毎週火曜日・第1月曜日', 'https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80', 'true')
        ON CONFLICT (shop_id) DO UPDATE SET store_name='総合サロン はなごころ', store_description='小田原駅徒歩5分。ヘア・エステ・ネイル・リラクゼーションを一か所で。', store_address='神奈川県小田原市南町2-3-15 はなごころビル2F', store_phone='0465-33-8899', store_email='info@salon-hanagokoro.jp', store_hours='10:00〜20:00（最終受付19:00）', store_closed_days='毎週火曜日・第1月曜日', banner_url='https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&q=80', staff_selection_enabled='true', updated_at=NOW()`;

      // ─── クーポン5枚 ───
      const cps = [
        { title: "新規お客様限定20%OFF", description: "ご新規様全メニュー20%割引", discountType: "PERCENTAGE", discountValue: 20, expiryDate: "2026-09-30", isFirstTimeOnly: true, isLineAccountCoupon: false },
        { title: "LINEお友達追加500円OFF", description: "LINEお友達追加で次回ご来店時500円割引", discountType: "AMOUNT", discountValue: 500, expiryDate: "2026-12-31", isFirstTimeOnly: false, isLineAccountCoupon: true },
        { title: "誕生月特典 ヘッドスパ無料", description: "お誕生月のお客様にヘッドスパ（通常¥5,500）を無料プレゼント", discountType: "FREE", discountValue: 0, expiryDate: "2026-12-31", isFirstTimeOnly: false, isLineAccountCoupon: false },
        { title: "春の美容応援1,000円OFF", description: "フェイシャル・痩身エステご利用で1,000円引き（6月末まで）", discountType: "AMOUNT", discountValue: 1000, expiryDate: "2026-06-30", isFirstTimeOnly: false, isLineAccountCoupon: false },
        { title: "平日午前10%OFF", description: "平日10:00〜12:00のご予約で全メニュー10%割引", discountType: "PERCENTAGE", discountValue: 10, expiryDate: "2026-09-30", isFirstTimeOnly: false, isLineAccountCoupon: false },
      ];
      for (const cp of cps) {
        await sql`INSERT INTO coupons (shop_id, title, description, discount_type, discount_value, expiry_date, is_first_time_only, is_line_account_coupon, is_active)
          VALUES (${shopId}, ${cp.title}, ${cp.description}, ${cp.discountType}::discount_type, ${cp.discountValue}, ${cp.expiryDate}, ${cp.isFirstTimeOnly}, ${cp.isLineAccountCoupon}, true)`;
      }

      // ─── テスト予約5件 ───
      const rvs = [
        { name: "田中 花子", phone: "090-1111-2222", email: "hanako@example.com", date: "2026-04-05", time: "10:00", ci: 0, si: 0, status: "confirmed", paid: false },
        { name: "鈴木 恵美", phone: "080-3333-4444", email: "emi@example.com", date: "2026-04-07", time: "13:00", ci: 1, si: 1, status: "confirmed", paid: false },
        { name: "山本 真奈", phone: "070-5555-6666", email: "mana@example.com", date: "2026-04-10", time: "14:30", ci: 5, si: 2, status: "confirmed", paid: true },
        { name: "伊藤 さくら", phone: "090-7777-8888", email: "sakura@example.com", date: "2026-03-20", time: "11:00", ci: 9, si: 3, status: "visited", paid: true },
        { name: "渡辺 美里", phone: "080-9999-0000", email: "misato@example.com", date: "2026-03-15", time: "15:00", ci: 12, si: 2, status: "cancelled", paid: false },
      ];
      for (const rv of rvs) {
        const tkn = crypto.randomUUID().replace(/-/g,"");
        await sql`INSERT INTO booking_reservations (shop_id, customer_name, customer_phone, customer_email, date, time, course_id, staff_id, status, paid, cancel_token)
          VALUES (${shopId}, ${rv.name}, ${rv.phone}, ${rv.email}, ${rv.date}, ${rv.time}, ${createdCourseIds[rv.ci]}, ${sIds[rv.si]}, ${rv.status}, ${rv.paid}, ${tkn})`;
      }

      res.json({ ok: true, shopId, staffCount: sIds.length, courseCount: coursesData.length, couponCount: cps.length, reservationCount: rvs.length });
    } catch (e: any) { console.error("seed-test error:", e); res.status(500).json({ message: "Seed test failed", error: e.message }); }
  });

  
  // ─── 店舗15件一括生成 ───
  app.post("/api/seed-shops", async (_req, res) => {
    try {
      const results: any[] = [];

      // ─── 新規追加店舗11件の定義 ───
      const newShops = [
        {
          slug: "odawara-sushi-takumi", name: "小田原鮨処 匠", area_id: 1, area: "小田原", category: "グルメ", subcategory: "寿司・和食",
          description: "小田原の新鮮魚介を使った本格江戸前寿司。地魚にこだわり、職人が丁寧に握る一品一品をご堪能ください。",
          address: "神奈川県小田原市魚町1-5-8", phone: "0465-22-3456", hours: "11:30〜22:00（L.O. 21:00）", closed_days: "毎週月曜日",
          image_url: "https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1617196034183-421b4040ed20?w=800&q=80","https://images.unsplash.com/photo-1553621042-f6e147245754?w=800&q=80","https://images.unsplash.com/photo-1559410545-0bdcd187e0a6?w=800&q=80"],
          display_order: 85, line_account_url: null, reservation_url: null, enable_staff_assignment: false, like_count: 38,
          coupons: [{ title: "平日ランチ特別割引10%OFF", description: "平日11:30〜14:00のランチタイムに全品10%割引", discount_type: "PERCENTAGE", discount_value: 10, expiry_date: "2026-09-30", is_first_time_only: false, is_line_account_coupon: false }]
        },
        {
          slug: "yamato-cafe-ameli", name: "大和カフェ アメリ", area_id: 2, area: "大和", category: "グルメ", subcategory: "カフェ",
          description: "大和駅徒歩3分。自家焙煎コーヒーと手作りスイーツが自慢の居心地の良いカフェ。テラス席あり。",
          address: "神奈川県大和市大和東1-3-22", phone: "046-260-7788", hours: "8:00〜20:00", closed_days: "不定休",
          image_url: "https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=800&q=80","https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=800&q=80","https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=800&q=80"],
          display_order: 80, line_account_url: "https://line.me/R/ti/p/@cafe-ameli", reservation_url: null, enable_staff_assignment: false, like_count: 62,
          coupons: [
            { title: "モーニングセット100円OFF", description: "8:00〜10:00モーニングセットご注文で100円割引", discount_type: "AMOUNT", discount_value: 100, expiry_date: "2026-12-31", is_first_time_only: false, is_line_account_coupon: false },
            { title: "LINE友達登録でドリンク1杯無料", description: "LINEお友達登録のお客様にドリンク1杯サービス", discount_type: "FREE", discount_value: 0, expiry_date: "2026-12-31", is_first_time_only: true, is_line_account_coupon: true }
          ]
        },
        {
          slug: "hadano-seikotsu-takahashi", name: "秦野整骨院 たかはし", area_id: 3, area: "秦野", category: "美容・健康", subcategory: "整骨・整体",
          description: "国家資格取得の柔道整復師が対応。肩こり・腰痛・スポーツ障害など幅広く対応。予約優先制で待ち時間少なめ。",
          address: "神奈川県秦野市曲松1-2-5", phone: "0463-81-5566", hours: "9:00〜20:00", closed_days: "日曜・祝日",
          image_url: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?w=800&q=80","https://images.unsplash.com/photo-1559757148-5c350d0d3c56?w=800&q=80","https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=800&q=80"],
          display_order: 75, line_account_url: "https://line.me/R/ti/p/@takahashi-seikotsu", reservation_url: "PLACEHOLDER", enable_staff_assignment: true, like_count: 29,
          coupons: [{ title: "初回施術1,000円OFF", description: "初めてのお客様限定！初回施術料金から1,000円割引", discount_type: "AMOUNT", discount_value: 1000, expiry_date: "2026-12-31", is_first_time_only: true, is_line_account_coupon: false }],
          booking: {
            staff: [{ name: "高橋 誠", role: "院長・柔道整復師", avatar: "高誠" }, { name: "村田 彩", role: "柔道整復師", avatar: "村彩" }],
            courses: [
              { name: "肩こり・腰痛コース（30分）", category: "整体", duration: 30, price: 3300, description: "肩こり・腰痛専用の集中整体コース。", prepayment_only: false },
              { name: "全身バランス調整（60分）", category: "整体", duration: 60, price: 5500, description: "全身のバランスを整える本格施術コース。", prepayment_only: false },
              { name: "スポーツ障害ケア（45分）", category: "スポーツ", duration: 45, price: 4400, description: "スポーツによる疲労・障害に特化したケア。", prepayment_only: false },
              { name: "骨盤矯正コース（50分）", category: "矯正", duration: 50, price: 6600, description: "産後ケアや姿勢改善に効果的な骨盤矯正。", prepayment_only: false },
            ],
            settings: { store_name: "秦野整骨院 たかはし", store_address: "神奈川県秦野市曲松1-2-5", store_phone: "0463-81-5566", store_email: "info@takahashi-seikotsu.jp", store_hours: "9:00〜20:00", store_closed_days: "日曜・祝日", staff_selection_enabled: "true" }
          }
        },
        {
          slug: "hiratsuka-yakiniku-toragyu", name: "平塚焼肉 虎牛", area_id: 4, area: "平塚", category: "グルメ", subcategory: "焼肉",
          description: "国産黒毛和牛専門の本格焼肉店。特上ロース・カルビ・ハラミはじめ、希少部位も取り揃えています。個室完備。",
          address: "神奈川県平塚市紅谷町3-1 虎牛ビル1F", phone: "0463-21-8877", hours: "17:00〜23:00（L.O. 22:00）", closed_days: "毎週火曜日",
          image_url: "https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1544025162-d76694265947?w=800&q=80","https://images.unsplash.com/photo-1558030006-450675393462?w=800&q=80","https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?w=800&q=80"],
          display_order: 70, line_account_url: null, reservation_url: null, enable_staff_assignment: false, like_count: 45,
          coupons: [
            { title: "平日ディナー1人1,000円OFF", description: "平日17:00〜19:00入店で1人1,000円割引（2名以上）", discount_type: "AMOUNT", discount_value: 1000, expiry_date: "2026-09-30", is_first_time_only: false, is_line_account_coupon: false },
            { title: "誕生日特典 デザートプレート無料", description: "お誕生日月のお客様にデザートプレートをプレゼント", discount_type: "FREE", discount_value: 0, expiry_date: "2026-12-31", is_first_time_only: false, is_line_account_coupon: false }
          ]
        },
        {
          slug: "atsugi-fitness-peak", name: "厚木フィットネス PEAK", area_id: 5, area: "厚木", category: "レジャー・体験", subcategory: "スポーツジム",
          description: "最新マシン完備の24時間ジム。パーソナルトレーニング・ヨガ・ピラティスのレッスンも充実。入会金無料キャンペーン中。",
          address: "神奈川県厚木市中町2-4-8 PEAKビル3F", phone: "046-223-4455", hours: "24時間営業", closed_days: "年中無休",
          image_url: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=800&q=80","https://images.unsplash.com/photo-1549060279-7e168fcee0c2?w=800&q=80","https://images.unsplash.com/photo-1534438327276-14e5300c3a48?w=800&q=80"],
          display_order: 65, line_account_url: "https://line.me/R/ti/p/@fitness-peak", reservation_url: "PLACEHOLDER", enable_staff_assignment: true, like_count: 77,
          coupons: [{ title: "体験レッスン500円（通常3,300円）", description: "初回体験レッスン限定価格500円でご参加いただけます", discount_type: "AMOUNT", discount_value: 2800, expiry_date: "2026-06-30", is_first_time_only: true, is_line_account_coupon: false }],
          booking: {
            staff: [{ name: "松田 健二", role: "パーソナルトレーナー", avatar: "松健" }, { name: "岡田 さやか", role: "ヨガインストラクター", avatar: "岡さ" }, { name: "川口 大輝", role: "ピラティスインストラクター", avatar: "川大" }],
            courses: [
              { name: "パーソナルトレーニング（60分）", category: "トレーニング", duration: 60, price: 8800, description: "専属トレーナーが目標に合わせてプログラムを作成します。", prepayment_only: false },
              { name: "ヨガレッスン（45分）", category: "ヨガ", duration: 45, price: 3300, description: "初心者から上級者まで。心と体を整えるヨガクラス。", prepayment_only: false },
              { name: "ピラティス（45分）", category: "ピラティス", duration: 45, price: 3300, description: "インナーマッスルを鍛え、姿勢を改善するピラティス。", prepayment_only: false },
              { name: "ボクシングフィット（45分）", category: "格闘技", duration: 45, price: 4400, description: "ダイエット・ストレス発散に最適なボクシングエクササイズ。", prepayment_only: false },
              { name: "パーソナル月4回コース", category: "トレーニング", duration: 60, price: 29700, description: "月4回のパーソナルトレーニング。確実に目標達成。", prepayment_only: true },
            ],
            settings: { store_name: "厚木フィットネス PEAK", store_address: "神奈川県厚木市中町2-4-8 PEAKビル3F", store_phone: "046-223-4455", store_email: "info@fitness-peak.jp", store_hours: "24時間営業", store_closed_days: "年中無休", staff_selection_enabled: "true" }
          }
        },
        {
          slug: "odawara-sakagura-kikunosato", name: "小田原酒蔵 菊の里", area_id: 1, area: "小田原", category: "グルメ", subcategory: "居酒屋・和食",
          description: "地酒と旬の肴が自慢の老舗居酒屋。小田原・神奈川の地酒20種以上を取り揃え。風情ある古民家造りの店内。",
          address: "神奈川県小田原市本町2-7-3", phone: "0465-23-6677", hours: "17:00〜24:00（L.O. 23:00）", closed_days: "毎週水曜日",
          image_url: "https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=800&q=80","https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80","https://images.unsplash.com/photo-1506619216599-9d16d0903dfd?w=800&q=80"],
          display_order: 60, line_account_url: null, reservation_url: null, enable_staff_assignment: false, like_count: 33,
          coupons: [{ title: "地酒3種飲み比べセット500円OFF", description: "神奈川地酒3種飲み比べセット（通常2,200円→1,700円）", discount_type: "AMOUNT", discount_value: 500, expiry_date: "2026-09-30", is_first_time_only: false, is_line_account_coupon: false }]
        },
        {
          slug: "yamato-izakaya-mitsuba", name: "大和居酒屋 三葉", area_id: 2, area: "大和", category: "グルメ", subcategory: "居酒屋",
          description: "地元大和で30年愛され続ける居酒屋。コースは4,000円〜ご宴会・女子会・各種飲み会に最適。貸切も承ります。",
          address: "神奈川県大和市大和南1-8-12", phone: "046-268-9900", hours: "17:00〜翌1:00（L.O. 24:00）", closed_days: "日曜日",
          image_url: "https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=800&q=80","https://images.unsplash.com/photo-1514190051997-0f6f39ca5cde?w=800&q=80","https://images.unsplash.com/photo-1559339352-11d035aa65de?w=800&q=80"],
          display_order: 55, line_account_url: "https://line.me/R/ti/p/@izakaya-mitsuba", reservation_url: "PLACEHOLDER", enable_staff_assignment: false, like_count: 51,
          coupons: [
            { title: "宴会コース2,000円割引（10名以上）", description: "10名以上のご宴会でコース料金から1人2,000円引き", discount_type: "AMOUNT", discount_value: 2000, expiry_date: "2026-12-31", is_first_time_only: false, is_line_account_coupon: false },
            { title: "生ビール1杯無料（LINEクーポン）", description: "LINEクーポン提示で生ビール1杯サービス", discount_type: "FREE", discount_value: 0, expiry_date: "2026-09-30", is_first_time_only: false, is_line_account_coupon: true }
          ],
          booking: {
            staff: [{ name: "三葉 一郎", role: "オーナー", avatar: "三一" }],
            courses: [
              { name: "スタンダードコース（3時間飲み放題）", category: "宴会", duration: 180, price: 4000, description: "定番料理8品＋3時間飲み放題のスタンダードコース。", prepayment_only: false },
              { name: "プレミアムコース（4時間飲み放題）", category: "宴会", duration: 240, price: 5500, description: "特選料理12品＋4時間飲み放題のプレミアムコース。", prepayment_only: true },
              { name: "女子会プラン（2.5時間）", category: "女子会", duration: 150, price: 3500, description: "女子会限定！フォトジェニックなメニュー構成。", prepayment_only: false },
            ],
            settings: { store_name: "大和居酒屋 三葉", store_address: "神奈川県大和市大和南1-8-12", store_phone: "046-268-9900", store_email: "info@izakaya-mitsuba.jp", store_hours: "17:00〜翌1:00", store_closed_days: "日曜日", staff_selection_enabled: "false" }
          }
        },
        {
          slug: "hiratsuka-nail-sakurako", name: "平塚ネイルサロン さくらこ", area_id: 4, area: "平塚", category: "美容・健康", subcategory: "ネイル",
          description: "平塚駅徒歩2分。上質なジェルネイルとトレンドアートが得意なネイルサロン。完全個室・完全予約制。",
          address: "神奈川県平塚市宝町4-2 さくらこビル2F", phone: "0463-21-4499", hours: "10:00〜20:00（最終受付 19:00）", closed_days: "毎週月曜日・第3火曜日",
          image_url: "https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80","https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80","https://images.unsplash.com/photo-1604654894610-df63bc536371?w=800&q=80"],
          display_order: 50, line_account_url: "https://line.me/R/ti/p/@nail-sakurako", reservation_url: "PLACEHOLDER", enable_staff_assignment: true, like_count: 48,
          coupons: [{ title: "新規限定15%OFF", description: "ご新規のお客様全メニュー15%割引（ご予約時にお伝えください）", discount_type: "PERCENTAGE", discount_value: 15, expiry_date: "2026-12-31", is_first_time_only: true, is_line_account_coupon: false }],
          booking: {
            staff: [{ name: "桜子 エリコ", role: "オーナーネイリスト", avatar: "桜エ" }, { name: "高野 みく", role: "シニアネイリスト", avatar: "高み" }],
            courses: [
              { name: "ジェルネイル（ワンカラー）", category: "ネイル", duration: 90, price: 6600, description: "シンプルで美しいワンカラーのジェルネイル。オフ込み。", prepayment_only: false },
              { name: "ジェルネイル（アート込み）", category: "ネイル", duration: 120, price: 9900, description: "トレンドのアートデザイン込みジェルネイル。", prepayment_only: false },
              { name: "フットネイル（ジェル）", category: "ネイル", duration: 90, price: 7700, description: "角質ケア込みのフットジェルネイル。", prepayment_only: false },
              { name: "ブライダルネイル", category: "ブライダル", duration: 180, price: 22000, description: "結婚式当日に対応したブライダルネイルフルコース。", prepayment_only: true },
            ],
            settings: { store_name: "平塚ネイルサロン さくらこ", store_address: "神奈川県平塚市宝町4-2 さくらこビル2F", store_phone: "0463-21-4499", store_email: "info@nail-sakurako.jp", store_hours: "10:00〜20:00（最終受付19:00）", store_closed_days: "毎週月曜日・第3火曜日", staff_selection_enabled: "true" }
          }
        },
        {
          slug: "atsugi-onsen-yuraku", name: "厚木温泉スパ 湯楽", area_id: 5, area: "厚木", category: "レジャー・体験", subcategory: "温泉・スパ",
          description: "天然温泉を使ったリゾートスパ。露天風呂・サウナ・岩盤浴完備。日帰り入浴から宿泊まで。手ぶらでOK。",
          address: "神奈川県厚木市飯山温泉3-1-1", phone: "046-241-8800", hours: "10:00〜22:00", closed_days: "年2回メンテナンス休業",
          image_url: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=800&q=80","https://images.unsplash.com/photo-1544161515-4ab6ce6db874?w=800&q=80","https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800&q=80"],
          display_order: 45, line_account_url: "https://line.me/R/ti/p/@onsen-yuraku", reservation_url: null, enable_staff_assignment: false, like_count: 91,
          coupons: [
            { title: "日帰り入浴200円割引", description: "日帰り入浴（通常1,200円→1,000円）クーポン提示で", discount_type: "AMOUNT", discount_value: 200, expiry_date: "2026-12-31", is_first_time_only: false, is_line_account_coupon: false },
            { title: "岩盤浴セット10%OFF", description: "入浴＋岩盤浴セットを10%割引でご利用いただけます", discount_type: "PERCENTAGE", discount_value: 10, expiry_date: "2026-09-30", is_first_time_only: false, is_line_account_coupon: false }
          ]
        },
        {
          slug: "hadano-bakery-petite-bouquet", name: "秦野パン工房 プチブーケ", area_id: 3, area: "秦野", category: "グルメ", subcategory: "パン・スイーツ",
          description: "丹沢の天然水を使った自家製天然酵母パンの専門店。毎朝焼きたて50種以上が揃います。イートインスペースあり。",
          address: "神奈川県秦野市本町2-5-1", phone: "0463-83-1122", hours: "7:00〜19:00（売り切れ次第終了）", closed_days: "毎週火曜日・水曜日",
          image_url: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1555507036-ab1f4038808a?w=800&q=80","https://images.unsplash.com/photo-1549931319-a545dcf3bc73?w=800&q=80","https://images.unsplash.com/photo-1509440159596-0249088772ff?w=800&q=80"],
          display_order: 40, line_account_url: null, reservation_url: null, enable_staff_assignment: false, like_count: 66,
          coupons: [{ title: "5個以上購入で10%OFF", description: "パン5個以上ご購入のお客様に10%割引", discount_type: "PERCENTAGE", discount_value: 10, expiry_date: "2026-12-31", is_first_time_only: false, is_line_account_coupon: false }]
        },
        {
          slug: "odawara-wagashi-tskinowa", name: "小田原和菓子 月の輪", area_id: 1, area: "小田原", category: "グルメ", subcategory: "和菓子",
          description: "創業明治32年の老舗和菓子店。小田原銘菓「月の輪」をはじめ、季節の生菓子・干菓子など丁寧に作り続けています。",
          address: "神奈川県小田原市城内1-1 小田原城近く", phone: "0465-23-1234", hours: "9:00〜18:00", closed_days: "毎週木曜日",
          image_url: "https://images.unsplash.com/photo-1606471191009-63994c53433b?w=800&q=80",
          gallery_image_urls: ["https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=800&q=80","https://images.unsplash.com/photo-1606471191009-63994c53433b?w=800&q=80","https://images.unsplash.com/photo-1587049352846-4a222e784d38?w=800&q=80"],
          display_order: 35, line_account_url: null, reservation_url: null, enable_staff_assignment: false, like_count: 44,
          coupons: [{ title: "お土産セット5%割引", description: "贈り物・お土産用詰め合わせセット（3,000円以上）5%割引", discount_type: "PERCENTAGE", discount_value: 5, expiry_date: "2026-12-31", is_first_time_only: false, is_line_account_coupon: false }]
        },
      ];

      for (const sh of newShops) {
        // 既存確認
        const ex = await sql`SELECT id FROM shops WHERE slug = ${sh.slug}`;
        if (ex.length > 0) {
          results.push({ slug: sh.slug, status: 'already_exists', id: ex[0].id });
          continue;
        }
        // 店舗挿入
        const shopRows = await sql`INSERT INTO shops (
          slug, name, description, area_id, area, category, subcategory,
          address, phone, hours, closed_days, display_order,
          line_account_url, image_url, gallery_image_urls,
          is_active, enable_staff_assignment, like_count
        ) VALUES (
          ${sh.slug}, ${sh.name}, ${sh.description}, ${sh.area_id}, ${sh.area}, ${sh.category}, ${sh.subcategory},
          ${sh.address}, ${sh.phone}, ${sh.hours}, ${sh.closed_days}, ${sh.display_order},
          ${sh.line_account_url}, ${sh.image_url}, ${sh.gallery_image_urls},
          true, ${sh.enable_staff_assignment}, ${sh.like_count}
        ) RETURNING id`;
        const shopId = shopRows[0].id;

        // reservation_url設定
        if (sh.reservation_url === "PLACEHOLDER") {
          await sql`UPDATE shops SET reservation_url = '/app/reservation/' || ${shopId}::text WHERE id = ${shopId}`;
        }

        // クーポン
        for (const cp of (sh.coupons || [])) {
          await sql`INSERT INTO coupons (shop_id, title, description, discount_type, discount_value, expiry_date, is_first_time_only, is_line_account_coupon, is_active)
            VALUES (${shopId}, ${cp.title}, ${cp.description}, ${cp.discount_type}::discount_type, ${cp.discount_value}, ${cp.expiry_date}, ${cp.is_first_time_only}, ${cp.is_line_account_coupon}, true)`;
        }

        // booking設定（予約有効店のみ）
        if (sh.booking) {
          const bk = sh.booking;
          const sIds: string[] = [];
          for (const st of bk.staff) {
            const row = await sql`INSERT INTO booking_staff (shop_id, name, role, avatar) VALUES (${shopId}, ${st.name}, ${st.role}, ${st.avatar}) RETURNING id`;
            sIds.push(row[0].id.toString());
          }
          for (const c of bk.courses) {
            await sql`INSERT INTO booking_courses (shop_id, name, category, duration, price, description, prepayment_only, staff_ids)
              VALUES (${shopId}, ${c.name}, ${c.category}, ${c.duration}, ${c.price}, ${c.description}, ${c.prepayment_only}, ${sIds})`;
          }
          const s = bk.settings;
          await sql`INSERT INTO booking_settings (shop_id, store_name, store_description, store_address, store_phone, store_email, store_hours, store_closed_days, banner_url, staff_selection_enabled)
            VALUES (${shopId}, ${s.store_name}, ${sh.description}, ${s.store_address}, ${s.store_phone}, ${s.store_email}, ${s.store_hours}, ${s.store_closed_days}, ${sh.image_url}, ${s.staff_selection_enabled})
            ON CONFLICT (shop_id) DO NOTHING`;
        }

        results.push({ slug: sh.slug, name: sh.name, status: 'created', id: shopId, coupons: sh.coupons?.length || 0, hasbooking: !!sh.booking });
      }

      const total = await sql`SELECT COUNT(*) as cnt FROM shops`;
      res.json({ ok: true, total: parseInt(total[0].cnt), results });
    } catch (e: any) {
      console.error("seed-shops error:", e);
      res.status(500).json({ message: "Seed shops failed", error: e.message });
    }
  });

  // ─── Error handler ───
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    console.error("Internal error:", err);
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error" });
  });

  export default async function handler(req: VercelRequest, res: VercelResponse) {
    return app(req as any, res as any);
  }
  