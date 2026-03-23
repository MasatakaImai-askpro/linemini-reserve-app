import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  insertShopSchema,
  insertCouponSchema,
  insertStoreStaffSchema,
  insertStoreServiceSchema,
  insertStoreSlotSchema,
  insertReservationSchema,
} from "@shared/schema";
import multer from "multer";
import path from "path";
import fs from "fs";
import express from "express";
import { nanoid } from "nanoid";

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
      const parsed = insertShopSchema.safeParse({
        displayOrder: 0,
        slug: nanoid(10),
        ...req.body,
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

  // slugルートは /:id より先に定義する必要がある
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

  // いいね
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
  // スタッフ
  // ─────────────────────────────
  app.get("/api/shops/:shopId/staff", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const staff = await storage.getStaffByShopId(shopId);
      res.json(staff);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch staff" });
    }
  });

  app.post("/api/shops/:shopId/staff", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const parsed = insertStoreStaffSchema.omit({ shopId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const staff = await storage.createStaff({ ...parsed.data, shopId });
      res.status(201).json(staff);
    } catch (error) {
      res.status(500).json({ message: "Failed to create staff" });
    }
  });

  app.put("/api/shops/:shopId/staff/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid staff ID" });
      }
      const partial = insertStoreStaffSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ message: "Invalid request body", errors: partial.error.errors });
      }
      const staff = await storage.updateStaff(id, partial.data);
      if (!staff) {
        return res.status(404).json({ message: "Staff not found" });
      }
      res.json(staff);
    } catch (error) {
      res.status(500).json({ message: "Failed to update staff" });
    }
  });

  app.delete("/api/shops/:shopId/staff/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid staff ID" });
      }
      const deleted = await storage.deleteStaff(id);
      if (!deleted) {
        return res.status(404).json({ message: "Staff not found" });
      }
      res.json({ message: "Staff deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete staff" });
    }
  });

  // ─────────────────────────────
  // サービス（旧courses）
  // ─────────────────────────────
  app.get("/api/shops/:shopId/services", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const services = await storage.getServicesByShopId(shopId);
      res.json(services);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch services" });
    }
  });

  app.post("/api/shops/:shopId/services", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const parsed = insertStoreServiceSchema.omit({ shopId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const service = await storage.createService({ ...parsed.data, shopId });
      res.status(201).json(service);
    } catch (error) {
      res.status(500).json({ message: "Failed to create service" });
    }
  });

  app.put("/api/shops/:shopId/services/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid service ID" });
      }
      const partial = insertStoreServiceSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ message: "Invalid request body", errors: partial.error.errors });
      }
      const service = await storage.updateService(id, partial.data);
      if (!service) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json(service);
    } catch (error) {
      res.status(500).json({ message: "Failed to update service" });
    }
  });

  app.delete("/api/shops/:shopId/services/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid service ID" });
      }
      const deleted = await storage.deleteService(id);
      if (!deleted) {
        return res.status(404).json({ message: "Service not found" });
      }
      res.json({ message: "Service deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete service" });
    }
  });

  // ─────────────────────────────
  // スロット
  // ─────────────────────────────
  app.get("/api/shops/:shopId/slots", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const { staffId, dayOfWeek } = req.query;
      let slots;
      if (staffId && dayOfWeek) {
        slots = await storage.getSlotsByStaffAndDay(
          parseInt(staffId as string),
          parseInt(dayOfWeek as string)
        );
      } else if (staffId) {
        slots = await storage.getSlotsByStaffId(parseInt(staffId as string));
      } else {
        slots = await storage.getSlotsByShopId(shopId);
      }
      res.json(slots);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch slots" });
    }
  });

  app.post("/api/shops/:shopId/slots", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const parsed = insertStoreSlotSchema.omit({ shopId: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const slot = await storage.upsertSlot({ ...parsed.data, shopId });
      res.status(201).json(slot);
    } catch (error) {
      res.status(500).json({ message: "Failed to upsert slot" });
    }
  });

  // ─────────────────────────────
  // 予約
  // ─────────────────────────────
  app.get("/api/shops/:shopId/reservations", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const reservations = await storage.getReservationsByShopId(shopId);
      res.json(reservations);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reservations" });
    }
  });

  app.post("/api/shops/:shopId/reservations", async (req, res) => {
    try {
      const shopId = parseInt(req.params.shopId);
      if (isNaN(shopId)) {
        return res.status(400).json({ message: "Invalid shop ID" });
      }
      const parsed = insertReservationSchema.omit({ shopId: true, cancelToken: true }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request body", errors: parsed.error.errors });
      }
      const reservation = await storage.createReservation({
        ...parsed.data,
        shopId,
        cancelToken: nanoid(32),
      });
      res.status(201).json(reservation);
    } catch (error) {
      res.status(500).json({ message: "Failed to create reservation" });
    }
  });

  app.put("/api/shops/:shopId/reservations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Invalid reservation ID" });
      }
      const partial = insertReservationSchema.partial().safeParse(req.body);
      if (!partial.success) {
        return res.status(400).json({ message: "Invalid request body", errors: partial.error.errors });
      }
      const reservation = await storage.updateReservation(id, partial.data);
      if (!reservation) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ message: "Failed to update reservation" });
    }
  });

  app.delete("/api/shops/:shopId/reservations/:id", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) {
        return res.status(400).json({ message: "Failed to delete reservation" });
      }
      const deleted = await storage.deleteReservation(id);
      if (!deleted) {
        return res.status(404).json({ message: "Reservation not found" });
      }
      res.json({ message: "Reservation deleted" });
    } catch (error) {
      res.status(500).json({ message: "Failed to delete reservation" });
    }
  });

  // ─────────────────────────────
  // キャンセル
  // ─────────────────────────────
  app.get("/api/cancel/:token", async (req, res) => {
    try {
      const reservation = await storage.getReservationByCancelToken(req.params.token);
      if (!reservation) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }
      res.json(reservation);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch reservation" });
    }
  });

  app.post("/api/cancel/:token", async (req, res) => {
    try {
      const reservation = await storage.getReservationByCancelToken(req.params.token);
      if (!reservation) {
        return res.status(404).json({ message: "予約が見つかりません" });
      }
      if (reservation.status === "CANCELLED") {
        return res.json({ ok: true, already: true });
      }
      await storage.updateReservation(reservation.id, { status: "CANCELLED" });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: "Failed to cancel reservation" });
    }
  });

  return httpServer;
}