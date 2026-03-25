import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertShopSchema,
  insertCouponSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { nanoid } from "nanoid";
import { bookingManager } from "./booking-store";

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
    const { staffId, date } = req.query as { staffId?: string; date?: string };
    if (staffId && date) {
      return res.json(store.getTimeSlots(staffId, date));
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
    const newReservation = {
      id: `r${shopId}-${store.genId()}`,
      reservationToken: token,
      status: "confirmed" as const,
      paid: false,
      ...req.body,
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

  return httpServer;
}
