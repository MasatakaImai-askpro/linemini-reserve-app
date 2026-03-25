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
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "fallback-secret-key-change-in-production";

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
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password required" });
    }
    const [user] = await db.select().from(users).where(eq(users.username, username));
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ message: "Invalid credentials" });
    }
    // JWTトークン生成
    const token = jwt.sign(
      { userId: user.id, role: user.role, shopId: user.shopId },
      JWT_SECRET,
      { expiresIn: "7d" }
    );
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
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number; role: string; shopId: number | null };
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
