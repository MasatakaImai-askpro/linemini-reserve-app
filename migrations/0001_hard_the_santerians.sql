ALTER TABLE "booking_reservations" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "booking_staff" ADD COLUMN "updated_at" timestamp DEFAULT now();--> statement-breakpoint
ALTER TABLE "shop_menu_items" ADD COLUMN "updated_at" timestamp DEFAULT now();