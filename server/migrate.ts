import { db } from "./db";
import { sql } from "drizzle-orm";

export async function runMigrations() {
  // DDLはDrizzle（shared/schema.ts + db:push）で管理するため、
  // ここではデータの補完（UPDATE）のみ行う。

  // area/category が空の店舗に areas/shop_categories から値を補完
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

  // 予約機能がある店舗の reservation_url を設定（未設定の場合のみ）
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

  // booking_settings に営業時間・定休日カラムを追加
  try {
    await db.execute(sql.raw(`ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS open_time TEXT DEFAULT '10:00'`));
    await db.execute(sql.raw(`ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS close_time TEXT DEFAULT '19:00'`));
    await db.execute(sql.raw(`ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS closed_dow TEXT DEFAULT ''`));
    await db.execute(sql.raw(`ALTER TABLE booking_settings ADD COLUMN IF NOT EXISTS closed_newyear BOOLEAN DEFAULT false`));
  } catch (e: any) {
    console.warn(`Booking settings migration warning: ${e.message?.substring(0, 100)}`);
  }

  // 日付単位の予約枠上書きテーブル
  try {
    await db.execute(sql.raw(`
      CREATE TABLE IF NOT EXISTS booking_slot_dates (
        shop_id INTEGER NOT NULL,
        staff_id TEXT NOT NULL,
        date DATE NOT NULL,
        time TEXT NOT NULL,
        available BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (shop_id, staff_id, date, time)
      )
    `));
  } catch (e: any) {
    console.warn(`booking_slot_dates migration warning: ${e.message?.substring(0, 100)}`);
  }

  console.log("Migrations completed.");
}
