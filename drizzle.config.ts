import { defineConfig } from "drizzle-kit";

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL, ensure the database is provisioned");
  }

  export default defineConfig({
    out: "./migrations",
    schema: "./shared/schema.ts",
    dialect: "postgresql",
    dbCredentials: {
      url: process.env.DATABASE_URL,
    },
    tablesFilter: [
      "users",
      "areas",
      "categories",
      "sub_categories",
      "shops",
      "coupons",
      "shop_categories",
      "shop_menu_items",
      "booking_*",
    ],
  });
  