import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { createServer } from "http";
import { Server } from "socket.io";
import multer from "multer";

// Импортируем БД и роуты СРАЗУ (ES modules)
import { initDB, query } from "./db/index.js";
import authRoutes from "./routes/auth.js";
import firmsRoutes from "./routes/firms.js";
import tasksRoutes from "./routes/tasks.js";
import filesRoutes from "./routes/files.js";
import { uploadToS3 } from "./utils/s3.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin:
      process.env.NODE_ENV === "production"
        ? process.env.FRONTEND_URL || "*"
        : "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.PORT || 5000;

// Multer для временного хранения в памяти
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip/;
    const extname = allowedTypes.test(
      file.originalname.split(".").pop().toLowerCase(),
    );
    const mimetype = allowedTypes.test(
      file.mimetype.replace("/", "").replace("+", ""),
    );

    if (
      extname ||
      mimetype ||
      file.mimetype.includes("pdf") ||
      file.mimetype.includes("image")
    ) {
      return cb(null, true);
    }
    cb(new Error("Неподдерживаемый тип файла"));
  },
});

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
app.use("/api/tasks", filesRoutes); // Файлы ДО tasks
app.use("/api/tasks", tasksRoutes);

// ============================================
// Chat API Routes
// ============================================

// Получить сообщения задачи
app.get("/api/tasks/:taskId/messages", async (req, res) => {
  try {
    const { taskId } = req.params;
    const result = await query(
      `SELECT * FROM task_messages WHERE task_id = $1 ORDER BY created_at ASC`,
      [parseInt(taskId)],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get messages error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Отправить сообщение (REST fallback)
app.post(
  "/api/tasks/:taskId/messages",
  upload.single("file"),
  async (req, res) => {
    try {
      const { taskId } = req.params;
      const { authorId, authorName, authorRole, text } = req.body;

      let fileUrl = null;
      let fileName = null;

      // Если есть файл, загружаем в S3
      if (req.file) {
        const uploadResult = await uploadToS3(
          req.file.buffer,
          req.file.originalname,
          req.file.mimetype,
        );
        fileUrl = uploadResult.fileUrl;
        fileName = uploadResult.fileName;
      }

      const result = await query(
        `INSERT INTO task_messages (task_id, author_id, author_name, author_role, text, file_name, file_url, seen_by_recipient)
       VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE) RETURNING *`,
        [
          parseInt(taskId),
          authorId,
          authorName,
          authorRole,
          text,
          fileName,
          fileUrl,
        ],
      );

      const message = result.rows[0];

      io.to(`task_${taskId}`).emit("new_message", {
        ...message,
        createdAt: message.created_at,
      });

      res.json(message);
    } catch (err) {
      console.error("Send message error:", err);
      res.status(500).json({ message: "Ошибка сервера" });
    }
  },
);

// Отметить сообщения как прочитанные
app.post("/api/tasks/:taskId/messages/seen", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { viewerId } = req.body;

    if (!viewerId) {
      return res.status(400).json({ message: "viewerId обязателен" });
    }

    // Пробуем добавить колонку
    try {
      await query(
        "ALTER TABLE task_messages ADD COLUMN seen_by_recipient BOOLEAN DEFAULT FALSE",
      );
    } catch (e) {
      // Колонка уже существует — это нормально
    }

    await query(
      "UPDATE task_messages SET seen_by_recipient = TRUE WHERE task_id = $1 AND author_id != $2",
      [parseInt(taskId), viewerId],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Mark seen error:", err.message);
    res.status(500).json({ message: "Ошибка: " + err.message });
  }
});

// Получить счётчик непрочитанных
app.get("/api/tasks/:taskId/messages/unread", async (req, res) => {
  try {
    const { taskId } = req.params;
    const { viewerId } = req.query;

    if (!viewerId) {
      return res.status(400).json({ message: "viewerId обязателен" });
    }

    try {
      await query(
        "ALTER TABLE task_messages ADD COLUMN seen_by_recipient BOOLEAN DEFAULT FALSE",
      );
    } catch {
      // Колонка уже существует
    }

    const result = await query(
      "SELECT COUNT(*) FROM task_messages WHERE task_id = $1 AND author_id != $2 AND (seen_by_recipient = FALSE OR seen_by_recipient IS NULL)",
      [parseInt(taskId), viewerId],
    );

    res.json({ unread: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error("Get unread error:", err.message);
    res.status(500).json({ message: "Ошибка: " + err.message });
  }
});

// ============================================
// Socket.io
// ============================================

io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  // Присоединиться к комнате задачи
  socket.on("join_task", (taskId) => {
    const room = `task_${taskId}`;
    socket.join(room);
    console.log(`📌 ${socket.id} joined ${room}`);
  });

  // Покинуть комнату задачи
  socket.on("leave_task", (taskId) => {
    const room = `task_${taskId}`;
    socket.leave(room);
    console.log(`📌 ${socket.id} left ${room}`);
  });

  // Отправить сообщение
  socket.on(
    "send_message",
    async ({ taskId, authorId, authorName, authorRole, text, file }) => {
      try {
        let fileUrl = null;
        let fileName = null;

        // Если есть файл, загружаем в S3
        if (file && file.buffer) {
          const buffer = Buffer.from(file.buffer, "base64");
          const uploadResult = await uploadToS3(buffer, file.name, file.type);
          fileUrl = uploadResult.fileUrl;
          fileName = uploadResult.fileName;
        }

        const result = await query(
          `INSERT INTO task_messages (task_id, author_id, author_name, author_role, text, file_name, file_url, seen_by_recipient)
         VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE) RETURNING *`,
          [
            parseInt(taskId),
            authorId,
            authorName,
            authorRole,
            text,
            fileName,
            fileUrl,
          ],
        );

        const message = {
          ...result.rows[0],
          createdAt: result.rows[0].created_at,
        };

        // Отправляем всем в комнате задачи (включая отправителя для подтверждения)
        io.to(`task_${taskId}`).emit("new_message", message);
      } catch (err) {
        console.error("Socket send_message error:", err);
        socket.emit("message_error", {
          message: "Не удалось отправить сообщение",
        });
      }
    },
  );

  // Отключение
  socket.on("disconnect", () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
  });
});

// Инициализация БД
initDB()
  .then(() => {
    console.log("✅ PostgreSQL (Railway) подключён");
  })
  .catch((err) => {
    console.error("❌ Database error:", err.message);
  });

// Раздача статики (frontend) в production - ПОСЛЕ API
if (process.env.NODE_ENV === "production") {
  console.log("📁 Serving static from dist/");
  app.use(express.static(path.join(__dirname, "../dist")));
}

// SPA fallback - ПОСЛЕ всего
app.get("*", (req, res) => {
  if (req.path.startsWith("/api/")) {
    return res.status(404).json({ message: "API endpoint not found" });
  }
  res.sendFile(path.join(__dirname, "../dist/index.html"));
});

// Start server — используем httpServer вместо app.listen
httpServer.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🔌 Socket.io ready`);
  if (process.env.NODE_ENV === "production") {
    console.log(`🌐 Railway: https://taskbat-git-production.up.railway.app`);
  } else {
    console.log(`📍 http://localhost:${PORT}`);
    console.log(`📊 Health: http://localhost:${PORT}/api/health`);
  }
});

export { app, io };
export default app;
