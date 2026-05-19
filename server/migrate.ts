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

  console.log("Migrations completed.");
}
