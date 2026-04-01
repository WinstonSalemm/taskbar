import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { initDB, query } from "./db/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Инициализация БД и запуск сервера
initDB()
  .then(() => {
    console.log("✅ PostgreSQL подключён");

    // Routes
    import("./routes/auth.js").then(({ default: authRoutes }) => {
      app.use("/api/auth", authRoutes);
    });
    import("./routes/firms.js").then(({ default: firmsRoutes }) => {
      app.use("/api/firms", firmsRoutes);
    });
    import("./routes/tasks.js").then(({ default: tasksRoutes }) => {
      app.use("/api/tasks", tasksRoutes);
    });
    import("./routes/files.js").then(({ default: filesRoutes }) => {
      app.use("/api/files", filesRoutes);
    });

    // Health check
    app.get("/api/health", (req, res) => {
      res.json({ status: "ok", timestamp: new Date().toISOString() });
    });

    // Start server
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
      console.log(`📍 http://localhost:${PORT}`);
      console.log(`📊 Health: http://localhost:${PORT}/api/health`);
    });
  })
  .catch((err) => {
    console.error("❌ Failed to initialize database:", err.message);
    process.exit(1);
  });

export default app;
