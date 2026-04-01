import { Router } from "express";
import multer from "multer";
import { uploadToS3, getDownloadUrl, deleteFromS3 } from "../utils/s3.js";
import { query } from "../db/index.js";

const router = Router();

// Multer для временного хранения в памяти (не на диск!)
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
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

// Загрузка файла в задачу (S3)
router.post("/tasks/:taskId/files", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не загружен" });
    }

    const { taskId } = req.params;
    const { uploadedBy } = req.body;

    // Загружаем в S3
    const { key, fileUrl } = await uploadToS3(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype,
    );

    // Сохраняем в БД
    const result = await query(
      `
      INSERT INTO attachments (task_id, file_name, file_id, file_url, uploaded_by, uploaded_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `,
      [taskId, req.file.originalname, key, fileUrl, uploadedBy || "Unknown"],
    );

    res.json({
      success: true,
      fileId: key,
      fileName: req.file.originalname,
      fileUrl,
      attachment: result.rows[0],
    });
  } catch (err) {
    console.error("Upload file error:", err);
    res.status(500).json({ message: "Ошибка загрузки файла: " + err.message });
  }
});

// Получить файлы задачи
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

// Скачать файл (presigned URL)
router.get("/:fileId/download", async (req, res) => {
  try {
    const { fileId } = req.params;

    // Если fileId это URL (для старых файлов из Google Drive)
    if (fileId.startsWith("http")) {
      return res.redirect(fileId);
    }

    // Генерируем presigned URL для скачивания
    const downloadUrl = await getDownloadUrl(fileId);

    // Перенаправляем на presigned URL
    res.redirect(downloadUrl);
  } catch (err) {
    console.error("Download file error:", err);
    res
      .status(404)
      .json({ message: "Файл не найден или истёк срок действия ссылки" });
  }
});

// Удалить файл
router.delete("/tasks/:taskId/files/:fileId", async (req, res) => {
  try {
    const { fileId } = req.params;

    // Удаляем из S3
    await deleteFromS3(fileId);

    // Удаляем из БД
    await query("DELETE FROM attachments WHERE file_id = $1", [fileId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete file error:", err);
    res.status(500).json({ message: "Ошибка удаления файла" });
  }
});

export default router;
