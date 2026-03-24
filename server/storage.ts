import {
  type Shop, type InsertShop,
  type Coupon, type InsertCoupon,
  type StoreStaff, type InsertStoreStaff,
  type StoreService, type InsertStoreService,
  type StoreSlot, type InsertStoreSlot,
  type Reservation, type InsertReservation,
  type Area, type Category,
  shops, coupons, storeStaff, storeServices,
  storeSlots, reservations, areas, categories,
  shopCategories, serviceCategories, staffCategories,
} from "@shared/schema";
import { db } from "./db";
import { eq, desc, and, inArray } from "drizzle-orm";

export interface IStorage {
  // エリア
  getAreas(): Promise<Area[]>;

  // カテゴリ
  getCategories(): Promise<Category[]>;

  // 店舗
  getShops(): Promise<Shop[]>;
  getShopById(id: number): Promise<Shop | undefined>;
  getShopBySlug(slug: string): Promise<Shop | undefined>;
  getShopsByAreaId(areaId: number): Promise<Shop[]>;
  getShopsByCategoryId(categoryId: number): Promise<Shop[]>;
  createShop(shop: InsertShop): Promise<Shop>;
  updateShop(id: number, data: Partial<InsertShop>): Promise<Shop | undefined>;

  // クーポン
  getCouponsByShopId(shopId: number): Promise<Coupon[]>;
  getAllCoupons(): Promise<Coupon[]>;
  createCoupon(coupon: InsertCoupon): Promise<Coupon>;
  updateCoupon(id: number, data: Partial<InsertCoupon>): Promise<Coupon | undefined>;
  deleteCoupon(id: number): Promise<boolean>;

  // スタッフ
  getStaffByShopId(shopId: number): Promise<StoreStaff[]>;
  getStaffById(id: number): Promise<StoreStaff | undefined>;
  createStaff(staff: InsertStoreStaff): Promise<StoreStaff>;
  updateStaff(id: number, data: Partial<InsertStoreStaff>): Promise<StoreStaff | undefined>;
  deleteStaff(id: number): Promise<boolean>;

  // サービス
  getServicesByShopId(shopId: number): Promise<StoreService[]>;
  getServiceById(id: number): Promise<StoreService | undefined>;
  createService(service: InsertStoreService): Promise<StoreService>;
  updateService(id: number, data: Partial<InsertStoreService>): Promise<StoreService | undefined>;
  deleteService(id: number): Promise<boolean>;

  // スロット
  getSlotsByShopId(shopId: number): Promise<StoreSlot[]>;
  getSlotsByStaffId(staffId: number): Promise<StoreSlot[]>;
  getSlotsByStaffAndDay(staffId: number, dayOfWeek: number): Promise<StoreSlot[]>;
  upsertSlot(slot: InsertStoreSlot): Promise<StoreSlot>;

  // 予約
  getReservationsByShopId(shopId: number): Promise<Reservation[]>;
  getReservationById(id: number): Promise<Reservation | undefined>;
  getReservationByReservationToken(token: string): Promise<Reservation | undefined>;
  createReservation(reservation: InsertReservation): Promise<Reservation>;
  updateReservation(id: number, data: Partial<InsertReservation>): Promise<Reservation | undefined>;
  deleteReservation(id: number): Promise<boolean>;
}

export class DatabaseStorage implements IStorage {

  // ─────────────────────────────
  // エリア
  // ─────────────────────────────
  async getAreas(): Promise<Area[]> {
    return db.select().from(areas);
  }

  // ─────────────────────────────
  // カテゴリ
  // ─────────────────────────────
  async getCategories(): Promise<Category[]> {
    return db.select().from(categories);
  }

  // ─────────────────────────────
  // 店舗
  // ─────────────────────────────
  async getShops(): Promise<Shop[]> {
    return db.select().from(shops)
      .orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
  }

  async getShopById(id: number): Promise<Shop | undefined> {
    const [shop] = await db.select().from(shops).where(eq(shops.id, id));
    return shop;
  }

  async getShopBySlug(slug: string): Promise<Shop | undefined> {
    const [shop] = await db.select().from(shops).where(eq(shops.slug, slug));
    return shop;
  }

  async getShopsByAreaId(areaId: number): Promise<Shop[]> {
    return db.select().from(shops)
      .where(eq(shops.areaId, areaId))
      .orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
  }

  async getShopsByCategoryId(categoryId: number): Promise<Shop[]> {
    const shopCategoryRows = await db.select()
      .from(shopCategories)
      .where(eq(shopCategories.categoryId, categoryId));
    const shopIds = shopCategoryRows.map(r => r.shopId);
    if (shopIds.length === 0) return [];
    return db.select().from(shops)
      .where(inArray(shops.id, shopIds))
      .orderBy(desc(shops.displayOrder), desc(shops.updatedAt));
  }

  async createShop(insertShop: InsertShop): Promise<Shop> {
    const [shop] = await db.insert(shops).values(insertShop).returning();
    return shop;
  }

