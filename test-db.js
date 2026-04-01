import dotenv from "dotenv";
dotenv.config();

import { query } from "./backend/db/index.js";

async function test() {
  try {
    console.log(
      "DATABASE_URL:",
      process.env.DATABASE_URL ? "exists" : "NOT FOUND",
    );
    console.log("Testing DB connection...");
    const result = await query("SELECT * FROM firms WHERE email = $1", [
      "example@gmail.com",
    ]);
    console.log("✅ Success! Firms:", result.rows);
  } catch (err) {
    console.error("❌ Error:", err.message);
  }
  process.exit(0);
}

test();
