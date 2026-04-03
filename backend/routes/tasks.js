import { Router } from "express";
import { query } from "../db/index.js";

const router = Router();

// Получить ВСЕ задачи (для админа)
router.get("/all", async (req, res) => {
  try {
    try {
      await query(
        "ALTER TABLE tasks ADD COLUMN seen_by_admin BOOLEAN DEFAULT FALSE",
      );
    } catch {
      // Колонка уже существует
    }

    const tasksResult = await query(
      `SELECT t.*, f.name as firm_name, f.email as firm_email, e.name as employee_name
       FROM tasks t
       LEFT JOIN firms f ON t.firm_id = f.id
       LEFT JOIN employees e ON t.employee_id = e.id
       ORDER BY t.created_at DESC`,
    );

    const attachmentsResult = await query(
      `SELECT a.*, t.id as task_id
       FROM attachments a
       JOIN tasks t ON a.task_id = t.id`,
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

    const tasks = tasksResult.rows.map((task) => ({
      id: task.id,
      firmId: task.firm_id,
      firmName: task.firm_name,
      employeeId: task.employee_id,
      employeeName: task.employee_name || "Неизвестно",
      taskType: task.task_type,
      taskData: task.task_data,
      status: task.status,
      createdAt: task.created_at,
      progress: task.progress,
      comments: task.comments,
      seenByAdmin: task.seen_by_admin,
      attachments: attachmentsMap.get(task.id) || [],
    }));

    res.json({ tasks });
  } catch (err) {
    console.error("Get all tasks error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

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
    console.log(`📝 [API] Fetching tasks for employee: ${employeeId}`);

    const result = await query(
      "SELECT * FROM tasks WHERE employee_id = $1 ORDER BY created_at DESC",
      [employeeId],
    );

    console.log(
      `✅ [API] Found ${result.rows.length} tasks for employee ${employeeId}`,
    );

    // Загружаем все аттачменты для задач сотрудника
    const attachmentsResult = await query(
      `
      SELECT a.*, t.id as task_id
      FROM attachments a
      JOIN tasks t ON a.task_id = t.id
      WHERE t.employee_id = $1
    `,
      [employeeId],
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
      attachments: attachmentsMap.get(task.id) || [],
    }));

    res.json(tasks);
  } catch (err) {
    console.error("❌ [API] Get employee tasks error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// ============================================
// ЗАДАЧА ПО ID (должно быть ПОСЛЕ /:taskId/files!)
// ============================================

// Отметить задачу как просмотренную админом (ДО /:id!)
router.patch("/:id/seen", async (req, res) => {
  try {
    const { id } = req.params;
    try {
      await query(
        "ALTER TABLE tasks ADD COLUMN seen_by_admin BOOLEAN DEFAULT FALSE",
      );
    } catch {
      // Колонка уже существует
    }
    await query("UPDATE tasks SET seen_by_admin = TRUE WHERE id = $1", [
      parseInt(id),
    ]);
    res.json({ success: true });
  } catch (err) {
    console.error("Mark seen error:", err.message);
    res.status(500).json({ message: "Ошибка: " + err.message });
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

// Удалить задачу (с файлами и сообщениями)
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // Сначала удаляем файлы из S3 (если используются)
    const attachmentsResult = await query(
      "SELECT file_url FROM attachments WHERE task_id = $1",
      [parseInt(id)],
    );

    // Удаляем задачу — каскад удалит attachments и task_messages
    const result = await query("DELETE FROM tasks WHERE id = $1 RETURNING id", [
      parseInt(id),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    console.log(
      `🗑️ Task ${id} deleted with ${attachmentsResult.rows.length} attachments`,
    );
    res.json({ success: true });
  } catch (err) {
    console.error("Delete task error:", err);
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

export default router;
