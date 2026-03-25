import {
  pgTable, pgEnum, text, integer, serial,
  boolean, timestamp, uniqueIndex
} from "drizzle-orm/pg-core";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

// ─────────────────────────────
// ユーザー（管理者・店舗管理者）
// ─────────────────────────────
export const userRoleEnum = pgEnum("user_role", ["admin", "shop_admin"]);

export const users = pgTable("users", {
  id:           serial("id").primaryKey(),
  username:     text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role:         userRoleEnum("role").notNull().default("shop_admin"),
  shopId:       integer("shop_id"),
  createdAt:    timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─────────────────────────────
// Enum
// ─────────────────────────────
export const discountTypeEnum = pgEnum("discount_type", [
  "AMOUNT", "PERCENTAGE", "FREE"
]);

export const reservationStatusEnum = pgEnum("reservation_status", [
  "PENDING", "CONFIRMED", "CANCELLED", "VISITED"
]);

export const orderStatusEnum = pgEnum("order_status", [
  "PENDING", "PAID", "REFUNDED", "FAILED"
]);

// ─────────────────────────────
// エリアマスタ
// ─────────────────────────────
export const areas = pgTable("areas", {
  id:        serial("id").primaryKey(),
  slug:      text("slug").notNull().unique(),
  name:      text("name").notNull(),
  label:     text("label").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────
// カテゴリーマスタ
// ─────────────────────────────
export const categories = pgTable("categories", {
  id:        serial("id").primaryKey(),
  slug:      text("slug").notNull().unique(),
  name:      text("name").notNull(),
  icon:      text("icon").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────
// サブカテゴリーマスタ
// ─────────────────────────────
export const subCategories = pgTable("sub_categories", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  category_id: integer("category_id").notNull(),
  slug:        text("slug").notNull().unique(),
  name:        text("name").notNull(),
  icon:        text("icon").notNull(),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
});


// ─────────────────────────────
// 店舗
// ─────────────────────────────
export const shops = pgTable("shops", {
  id:                    integer("id").primaryKey().generatedAlwaysAsIdentity(),
  slug:                  text("slug").notNull().unique(),
  name:                  text("name").notNull(),
  description:           text("description").notNull(),
  areaId:                integer("area_id").notNull(),
  area:                  text("area").notNull().default(""),
  category:              text("category").notNull().default(""),
  subcategory:           text("subcategory"),
  address:               text("address").notNull(),
  phone:                 text("phone"),
  hours:                 text("hours"),
  closedDays:            text("closed_days"),
  website:               text("website"),
  displayOrder:          integer("display_order").notNull().default(0),
  lineAccountUrl:        text("line_account_url"),
  imageUrl:              text("image_url").notNull(),
  galleryImageUrls:      text("gallery_image_urls").array(),
  isActive:              boolean("is_active").notNull().default(true),
  enableStaffAssignment: boolean("enable_staff_assignment").notNull().default(false),
  reservationUrl:        text("reservation_url"),
  reservationImageUrl:   text("reservation_image_url"),
  likeCount:             integer("like_count").notNull().default(0),
  stripeConnectId:       text("stripe_connect_id"),
  stripeConnectStatus:   text("stripe_connect_status").default("none"),
  updatedAt:             timestamp("updated_at").notNull().defaultNow(),
  createdAt:             timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────
// 店舗オーナー（管理画面ユーザー）
// ─────────────────────────────
export const storeOwners = pgTable("store_owners", {
  id:        serial("id").primaryKey(),
  email:     text("email").notNull().unique(),
  password:  text("password").notNull(),
  shopId:    integer("shop_id").notNull().unique(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────
// コース・メニュー
// ─────────────────────────────
export const storeServices = pgTable("store_services", {
  id:                 integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shopId:             integer("shop_id").notNull(),
  name:               text("name").notNull(),
  description:        text("description"),
  duration:           integer("duration"),
  price:              integer("price"),
  imageUrl:           text("image_url"),
  staffIds:           integer("staff_id").array(),
  requiresPrepayment: boolean("requires_prepayment").notNull().default(false),
  isActive:           boolean("is_active").notNull().default(true),
  updatedAt:          timestamp("updated_at").notNull().defaultNow(),
  createdAt:          timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────
// スタッフ
// ─────────────────────────────
export const storeStaff = pgTable("store_staff", {
  id:        serial("id").primaryKey(),
  shopId:    integer("shop_id").notNull(),
  name:      text("name").notNull(),
  role:      text("role"),
  iconUrl:   text("icon_url"),
  isActive:  boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────
// 予約
// ─────────────────────────────
export const reservations = pgTable("reservations", {
  id:            integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shopId:        integer("shop_id").notNull(),
  serviceId:     integer("service_id"),
  staffId:       integer("staff_id"),
  customerName:  text("customer_name").notNull(),
  customerPhone: text("customer_phone"),
  customerEmail: text("customer_email"),
  scheduledAt:   timestamp("scheduled_at").notNull(),
  status:        reservationStatusEnum("status").notNull().default("PENDING"),
  reservationToken:   text("reservation_token").notNull().unique(),
  createdAt:     timestamp("created_at").notNull().defaultNow(),
  updatedAt:     timestamp("updated_at").notNull().defaultNow(),
});

// ─────────────────────────────
// クーポン
// ─────────────────────────────
export const coupons = pgTable("coupons", {
  id:                   integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shopId:               integer("shop_id").notNull(),
  title:                text("title").notNull(),
  description:          text("description"),
  discount:             text("discount"),
  discountType:         discountTypeEnum("discount_type").notNull().default("FREE"),
  discountValue:        integer("discount_value").notNull().default(0),
  validFrom:            timestamp("valid_from"),
  validUntil:           timestamp("valid_until"),
  expiryDate:           text("expiry_date"),
  isFirstTimeOnly:      boolean("is_first_time_only").notNull().default(false),
  isLineAccountCoupon:  boolean("is_line_account_coupon").notNull().default(false),
  isActive:             boolean("is_active").notNull().default(true),
  createdAt:            timestamp("created_at").notNull().defaultNow(),
  updatedAt:            timestamp("updated_at").notNull().defaultNow(),
});

// ─────────────────────────────
// スロット（スタッフごとの空き枠）
// ─────────────────────────────
export const storeSlots = pgTable("store_slots", {
  id:          integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shopId:      integer("shop_id").notNull(),
  staffId:     integer("staff_id").notNull(),
  dayOfWeek:   integer("day_of_week").notNull(),
  time:        text("time").notNull(),
  isAvailable: boolean("is_available").notNull().default(true),
  updatedAt:   timestamp("updated_at").notNull().defaultNow(),
  createdAt:   timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("store_slots_staff_day_time_idx").on(t.staffId, t.dayOfWeek, t.time),
]);

// ─────────────────────────────
// 中間テーブル（カテゴリ × 各要素）
// ─────────────────────────────
export const shopCategories = pgTable("shop_categories", {
  shopId:     integer("shop_id").notNull(),
  categoryId: integer("category_id").notNull(),
}, (t) => [
  uniqueIndex("shop_categories_idx").on(t.shopId, t.categoryId),
]);

export const serviceCategories = pgTable("service_categories", {
  serviceId:  integer("service_id").notNull(),
  categoryId: integer("category_id").notNull(),
}, (t) => [
  uniqueIndex("service_categories_idx").on(t.serviceId, t.categoryId),
]);

export const staffCategories = pgTable("staff_categories", {
  staffId:    integer("staff_id").notNull(),
  categoryId: integer("category_id").notNull(),
}, (t) => [
  uniqueIndex("staff_categories_idx").on(t.staffId, t.categoryId),
]);

// ─────────────────────────────
// 決済（将来追加）
// ─────────────────────────────
export const orders = pgTable("orders", {
  id:              integer("id").primaryKey().generatedAlwaysAsIdentity(),
  shopId:          integer("shop_id").notNull(),
  reservationId:   integer("reservation_id").unique(),
  stripePaymentId: text("stripe_payment_id"),
  amount:          integer("amount").notNull(),
  status:          orderStatusEnum("status").notNull().default("PENDING"),
  createdAt:       timestamp("created_at").notNull().defaultNow(),
});

// ─────────────────────────────
// Zodスキーマ（自動生成）
// ─────────────────────────────
export const insertAreaSchema            = createInsertSchema(areas).omit({ id: true });
export const insertCategorySchema        = createInsertSchema(categories).omit({ id: true });
export const insertShopSchema            = createInsertSchema(shops).omit({ id: true });
export const insertStoreOwnerSchema      = createInsertSchema(storeOwners).omit({ id: true });
export const insertStoreServiceSchema    = createInsertSchema(storeServices).omit({ id: true });
export const insertStoreStaffSchema      = createInsertSchema(storeStaff).omit({ id: true });
export const insertReservationSchema     = createInsertSchema(reservations).omit({ id: true });
export const insertCouponSchema          = createInsertSchema(coupons).omit({ id: true });
export const insertStoreSlotSchema       = createInsertSchema(storeSlots).omit({ id: true });
export const insertShopCategorySchema    = createInsertSchema(shopCategories);
export const insertServiceCategorySchema = createInsertSchema(serviceCategories);
export const insertStaffCategorySchema   = createInsertSchema(staffCategories);

export const selectAreaSchema            = createSelectSchema(areas);
export const selectCategorySchema        = createSelectSchema(categories);
export const selectShopSchema            = createSelectSchema(shops);
export const selectStoreServiceSchema    = createSelectSchema(storeServices);
export const selectStoreStaffSchema      = createSelectSchema(storeStaff);
export const selectReservationSchema     = createSelectSchema(reservations);
export const selectCouponSchema          = createSelectSchema(coupons);
export const selectStoreSlotSchema       = createSelectSchema(storeSlots);

// ─────────────────────────────
// 型エクスポート
// ─────────────────────────────
export type InsertArea         = z.infer<typeof insertAreaSchema>;
export type Area               = typeof areas.$inferSelect;
export type InsertCategory     = z.infer<typeof insertCategorySchema>;
export type Category           = typeof categories.$inferSelect;
export type InsertShop         = z.infer<typeof insertShopSchema>;
export type Shop               = typeof shops.$inferSelect;
export type InsertStoreService = z.infer<typeof insertStoreServiceSchema>;
export type StoreService       = typeof storeServices.$inferSelect;
export type InsertStoreStaff   = z.infer<typeof insertStoreStaffSchema>;
export type StoreStaff         = typeof storeStaff.$inferSelect;
export type InsertReservation  = z.infer<typeof insertReservationSchema>;
export type Reservation        = typeof reservations.$inferSelect;
export type InsertCoupon       = z.infer<typeof insertCouponSchema>;
export type Coupon             = typeof coupons.$inferSelect;
export type InsertStoreSlot    = z.infer<typeof insertStoreSlotSchema>;
export type StoreSlot          = typeof storeSlots.$inferSelect;

// ─────────────────────────────
// 定数（seed投入用・DB移行後は削除可）
// ─────────────────────────────
export const CATEGORIES = [
  { id: "gourmet",  slug: "gourmet",  name: "グルメ",        icon: "utensils" },
  { id: "beauty",   slug: "beauty",   name: "美容・健康",     icon: "sparkles" },
  { id: "shopping", slug: "shopping", name: "ショッピング",   icon: "shopping-bag" },
  { id: "leisure",  slug: "leisure",  name: "レジャー・体験", icon: "map-pin" },
  { id: "service",  slug: "service",  name: "サービス",       icon: "wrench" },
  { id: "medical",  slug: "medical",  name: "医療・福祉",     icon: "heart-pulse" },
] as const;
export const SUBCATEGORIES: Record<string, { id: string; name: string }[]> = {
  gourmet: [
    { id: "washoku",   name: "和食" },
    { id: "yoshoku",   name: "洋食" },
    { id: "chuka",     name: "中華" },
    { id: "italian",   name: "イタリアン" },
    { id: "izakaya",   name: "居酒屋" },
    { id: "cafe",      name: "カフェ" },
    { id: "ramen",     name: "ラーメン" },
    { id: "sushi",     name: "寿司・海鮮" },
    { id: "sweets",    name: "スイーツ" },
    { id: "other",     name: "その他" },
  ],
  beauty: [
    { id: "hair",      name: "ヘアサロン" },
    { id: "esthe",     name: "エステ" },
    { id: "nail",      name: "ネイル" },
    { id: "massage",   name: "マッサージ・整体" },
    { id: "fitness",   name: "フィットネス" },
    { id: "other",     name: "その他" },
  ],
  shopping: [
    { id: "fashion",     name: "ファッション" },
    { id: "goods",       name: "雑貨" },
    { id: "food",        name: "食料品・惣菜" },
    { id: "electronics", name: "家電・デジタル" },
    { id: "books",       name: "書籍・文具" },
    { id: "other",       name: "その他" },
  ],
  leisure: [
    { id: "sightseeing",   name: "観光スポット" },
    { id: "onsen",         name: "温泉・スパ" },
    { id: "outdoor",       name: "アウトドア" },
    { id: "experience",    name: "体験・教室" },
    { id: "entertainment", name: "エンタメ" },
    { id: "other",         name: "その他" },
  ],
  service: [
    { id: "cleaning",   name: "クリーニング" },
    { id: "repair",     name: "修理・メンテナンス" },
    { id: "school",     name: "教室・スクール" },
    { id: "realestate", name: "不動産" },
    { id: "other",      name: "その他" },
  ],
  medical: [
    { id: "clinic",    name: "病院・クリニック" },
    { id: "dental",    name: "歯科" },
    { id: "pharmacy",  name: "調剤薬局" },
    { id: "care",      name: "介護・福祉" },
    { id: "other",     name: "その他" },
  ],
};
export const AREAS = [
  { id: "odawara",        slug: "odawara",        name: "小田原", label: "小田原エリア" },
  { id: "yamato",         slug: "yamato",         name: "大和",   label: "大和エリア" },
  { id: "hadano",         slug: "hadano",         name: "秦野",   label: "秦野エリア" },
  { id: "hiratsuka",      slug: "hiratsuka",      name: "平塚",   label: "平塚エリア" },
  { id: "atsugi",         slug: "atsugi",         name: "厚木",   label: "厚木エリア" },
  { id: "isehara",        slug: "isehara",        name: "伊勢原", label: "伊勢原エリア" },
  { id: "ebina",          slug: "ebina",          name: "海老名", label: "海老名エリア" },
  { id: "zama",           slug: "zama",           name: "座間",   label: "座間エリア" },
  { id: "ayase",          slug: "ayase",          name: "綾瀬",   label: "綾瀬エリア" },
  { id: "chigasaki",      slug: "chigasaki",      name: "茅ヶ崎", label: "茅ヶ崎エリア" },
  { id: "ninomiya",       slug: "ninomiya",       name: "二宮",   label: "二宮エリア" },
  { id: "oiso",           slug: "oiso",           name: "大磯",   label: "大磯エリア" },
  { id: "minamiashigara", slug: "minamiashigara", name: "南足柄", label: "南足柄エリア" },
  { id: "kaisei",         slug: "kaisei",         name: "開成",   label: "開成エリア" },
] as const;