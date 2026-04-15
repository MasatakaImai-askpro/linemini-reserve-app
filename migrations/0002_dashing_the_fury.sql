CREATE TABLE "shop_menu_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"price" integer DEFAULT 0 NOT NULL,
	"comment" text DEFAULT '' NOT NULL,
	"image_url" text,
	"is_visible" boolean DEFAULT true NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "booking_reservations" ALTER COLUMN "date" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_reservations" ALTER COLUMN "time" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "booking_courses" ADD COLUMN "enable_request_mode" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "booking_reservations" ADD COLUMN "customer_note" text;--> statement-breakpoint
ALTER TABLE "booking_reservations" ADD COLUMN "customer_count" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "booking_settings" ADD COLUMN "cancel_limit_days" integer DEFAULT 1;--> statement-breakpoint
ALTER TABLE "booking_courses" DROP COLUMN "category";