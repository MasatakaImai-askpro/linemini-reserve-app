import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertShopSchema,
  insertCouponSchema,
} from "../shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import { getStripePublishableKey, getUncachableStripeClient } from "./stripeClient";
import express from "express";
import { nanoid } from "nanoid";
import { bookingManager } from "./booking-store";
import bcrypt from "bcryptjs";

const uploadsDir = path.join(process.cwd(), "server", "uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const MIME_TO_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif",
  "image/webp": ".webp",
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, uploadsDir),
    filename: (_req, file, cb) => {
      const ext = MIME_TO_EXT[file.mimetype] || ".jpg";
      const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
      cb(null, name);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (MIME_TO_EXT[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error("Only image files (jpeg, png, gif, webp) are allowed"));
    }
  },
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {

  app.use("/uploads", express.static(uploadsDir, {
    setHeaders: (res) => {
      res.setHeader("X-Content-Type-Options", "nosniff");
    },
  }));

  // ─────────────────────────────
  // 画像アップロード
  // ─────────────────────────────
  app.post("/api/upload", upload.single("image"), (req, res) => {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided" });
    }
    res.json({ url: `/uploads/${req.file.filename}` });
  });

  // ─────────────────────────────
  // エリア
  // ─────────────────────────────
  app.get("/api/areas", async (_req, res) => {
    try {
      const areas = await storage.getAreas();
      res.json(areas);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch areas" });
    }
  });

  // ─────────────────────────────
  // カテゴリ
  // ─────────────────────────────
  app.get("/api/categories", async (_req, res) => {
    try {
      const categories = await storage.getCategories();
      res.json(categories);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch categories" });
    }
  });

  // ─────────────────────────────
  // 店舗
  // ─────────────────────────────
  app.get("/api/shops", async (req, res) => {
    try {
      const { areaId, categoryId } = req.query;
      let shops;
      if (areaId) {
        shops = await storage.getShopsByAreaId(parseInt(areaId as string));
      } else if (categoryId) {
        shops = await storage.getShopsByCategoryId(parseInt(categoryId as string));
      } else {
        shops = await storage.getShops();
      }
      res.json(shops);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shops" });
    }
  });

  app.post("/api/shops", async (req, res) => {
    try {
      const body = req.body;
      let areaId = body.areaId;
      if (!areaId && body.area) {
        const allAreas = await storage.getAreas();
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
      const shop = await storage.createShop(parsed.data);
      res.status(201).json(shop);
    } catch (error) {
      res.status(500).json({ message: "Failed to create shop" });
    }
  });

  app.get("/api/shops/slug/:slug", async (req, res) => {
    try {
      const shop = await storage.getShopBySlug(req.params.slug);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
      res.json(shop);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch shop" });
    }
  });

  app.get("/api/shops/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const shop = await storage.getShopById(id);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
      res.json(shop);
    } catch (error) {
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
      const shop = await storage.updateShop(id, partial.data);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
      res.json(shop);
    } catch (error) {
      res.status(500).json({ message: "Failed to update shop" });
    }
  });

  app.post("/api/shops/:id/like", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const shop = await storage.getShopById(id);
      if (!shop) {
        return res.status(404).json({ message: "Shop not found" });
      }
      const updated = await storage.updateShop(id, { likeCount: shop.likeCount + 1 });
      res.json({ likeCount: updated?.likeCount });
    } catch (error) {
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
      const shopCoupons = await storage.getCouponsByShopId(shopId);
      res.json(shopCoupons);
    } catch (error) {
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
      const coupon = await storage.createCoupon({ ...parsed.data, shopId });
      res.status(201).json(coupon);
    } catch (error) {
      res.status(500).json({ message: "Failed to create coupon" });
    }
  });

  app.get("/api/coupons", async (_req, res) => {
    try {
      const allCoupons = await storage.getAllCoupons();
      res.json(allCoupons);
    } catch (error) {
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
      const coupon = await storage.updateCoupon(id, partial.data);
      if (!coupon) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json(coupon);
    } catch (error) {
      res.status(500).json({ message: "Failed to update coupon" });
    }
  });

  app.delete("/api/coupons/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid coupon ID" });
      }
      const deleted = await storage.deleteCoupon(id);
      if (!deleted) {
        return res.status(404).json({ message: "Coupon not found" });
      }
      res.json({ message: "Coupon deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete coupon" });
    }
  });

  // ─────────────────────────────
  // ブッキング（インメモリ booking-store ベース）
  // ─────────────────────────────

  // スタッフ
  app.get("/api/shops/:shopId/staff", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.json([]);
    const staffWithCourseIds = store.staff.map((s) => ({
      ...s,
      courseIds: store.courses.filter((c) => c.staffIds.includes(s.id)).map((c) => c.id),
    }));
    res.json(staffWithCourseIds);
  });

  app.post("/api/shops/:shopId/staff", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { courseIds, ...rest } = req.body;
    const newStaff = { id: `s${shopId}-${store.genId()}`, courseIds: courseIds || [], ...rest };
    store.staff.push(newStaff);
    res.status(201).json(newStaff);
  });

  app.put("/api/shops/:shopId/staff", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { id, courseIds, ...rest } = req.body;
    const idx = store.staff.findIndex((s) => s.id === id);
    if (idx < 0) return res.status(404).json({ message: "Staff not found" });
    store.staff[idx] = { ...store.staff[idx], ...rest };
    res.json(store.staff[idx]);
  });

  app.delete("/api/shops/:shopId/staff", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const id = req.query.id as string;
    store.staff = store.staff.filter((s) => s.id !== id);
    res.json({ message: "Staff deleted" });
  });

  // コース
  app.get("/api/shops/:shopId/courses", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.json([]);
    res.json(store.courses);
  });

  app.post("/api/shops/:shopId/courses", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { staffIds, ...rest } = req.body;
    const newCourse = { id: `c${shopId}-${store.genId()}`, staffIds: staffIds || [], ...rest };
    store.courses.push(newCourse);
    res.status(201).json(newCourse);
  });

  app.put("/api/shops/:shopId/courses", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { id, ...rest } = req.body;
    const idx = store.courses.findIndex((c) => c.id === id);
    if (idx < 0) return res.status(404).json({ message: "Course not found" });
    store.courses[idx] = { ...store.courses[idx], ...rest };
    res.json(store.courses[idx]);
  });

  app.delete("/api/shops/:shopId/courses", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const id = req.query.id as string;
    store.courses = store.courses.filter((c) => c.id !== id);
    res.json({ message: "Course deleted" });
  });

  // スロット
  app.get("/api/shops/:shopId/slots", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.json([]);
    const { staffId, date, courseId } = req.query as { staffId?: string; date?: string; courseId?: string };
    if (staffId && date) {
      return res.json(store.getTimeSlots(staffId, date, courseId));
    }
    if (staffId) {
      return res.json(store.getStaffSlots(staffId));
    }
    res.json([]);
  });

  app.put("/api/shops/:shopId/slots", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { staffId, dayOfWeek, time, available } = req.body;
    const slots = (store as any).slots as any[];
    const existing = slots.find(
      (s: any) => s.staffId === staffId && s.dayOfWeek === dayOfWeek && s.time === time
    );
    if (existing) {
      existing.available = available;
    } else {
      slots.push({ id: store.genId(), staffId, dayOfWeek, time, available });
    }
    res.json({ ok: true });
  });

  app.post("/api/shops/:shopId/slots", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { staffId, dayOfWeek, times, available } = req.body;
    const slots = (store as any).slots as any[];
    for (const time of times || []) {
      const existing = slots.find(
        (s: any) => s.staffId === staffId && s.dayOfWeek === dayOfWeek && s.time === time
      );
      if (existing) {
        existing.available = available;
      } else {
        slots.push({ id: store.genId(), staffId, dayOfWeek, time, available });
      }
    }
    res.json({ ok: true });
  });

  // 設定
  app.get("/api/shops/:shopId/settings", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) {
      return res.json({
        store_name: "",
        store_description: "",
        store_address: "",
        store_phone: "",
        store_email: "",
        store_hours: "",
        store_closed_days: "",
        banner_url: "",
        staff_selection_enabled: "false",
      });
    }
    res.json(store.settings);
  });

  app.put("/api/shops/:shopId/settings", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    store.settings = { ...store.settings, ...req.body };
    res.json(store.settings);
  });

  // 予約
  app.get("/api/shops/:shopId/reservations", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.json([]);
    res.json(store.reservations);
  });

  app.post("/api/shops/:shopId/reservations", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const token = store.genToken();

    let { staffId, date, time, courseId, ...rest } = req.body;

    // スタッフあり設定で指名なし（staffId === "__shop__"）の場合、空きスタッフを自動アサイン
    if (staffId === "__shop__" && store.settings.staff_selection_enabled === "true") {
      const assignedStaffId = store.findAvailableStaff(date, time, courseId);
      if (assignedStaffId) {
        staffId = assignedStaffId;
      }
    }

    const newReservation = {
      id: `r${shopId}-${store.genId()}`,
      reservationToken: token,
      status: "confirmed" as const,
      paid: false,
      staffId,
      date,
      time,
      courseId,
      ...rest,
    };
    store.reservations.push(newReservation);
    res.status(201).json(newReservation);
  });

  app.put("/api/shops/:shopId/reservations", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { id, ...rest } = req.body;
    const idx = store.reservations.findIndex((r) => r.id === id);
    if (idx < 0) return res.status(404).json({ message: "Reservation not found" });
    store.reservations[idx] = { ...store.reservations[idx], ...rest };
    res.json(store.reservations[idx]);
  });

  app.delete("/api/shops/:shopId/reservations", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const id = req.query.id as string;
    store.reservations = store.reservations.filter((r) => r.id !== id);
    res.json({ message: "Reservation deleted" });
  });

  // キャンセル
  app.get("/api/shops/:shopId/cancel/:token", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "予約が見つかりません" });
    const r = store.reservations.find((r) => r.reservationToken === req.params.token);
    if (!r) return res.status(404).json({ message: "予約が見つかりません" });
    const course = store.courses.find((c) => c.id === r.courseId);
    res.json({
      id: r.id,
      customerName: r.customerName,
      date: r.date,
      time: r.time,
      courseId: r.courseId,
      courseName: course?.name || "",
      courseDuration: course?.duration || 0,
      coursePrice: course?.price || 0,
      status: r.status,
    });
  });

  app.post("/api/shops/:shopId/cancel/:token", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "予約が見つかりません" });
    const r = store.reservations.find((r) => r.reservationToken === req.params.token);
    if (!r) return res.status(404).json({ message: "予約が見つかりません" });
    if (r.status === "cancelled") return res.json({ ok: true, already: true });
    r.status = "cancelled";
    res.json({ ok: true });
  });

  // お問い合わせ
  app.get("/api/shops/:shopId/inquiries", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.json([]);
    res.json(store.inquiries);
  });

  app.post("/api/shops/:shopId/inquiries", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const inquiry = {
      id: store.genId(),
      status: "open",
      createdAt: new Date().toISOString(),
      email: null,
      phone: null,
      ...req.body,
    };
    store.inquiries.push(inquiry);
    res.status(201).json(inquiry);
  });

  app.put("/api/shops/:shopId/inquiries", (req, res) => {
    const shopId = parseInt(req.params.shopId);
    const store = bookingManager.getStore(shopId);
    if (!store) return res.status(404).json({ message: "Shop not found" });
    const { id, ...rest } = req.body;
    const idx = store.inquiries.findIndex((i) => i.id === id);
    if (idx < 0) return res.status(404).json({ message: "Inquiry not found" });
    store.inquiries[idx] = { ...store.inquiries[idx], ...rest };
    res.json(store.inquiries[idx]);
  });

  // Stripe Connect: 連携状態を返す（Stripe APIで実際の状態を確認）
  app.get("/api/stripe/connect/status/:shopId", async (req, res) => {
    try {
      const shopId = Number(req.params.shopId);
      const shop = await storage.getShopById(shopId);
      if (!shop) return res.status(404).json({ message: "Shop not found" });

      // アカウントIDがなければ未連携
      if (!shop.stripeConnectId) {
        return res.json({ connected: false, status: "none", accountId: null });
      }

      // Stripe APIでリアルタイム確認
      try {
        const stripe = await getUncachableStripeClient();
        const account = await stripe.accounts.retrieve(shop.stripeConnectId);
        const isActive = !!(account.charges_enabled && account.payouts_enabled);
        const newStatus = isActive ? "active" : "pending";

        // DBのステータスが変わっていれば更新
        if (shop.stripeConnectStatus !== newStatus) {
          await storage.updateShop(shopId, { stripeConnectStatus: newStatus });
        }

        return res.json({
          connected: isActive,
          status: newStatus,
          accountId: shop.stripeConnectId,
        });
      } catch (stripeErr: any) {
        // Stripe API エラーの場合はDB値を使う
        return res.json({
          connected: shop.stripeConnectStatus === "active",
          status: shop.stripeConnectStatus || "none",
          accountId: shop.stripeConnectId,
        });
      }
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stripe Connect: オンボーディング開始（アカウント作成 + AccountLink）
  app.post("/api/stripe/connect/onboard/:shopId", async (req, res) => {
    try {
      const shopId = Number(req.params.shopId);
      const shop = await storage.getShopById(shopId);
      if (!shop) return res.status(404).json({ message: "Shop not found" });

      const stripe = await getUncachableStripeClient();
      let accountId = shop.stripeConnectId;

      if (!accountId) {
        const account = await stripe.accounts.create({
          type: "express",
          country: "JP",
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
        accountId = account.id;
        await storage.updateShop(shopId, { stripeConnectId: accountId, stripeConnectStatus: "pending" });
      } else {
        // 既存アカウントに capabilities を確保
        await stripe.accounts.update(accountId, {
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true },
          },
        });
      }

      const domain = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `http://localhost:5000`;

      const link = await stripe.accountLinks.create({
        account: accountId,
        refresh_url: `${domain}/admin`,
        return_url: `${domain}/admin`,
        type: "account_onboarding",
      });

      res.json({ url: link.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stripe Connect: ダッシュボード LoginLink
  app.post("/api/stripe/connect/dashboard/:shopId", async (req, res) => {
    try {
      const shop = await storage.getShopById(Number(req.params.shopId));
      if (!shop?.stripeConnectId) return res.status(400).json({ error: "Stripe未連携です" });

      const stripe = await getUncachableStripeClient();
      const loginLink = await stripe.accounts.createLoginLink(shop.stripeConnectId);
      res.json({ url: loginLink.url });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Stripe: publishable key を返す
  app.get("/api/stripe/config", async (_req, res) => {
    try {
      const publishableKey = await getStripePublishableKey();
      res.json({ publishableKey });
    } catch {
      res.json({ publishableKey: null });
    }
  });

  // Stripe Connect: payment intent 作成
  app.post("/api/stripe/connect/payment-intent", async (req, res) => {
    try {
      const { shopId, amount, currency = "jpy", description } = req.body;
      const shop = await storage.getShopById(Number(shopId));
      if (!shop?.stripeConnectId) {
        return res.status(400).json({ error: "この店舗はStripe Connect未設定です。当日店舗にてお支払いください。" });
      }
      const stripe = await getUncachableStripeClient();
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Number(amount),
        currency,
        description,
        transfer_data: { destination: shop.stripeConnectId },
      });
      res.json({ clientSecret: paymentIntent.client_secret });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "決済の準備に失敗しました" });
    }
  });

  // ─────────────────────────────
  // 認証 API
  // ─────────────────────────────

  // ログイン
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        return res.status(400).json({ message: "ユーザー名とパスワードを入力してください" });
      }
      const user = await storage.getUserByUsername(username);
      if (!user) {
        return res.status(401).json({ message: "ユーザー名またはパスワードが間違っています" });
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        return res.status(401).json({ message: "ユーザー名またはパスワードが間違っています" });
      }
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.shopId = user.shopId ?? null;
      res.json({
        id: user.id,
        username: user.username,
        role: user.role,
        shopId: user.shopId ?? null,
      });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // 現在のユーザー情報
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session.userId) {
      return res.status(401).json({ message: "ログインしていません" });
    }
    const user = await storage.getUserById(req.session.userId);
    if (!user) {
      req.session.destroy(() => {});
      return res.status(401).json({ message: "ユーザーが見つかりません" });
    }
    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
      shopId: user.shopId ?? null,
    });
  });

  // ログアウト
  app.post("/api/auth/logout", (req, res) => {
    req.session.destroy(() => {
      res.json({ message: "ログアウトしました" });
    });
  });

  return httpServer;
}
