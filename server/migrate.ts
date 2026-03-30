import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  const migrations = [
    // shops テーブルへの追加カラム
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS area text NOT NULL DEFAULT ''`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT ''`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS subcategory text`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS reservation_url text`,
    `ALTER TABLE shops ADD COLUMN IF NOT EXISTS reservation_image_url text`,
    // coupons テーブルへの追加カラム
    `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS discount text`,
    `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS expiry_date text`,
    `ALTER TABLE coupons ADD COLUMN IF NOT EXISTS is_line_account_coupon boolean NOT NULL DEFAULT false`,
    `ALTER TABLE coupons ALTER COLUMN discount_type SET DEFAULT 'FREE'`,
    `ALTER TABLE coupons ALTER COLUMN discount_value SET DEFAULT 0`,
  ];

  for (const migration of migrations) {
    try {
      await db.execute(sql.raw(migration));
    } catch (e: any) {
      console.warn(`Migration warning: ${e.message?.substring(0, 100)}`);
    }
  }

  // 本番DB: area/category が空の店舗に areas/shop_categories から値を補完
  try {
    await db.execute(sql.raw(`
      UPDATE shops s
      SET area = a.slug
      FROM areas a
      WHERE s.area_id = a.id AND (s.area = '' OR s.area IS NULL)
    `));
    await db.execute(sql.raw(`
      UPDATE shops s
      SET category = c.slug
      FROM shop_categories sc
      JOIN categories c ON sc.category_id = c.id
      WHERE sc.shop_id = s.id AND (s.category = '' OR s.category IS NULL)
    `));
  } catch (e: any) {
    console.warn(`Data migration warning: ${e.message?.substring(0, 100)}`);
  }

  // booking store がある店舗の reservation_url を設定（未設定の場合のみ）
  // shop ID 1 (麺処 小田原屋), 3 (Hair Salon MIKU), 6 (鮨処 匠) など
  try {
    await db.execute(sql.raw(`
      UPDATE shops
      SET reservation_url = CONCAT('/app/reservation/', id)
      WHERE id IN (1, 3, 6, 17, 20, 24, 26, 28)
        AND (reservation_url IS NULL OR reservation_url = '')
    `));
  } catch (e: any) {
    console.warn(`Reservation URL migration warning: ${e.message?.substring(0, 100)}`);
  }

  console.log("Migrations completed.");
}
