CREATE TABLE "booking_slots" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"staff_id" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"time" text NOT NULL,
	"available" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "shops" ALTER COLUMN "table_count" SET DEFAULT 0;--> statement-breakpoint
ALTER TABLE "booking_settings" ADD COLUMN "store_open_time" text DEFAULT '10:00';--> statement-breakpoint
ALTER TABLE "booking_settings" ADD COLUMN "store_close_time" text DEFAULT '19:00';--> statement-breakpoint
ALTER TABLE "booking_settings" ADD COLUMN "created_at" timestamp DEFAULT now();--> statement-breakpoint
CREATE UNIQUE INDEX "booking_slots_idx" ON "booking_slots" USING btree ("shop_id","staff_id","day_of_week","time");