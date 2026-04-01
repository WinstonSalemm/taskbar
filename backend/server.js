import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { initDB } from "./db/index.js";

// Импортируем роуты СРАЗУ (ES modules)
import authRoutes from "./routes/auth.js";
import firmsRoutes from "./routes/firms.js";
import tasksRoutes from "./routes/tasks.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// API Routes (сразу, до статики)
app.use("/api/auth", authRoutes);
app.use("/api/firms", firmsRoutes);
app.use("/api/tasks", tasksRoutes);

// Инициализация БД
initDB()
  .then(() => {
    console.log("✅ PostgreSQL подключён");
  })
  .catch((err) => {
    console.error("❌ Database error:", err.message);
    // Не останавливаем сервер при ошибке БД
  });

// Раздача статики (frontend) в production - ПОСЛЕ API
if (process.env.NODE_ENV === "production") {
  console.log("📁 Serving static from dist/");
  app.use(express.static(path.join(__dirname, "../dist")));
}

// SPA fallback - ПОСЛЕ всего
app.get("*", (req, res) => {
  // Если это API запрос - не отдаём HTML
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  if (process.env.NODE_ENV === "production") {
    console.log(`🌐 Railway: https://твой-проект.railway.app`);
  } else {
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  }
});

export default app;
