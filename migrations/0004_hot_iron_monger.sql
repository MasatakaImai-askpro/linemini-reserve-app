CREATE TYPE "public"."order_status" AS ENUM('PENDING', 'PAID', 'REFUNDED', 'FAILED');--> statement-breakpoint
CREATE TYPE "public"."reservation_status" AS ENUM('PENDING', 'CONFIRMED', 'CANCELLED', 'VISITED');--> statement-breakpoint
ALTER TABLE "booking_settings" ADD COLUMN "closed_dow" text DEFAULT '';--> statement-breakpoint
ALTER TABLE "booking_settings" ADD COLUMN "closed_newyear" boolean DEFAULT false;