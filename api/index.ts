import type { VercelRequest, VercelResponse } from "@vercel/node";
import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";

declare module "express-session" {
  interface SessionData {
    userId: number;
    role: "admin" | "shop_admin";
    shopId: number | null;
  }
}

const app = express();

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(session({
  secret: process.env.SESSION_SECRET || "kanagawa-odekake-secret",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  },
}));

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// Lazy initialization flag
let initialized = false;

async function initializeApp() {
  if (initialized) return;
  
  try {
    const { runMigrations } = await import("../server/migrate");
    await runMigrations();

    const { seedDatabase } = await import("../server/seed");
    await seedDatabase();
  } catch (error) {
    console.error("Initialization error:", error);
  }
  
  initialized = true;
}

// Import storage and routes inline
import { storage } from "../server/storage";
import {
  insertShopSchema,
  insertCouponSchema,
} from "../shared/schema";
import { nanoid } from "nanoid";
import { bookingManager } from "../server/booking-store";
import bcrypt from "bcryptjs";

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

// ログイン
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    const user = await storage.getUserByUsername(username);
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.shopId = user.shopId;
    res.json({ id: user.id, username: user.username, role: user.role, shopId: user.shopId });
  } catch (error) {
    res.status(500).json({ message: "Login failed" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ message: "Logout failed" });
    }
    res.json({ message: "Logged out" });
  });
});

app.get("/api/me", async (req, res) => {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  const user = await storage.getUserById(req.session.userId);
  if (!user) {
    return res.status(401).json({ message: "User not found" });
  }
  res.json({ id: user.id, username: user.username, role: user.role, shopId: user.shopId });
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
  await initializeApp();
  return app(req as any, res as any);
}
