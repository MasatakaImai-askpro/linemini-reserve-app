CREATE TYPE "public"."discount_type" AS ENUM('AMOUNT', 'PERCENTAGE', 'FREE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'shop_admin');--> statement-breakpoint
CREATE TABLE "areas" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "areas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "booking_courses" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"duration" integer DEFAULT 60,
	"price" integer DEFAULT 0,
	"description" text DEFAULT '',
	"prepayment_only" boolean DEFAULT false,
	"enable_request_mode" boolean DEFAULT false,
	"image_url" text,
	"staff_ids" text[] DEFAULT '{}',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_reservations" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text,
	"customer_email" text,
	"customer_note" text,
	"customer_count" integer DEFAULT 1,
	"date" text,
	"time" text,
	"staff_id" text DEFAULT '__shop__',
	"course_id" text NOT NULL,
	"status" text DEFAULT 'confirmed',
	"paid" boolean DEFAULT false,
	"cancel_token" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_settings" (
	"shop_id" integer PRIMARY KEY NOT NULL,
	"store_name" text DEFAULT '',
	"store_description" text DEFAULT '',
	"store_address" text DEFAULT '',
	"store_phone" text DEFAULT '',
	"store_email" text DEFAULT '',
	"store_hours" text DEFAULT '',
	"store_closed_days" text DEFAULT '',
	"banner_url" text DEFAULT '',
	"staff_selection_enabled" text DEFAULT 'false',
	"table_count" integer DEFAULT 0,
	"cancel_limit_days" integer DEFAULT 1,
	"max_party_size" integer DEFAULT 0,
	"store_open_time" text DEFAULT '10:00',
	"store_close_time" text DEFAULT '19:00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
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
CREATE TABLE "booking_staff" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"name" text NOT NULL,
	"role" text DEFAULT '',
	"avatar" text DEFAULT '',
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "coupons" (
	"id" serial PRIMARY KEY NOT NULL,
	"shop_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"discount" text,
	"discount_type" "discount_type" DEFAULT 'FREE' NOT NULL,
	"discount_value" integer DEFAULT 0 NOT NULL,
	"valid_from" timestamp,
	"valid_until" timestamp,
	"expiry_date" text,
	"is_first_time_only" boolean DEFAULT false NOT NULL,
	"is_line_account_coupon" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shop_categories" (
	"shop_id" integer NOT NULL,
	"category_id" integer NOT NULL
);
--> statement-breakpoint
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
CREATE TABLE "shops" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text NOT NULL,
	"area_id" integer NOT NULL,
	"area" text DEFAULT '' NOT NULL,
	"category" text DEFAULT '' NOT NULL,
	"subcategory" text,
	"address" text NOT NULL,
	"phone" text,
	"hours" text,
	"closed_days" text,
	"website" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"line_account_url" text,
	"image_url" text NOT NULL,
	"gallery_image_urls" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"enable_staff_assignment" boolean DEFAULT false NOT NULL,
	"reservation_url" text,
	"reservation_image_url" text,
	"like_count" integer DEFAULT 0 NOT NULL,
	"stripe_connect_id" text,
	"stripe_connect_status" text DEFAULT 'none',
	"table_count" integer DEFAULT 0,
	"max_party_size" integer,
	"staff_selection_enabled" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shops_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "sub_categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"category_id" integer NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"icon" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sub_categories_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'shop_admin' NOT NULL,
	"shop_id" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
CREATE UNIQUE INDEX "booking_reservations_cancel_token_idx" ON "booking_reservations" USING btree ("cancel_token");--> statement-breakpoint
CREATE UNIQUE INDEX "booking_slots_idx" ON "booking_slots" USING btree ("shop_id","staff_id","day_of_week","time");--> statement-breakpoint
CREATE UNIQUE INDEX "shop_categories_idx" ON "shop_categories" USING btree ("shop_id","category_id");