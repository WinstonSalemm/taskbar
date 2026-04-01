import { Router } from "express";
import { query, runQuery } from "../db/index.js";
import path from "path";
import fs from "fs";

const router = Router();

// Получить задачи фирмы
router.get("/firm/:firmId", async (req, res) => {
  try {
    const { firmId } = req.params;

    const tasksResult = await query(
      "SELECT * FROM tasks WHERE firm_id = $1 ORDER BY created_at DESC",
      [firmId],
    );

    const attachmentsResult = await query(
      `
      SELECT a.*, t.id as task_id
      FROM attachments a
      JOIN tasks t ON a.task_id = t.id
      WHERE t.firm_id = $1
    `,
      [firmId],
    );

    const attachmentsMap = new Map();
    attachmentsResult.rows.forEach((att) => {
      if (!attachmentsMap.has(att.task_id)) {
        attachmentsMap.set(att.task_id, []);
      }
      attachmentsMap.get(att.task_id).push({
        id: att.id,
        fileName: att.file_name,
        fileId: att.file_id,
        fileUrl: att.file_url,
        uploadedBy: att.uploaded_by,
        uploadedAt: att.uploaded_at,
      });
    });

    const tasks = await Promise.all(
      tasksResult.rows.map(async (task) => {
        const empResult = await query(
          "SELECT name FROM employees WHERE id = $1",
          [task.employee_id],
        );

        return {
          id: task.id,
          firmId: task.firm_id,
          employeeId: task.employee_id,
          employeeName: empResult.rows[0]?.name || "Неизвестно",
          taskType: task.task_type,
          taskData: task.task_data,
          status: task.status,
          createdAt: task.created_at,
          progress: task.progress,
          comments: task.comments,
          attachments: attachmentsMap.get(task.id) || [],
        };
      }),
    );

    res.json({ tasks });
  } catch (err) {
    console.error("Get tasks error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Получить задачи сотрудника
router.get("/employee/:employeeId", async (req, res) => {
  try {
    const { employeeId } = req.params;

    const result = await query(
      "SELECT * FROM tasks WHERE employee_id = $1 ORDER BY created_at DESC",
      [employeeId],
    );

    const tasks = result.rows.map((task) => ({
      id: task.id,
      firmId: task.firm_id,
      employeeId: task.employee_id,
      taskType: task.task_type,
      taskData: task.task_data,
      status: task.status,
      createdAt: task.created_at,
      progress: task.progress,
      comments: task.comments,
    }));

    res.json(tasks);
  } catch (err) {
    console.error("Get employee tasks error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Получить задачу по ID
router.get("/:id", async (req, res) => {
  try {
    const result = await query("SELECT * FROM tasks WHERE id = $1", [
      parseInt(req.params.id),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    const task = result.rows[0];
    const attachmentsResult = await query(
      "SELECT * FROM attachments WHERE task_id = $1",
      [parseInt(req.params.id)],
    );

    res.json({
      ...task,
      attachments: attachmentsResult.rows,
    });
  } catch (err) {
    console.error("Get task error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Создать задачу
router.post("/", async (req, res) => {
  try {
    const { firmId, employeeId, taskType, taskData } = req.body;

    const result = await query(
      `
      INSERT INTO tasks (firm_id, employee_id, task_type, task_data, status, progress, comments)
      VALUES ($1, $2, $3, $4, 'new', 0, '[]')
      RETURNING *
    `,
      [firmId, employeeId, taskType, JSON.stringify(taskData)],
    );

    res.json({ success: true, task: result.rows[0] });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Обновить задачу
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { taskData, status, progress } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (taskData !== undefined) {
      updates.push(`task_data = $${paramCount}`);
      values.push(JSON.stringify(taskData));
      paramCount++;
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount}`);
      values.push(status);
      paramCount++;
    }
    if (progress !== undefined) {
      updates.push(`progress = $${paramCount}`);
      values.push(Number(progress));
      paramCount++;
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Нет данных для обновления" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(parseInt(id));

    const result = await query(
      `
      UPDATE tasks
      SET ${updates.join(", ")}
      WHERE id = $${paramCount}
      RETURNING *
    `,
      values,
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    res.json({ success: true, task: result.rows[0] });
  } catch (err) {
    console.error("Update task error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Добавить комментарий
router.post("/:id/comments", async (req, res) => {
  try {
    const { id } = req.params;
    const { author, text } = req.body;

    const taskResult = await query("SELECT comments FROM tasks WHERE id = $1", [
      parseInt(id),
    ]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    const comments = taskResult.rows[0].comments || [];
    comments.push({
      author: author || "Аноним",
      text: text || "",
      createdAt: new Date().toISOString(),
    });

    await query(
      "UPDATE tasks SET comments = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $1",
      [parseInt(id), JSON.stringify(comments)],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ============================================
// ЗАГРУЗКА ФАЙЛОВ
// ============================================
import multer from "multer";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "../../uploads");
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1e9)}-${file.originalname}`;
    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip/;
    const extname = allowedTypes.test(
      path.extname(file.originalname).toLowerCase(),
    );
    const mimetype = allowedTypes.test(file.mimetype);
    if (extname || mimetype) {
      return cb(null, true);
    }
    cb(new Error("Неподдерживаемый тип файла"));
  },
});

// Загрузка файла в задачу
router.post("/:taskId/files", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Файл не загружен" });
    }

    const { taskId } = req.params;
    const { uploadedBy } = req.body;

    const fileUrl = `/api/files/${req.file.filename}`;

    const result = await runQuery(
      `
      INSERT INTO attachments (task_id, file_name, file_id, file_url, uploaded_by, uploaded_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
    `,
      [
        taskId,
        req.file.originalname,
        req.file.filename,
        fileUrl,
        uploadedBy || "Unknown",
      ],
    );

    res.json({
      success: true,
      fileId: req.file.filename,
      fileName: req.file.originalname,
      fileUrl,
      attachmentId: result.lastID,
    });
  } catch (err) {
    console.error("Upload file error:", err);
    res.status(500).json({ message: "Ошибка загрузки файла" });
  }
});

// Получить файлы задачи
router.get("/:taskId/files", async (req, res) => {
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

// Удалить файл
router.delete("/:taskId/files/:fileId", async (req, res) => {
  try {
    const { taskId, fileId } = req.params;

    // Удаляем файл с диска
    const filePath = path.join(__dirname, "../../uploads", fileId);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Удаляем запись из БД
    await query("DELETE FROM attachments WHERE file_id = $1", [fileId]);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete file error:", err);
    res.status(500).json({ message: "Ошибка удаления файла" });
  }
});

export default router;
