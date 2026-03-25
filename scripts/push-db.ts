import { execSync } from "child_process";

// Run drizzle-kit push to create tables in Neon database
console.log("Pushing schema to Neon database...");

try {
  execSync("npx drizzle-kit push", { 
    stdio: "inherit",
    cwd: process.cwd()
  });
  console.log("Database schema pushed successfully!");
} catch (error) {
  console.error("Failed to push database schema:", error);
  process.exit(1);
}
