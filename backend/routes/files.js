import { Router } from "express";
import multer from "multer";
import { uploadToS3, deleteFromS3 } from "../utils/s3.js";
import { query } from "../db/index.js";

const router = Router();

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

// ЗАГРУЗКА ФАЙЛА
router.post("/tasks/:taskId/files", upload.single("file"), async (req, res) => {
  try {
    console.log("📤 POST /tasks/:taskId/files received");
    console.log("📁 File info:", {
      originalName: req.file?.originalname,
      size: req.file?.size,
      mimetype: req.file?.mimetype,
      taskId: req.params.taskId,
      uploadedBy: req.body.uploadedBy,
    });

    if (!req.file) {
      console.error("❌ No file in request");
      return res.status(400).json({ message: "Файл не загружен" });
    }

    const { taskId } = req.params;
    const { uploadedBy } = req.body;

    console.log("📤 Calling uploadToS3...");

    // Загружаем в S3
    const { key, fileUrl, fileName } = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    );

    console.log("✅ S3 upload complete:", { key, fileName });

    // Сохраняем в БД
    console.log("💾 Saving to database...");
    const result = await query(
      `INSERT INTO attachments (task_id, file_name, file_id, file_url, uploaded_by, uploaded_at)
       VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
       RETURNING *`,
      [taskId, fileName, key, fileUrl, uploadedBy || "Unknown"],
    );

    console.log("✅ Database save complete");

    res.json({
      success: true,
      fileId: key,
      fileName: fileName,
      fileUrl: fileUrl, // Presigned URL (не /api/files/...!)
      attachment: result.rows[0],
    });
  } catch (err) {
    console.error("❌ Upload error:", err);
    console.error("Error stack:", err.stack);
    res.status(500).json({
      message: "Ошибка загрузки файла: " + err.message,
      error: err.message,
    });
  }
});

// ПОЛУЧИТЬ ФАЙЛЫ ЗАДАЧИ
router.get("/tasks/:taskId/files", async (req, res) => {
  try {
    const result = await query("SELECT * FROM attachments WHERE task_id = $1", [
      parseInt(req.params.taskId),
    ]);
    res.json(result.rows);
  } catch (err) {
    console.error("Get files error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// СКАЧАТЬ ФАЙЛ
router.get("/:fileId/download", async (req, res) => {
  try {
    const { fileId } = req.params;

    console.log("📥 Download request for:", fileId);

    if (fileId.startsWith("http")) {
      return res.redirect(fileId);
    }

    const dbResult = await query(
      "SELECT file_url FROM attachments WHERE file_id = $1",
      [fileId],
    );

    if (dbResult.rows.length === 0) {
      return res.status(404).json({ message: "Файл не найден в БД" });
    }

    const fileUrl = dbResult.rows[0].file_url;

    if (!fileUrl) {
      return res.status(404).json({ message: "URL файла не найден" });
    }

    console.log("↩️ Redirecting to S3 URL");
    res.redirect(fileUrl);
  } catch (err) {
    console.error("❌ Download error:", err);
    res.status(404).json({
      message: "Файл не найден",
      error: err.message,
    });
  }
});

// УДАЛИТЬ ФАЙЛ
router.delete("/tasks/:taskId/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;
    await deleteFromS3(fileId);
    await query("DELETE FROM attachments WHERE file_id = $1", [fileId]);
    res.json({ success: true });
  } catch (err) {
    console.error("Delete file error:", err);
    res.status(500).json({ message: "Ошибка удаления файла" });
  }
});

export default router;
