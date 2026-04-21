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
  id:          serial("id").primaryKey(),
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
  id:                    serial("id").primaryKey(),
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
// クーポン
// ─────────────────────────────
export const coupons = pgTable("coupons", {
  id:                   serial("id").primaryKey(),
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
// 中間テーブル（店舗 × カテゴリ）
// ─────────────────────────────
export const shopCategories = pgTable("shop_categories", {
  shopId:     integer("shop_id").notNull(),
  categoryId: integer("category_id").notNull(),
}, (t) => [
  uniqueIndex("shop_categories_idx").on(t.shopId, t.categoryId),
]);

// ─────────────────────────────
// 予約：スタッフ
// ─────────────────────────────
export const bookingStaff = pgTable("booking_staff", {
  id:        serial("id").primaryKey(),
  shopId:    integer("shop_id").notNull(),
  name:      text("name").notNull(),
  role:      text("role").default(""),
  avatar:    text("avatar").default(""),
  isActive:  boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────
// 予約：コース
// ─────────────────────────────
export const bookingCourses = pgTable("booking_courses", {
  id:                serial("id").primaryKey(),
  shopId:            integer("shop_id").notNull(),
  name:              text("name").notNull(),
  duration:          integer("duration").default(60),
  price:             integer("price").default(0),
  description:       text("description").default(""),
  prepaymentOnly:    boolean("prepayment_only").default(false),
  // 日付、時間指定なしを許容するか
  enableRequestMode: boolean("enable_request_mode").default(false),
  imageUrl:          text("image_url"),
  staffIds:          text("staff_ids").array().default([]),
  isActive:          boolean("is_active").default(true),
  createdAt:         timestamp("created_at").defaultNow(),
  updatedAt:         timestamp("updated_at").defaultNow(),
});

// ─────────────────────────────
// 予約：予約データ
// ─────────────────────────────
export const bookingReservations = pgTable("booking_reservations", {
  id:                    serial("id").primaryKey(),
  shopId:                integer("shop_id").notNull(),
  customerName:          text("customer_name").notNull(),
  customerPhone:         text("customer_phone"),
  customerEmail:         text("customer_email"),
  // 備考カラム追加
  customerNote:          text("customer_note"),
  // 人数保持するカラム追加
  customerCount:         integer("customer_count").default(1),
  // 日時指定の予約を許容するためdateとtimeのnotnullは削除
  date:                  text("date"),
  time:                  text("time"),
  staffId:               text("staff_id").default("__shop__"),
  courseId:              text("course_id").notNull(),
  status:                text("status").default("confirmed"),
  paid:                  boolean("paid").default(false),
  cancelToken:           text("cancel_token"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  createdAt:             timestamp("created_at").defaultNow(),
  updatedAt:             timestamp("updated_at").defaultNow(),
}, (t) => [
  uniqueIndex("booking_reservations_cancel_token_idx").on(t.cancelToken),
]);

// ─────────────────────────────
// 予約：店舗設定
// ─────────────────────────────
export const bookingSettings = pgTable("booking_settings", {
  shopId:               integer("shop_id").primaryKey(),
  storeName:            text("store_name").default(""),
  storeDescription:     text("store_description").default(""),
  storeAddress:         text("store_address").default(""),
  storePhone:           text("store_phone").default(""),
  storeEmail:           text("store_email").default(""),
  storeHours:           text("store_hours").default(""),
  storeClosedDays:      text("store_closed_days").default(""),
  bannerUrl:            text("banner_url").default(""),
  staffSelectionEnabled:boolean("staff_selection_enabled").notNull().default(false),
  tableCount:           integer("table_count").default(0),
  // キャンセル期限カラム追加（一律で１日前とするため、default値は1）
  cancelLimitDays:      integer("cancel_limit_days").default(1),
  maxPartySize:         integer("max_party_size").default(0),
  storeOpenTime:        text("store_open_time").default("10:00"),
  storeCloseTime:       text("store_close_time").default("19:00"),
  createdAt:            timestamp("created_at").defaultNow(),
  updatedAt:            timestamp("updated_at").defaultNow(),
});


export const shopMenuItems = pgTable("shop_menu_items", {
    id:           serial("id").primaryKey(),
    shopId:       integer("shop_id").notNull(),
    name:         text("name").notNull(),
    price:        integer("price").notNull().default(0),
    comment:      text("comment").notNull().default(""),
    imageUrl:     text("image_url"),
    isVisible:    boolean("is_visible").notNull().default(true),
    displayOrder: integer("display_order").notNull().default(0),
    createdAt:    timestamp("created_at").notNull().defaultNow(),
    updatedAt:    timestamp("updated_at").defaultNow(),
  });
  export type InsertShopMenuItem = typeof shopMenuItems.$inferInsert;
  export type ShopMenuItem       = typeof shopMenuItems.$inferSelect;

export const bookingSlots = pgTable("booking_slots", {
  id:         serial("id").primaryKey(),
  shopId:     integer("shop_id").notNull(),
  staffId:    text("staff_id").notNull(),
  dayOfWeek:  integer("day_of_week").notNull(),
  time:       text("time").notNull(),
  available:  boolean("available").notNull().default(true),
  updatedAt:  timestamp("updated_at").defaultNow(),
}, (t) => [
  uniqueIndex("booking_slots_idx").on(t.shopId, t.staffId, t.dayOfWeek, t.time),
]);

// ─────────────────────────────
// Zodスキーマ（自動生成）
// ─────────────────────────────
export const insertAreaSchema         = createInsertSchema(areas).omit({ id: true });
export const insertCategorySchema     = createInsertSchema(categories).omit({ id: true });
export const insertShopSchema         = createInsertSchema(shops).omit({ id: true });
export const insertCouponSchema       = createInsertSchema(coupons).omit({ id: true });
export const insertShopCategorySchema = createInsertSchema(shopCategories);

export const selectAreaSchema     = createSelectSchema(areas);
export const selectCategorySchema = createSelectSchema(categories);
export const selectShopSchema     = createSelectSchema(shops);
export const selectCouponSchema   = createSelectSchema(coupons);

// ─────────────────────────────
// 型エクスポート
// ─────────────────────────────
export type InsertArea     = z.infer<typeof insertAreaSchema>;
export type Area           = typeof areas.$inferSelect;
export type InsertCategory = z.infer<typeof insertCategorySchema>;
export type Category       = typeof categories.$inferSelect;
export type InsertShop     = z.infer<typeof insertShopSchema>;
export type Shop           = typeof shops.$inferSelect;
export type InsertCoupon   = z.infer<typeof insertCouponSchema>;
export type Coupon         = typeof coupons.$inferSelect;

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
  { id: "gotemba",        slug: "gotemba",        name: "御殿場", label: "御殿場エリア" },
  { id: "hakone",         slug: "hakone",         name: "箱根",   label: "箱根エリア" },
  { id: "atami",          slug: "atami",          name: "熱海",   label: "熱海エリア" },
  { id: "sagamihara",     slug: "sagamihara",     name: "相模原", label: "相模原エリア" },
  { id: "kamakura",       slug: "kamakura",       name: "鎌倉",   label: "鎌倉エリア" },
  { id: "kawasaki",       slug: "kawasaki",       name: "川崎",   label: "川崎エリア" },
  { id: "yokohama",       slug: "yokohama",       name: "横浜",   label: "横浜エリア" },
  { id: "yokosuka",       slug: "yokosuka",       name: "横須賀", label: "横須賀エリア" },
] as const;