  async updateShop(id: number, data: Partial<InsertShop>): Promise<Shop | undefined> {
    const [shop] = await db.update(shops)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(shops.id, id))
      .returning();
    return shop;
  }

  // ─────────────────────────────
  // クーポン
  // ─────────────────────────────
  async getCouponsByShopId(shopId: number): Promise<Coupon[]> {
    return db.select().from(coupons)
      .where(eq(coupons.shopId, shopId))
      .orderBy(desc(coupons.updatedAt));
  }

  async getAllCoupons(): Promise<Coupon[]> {
    return db.select().from(coupons).orderBy(desc(coupons.updatedAt));
  }

  async createCoupon(coupon: InsertCoupon): Promise<Coupon> {
    const [created] = await db.insert(coupons).values(coupon).returning();
    return created;
  }

  async updateCoupon(id: number, data: Partial<InsertCoupon>): Promise<Coupon | undefined> {
    const [updated] = await db.update(coupons)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(coupons.id, id))
      .returning();
    return updated;
  }

  async deleteCoupon(id: number): Promise<boolean> {
    const result = await db.delete(coupons).where(eq(coupons.id, id)).returning();
    return result.length > 0;
  }

  // ─────────────────────────────
  // スタッフ
  // ─────────────────────────────
  async getStaffByShopId(shopId: number): Promise<StoreStaff[]> {
    return db.select().from(storeStaff).where(eq(storeStaff.shopId, shopId));
  }

  async getStaffById(id: number): Promise<StoreStaff | undefined> {
    const [staff] = await db.select().from(storeStaff).where(eq(storeStaff.id, id));
    return staff;
  }

  async createStaff(staff: InsertStoreStaff): Promise<StoreStaff> {
    const [created] = await db.insert(storeStaff).values(staff).returning();
    return created;
  }

  async updateStaff(id: number, data: Partial<InsertStoreStaff>): Promise<StoreStaff | undefined> {
    const [updated] = await db.update(storeStaff)
      .set(data)
      .where(eq(storeStaff.id, id))
      .returning();
    return updated;
  }

  async deleteStaff(id: number): Promise<boolean> {
    const result = await db.delete(storeStaff).where(eq(storeStaff.id, id)).returning();
    return result.length > 0;
  }

  // ─────────────────────────────
  // サービス
  // ─────────────────────────────
  async getServicesByShopId(shopId: number): Promise<StoreService[]> {
    return db.select().from(storeServices).where(eq(storeServices.shopId, shopId));
  }

  async getServiceById(id: number): Promise<StoreService | undefined> {
    const [service] = await db.select().from(storeServices).where(eq(storeServices.id, id));
    return service;
  }

  async createService(service: InsertStoreService): Promise<StoreService> {
    const [created] = await db.insert(storeServices).values(service).returning();
    return created;
  }

  async updateService(id: number, data: Partial<InsertStoreService>): Promise<StoreService | undefined> {
    const [updated] = await db.update(storeServices)
      .set(data)
      .where(eq(storeServices.id, id))
      .returning();
    return updated;
  }

  async deleteService(id: number): Promise<boolean> {
    const result = await db.delete(storeServices).where(eq(storeServices.id, id)).returning();
    return result.length > 0;
  }

  // ─────────────────────────────
  // スロット
  // ─────────────────────────────
  async getSlotsByShopId(shopId: number): Promise<StoreSlot[]> {
    return db.select().from(storeSlots).where(eq(storeSlots.shopId, shopId));
  }

  async getSlotsByStaffId(staffId: number): Promise<StoreSlot[]> {
    return db.select().from(storeSlots).where(eq(storeSlots.staffId, staffId));
  }

  async getSlotsByStaffAndDay(staffId: number, dayOfWeek: number): Promise<StoreSlot[]> {
    return db.select().from(storeSlots)
      .where(and(
        eq(storeSlots.staffId, staffId),
        eq(storeSlots.dayOfWeek, dayOfWeek),
      ));
  }

  async upsertSlot(slot: InsertStoreSlot): Promise<StoreSlot> {
    const [upserted] = await db.insert(storeSlots)
      .values(slot)
      .onConflictDoUpdate({
        target: [storeSlots.staffId, storeSlots.dayOfWeek, storeSlots.time],
        set: { isAvailable: slot.isAvailable },
      })
      .returning();
    return upserted;
  }

  // ─────────────────────────────
  // 予約
  // ─────────────────────────────
  async getReservationsByShopId(shopId: number): Promise<Reservation[]> {
    return db.select().from(reservations)
      .where(eq(reservations.shopId, shopId))
      .orderBy(desc(reservations.scheduledAt));
  }

  async getReservationById(id: number): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(reservations).where(eq(reservations.id, id));
    return reservation;
  }

  async getReservationByReservationToken(token: string): Promise<Reservation | undefined> {
    const [reservation] = await db.select().from(reservations)
      .where(eq(reservations.reservationToken, token));
    return reservation;
  }

  async createReservation(reservation: InsertReservation): Promise<Reservation> {
    const [created] = await db.insert(reservations).values(reservation).returning();
    return created;
  }

  async updateReservation(id: number, data: Partial<InsertReservation>): Promise<Reservation | undefined> {
    const [updated] = await db.update(reservations)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(reservations.id, id))
      .returning();
    return updated;
  }

  async deleteReservation(id: number): Promise<boolean> {
    const result = await db.delete(reservations).where(eq(reservations.id, id)).returning();
    return result.length > 0;
  }
}

export const storage = new DatabaseStorage();