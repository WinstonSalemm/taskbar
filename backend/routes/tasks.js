import { Router } from "express";
import { query, runQuery } from "../db/sqlite.js";

const router = Router();

// Получить задачи фирмы
router.get("/firm/:firmId", async (req, res) => {
  try {
    const { firmId } = req.params;

    const tasksResult = await query(
      "SELECT * FROM tasks WHERE firm_id = ? ORDER BY created_at DESC",
      [firmId],
    );

    const attachmentsResult = await query(
      `
      SELECT a.*, t.id as task_id
      FROM attachments a
      JOIN tasks t ON a.task_id = t.id
      WHERE t.firm_id = ?
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
          "SELECT name FROM employees WHERE id = ?",
          [task.employee_id],
        );

        return {
          id: task.id,
          firmId: task.firm_id,
          employeeId: task.employee_id,
          employeeName: empResult.rows[0]?.name || "Неизвестно",
          taskType: task.task_type,
          taskData: JSON.parse(task.task_data || "{}"),
          status: task.status,
          createdAt: task.created_at,
          progress: task.progress,
          comments: JSON.parse(task.comments || "[]"),
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
      "SELECT * FROM tasks WHERE employee_id = ? ORDER BY created_at DESC",
      [employeeId],
    );

    const tasks = result.rows.map((task) => ({
      id: task.id,
      firmId: task.firm_id,
      employeeId: task.employee_id,
      taskType: task.task_type,
      taskData: JSON.parse(task.task_data || "{}"),
      status: task.status,
      createdAt: task.created_at,
      progress: task.progress,
      comments: JSON.parse(task.comments || "[]"),
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
    const result = await query("SELECT * FROM tasks WHERE id = ?", [
      parseInt(req.params.id),
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    const task = result.rows[0];
    const attachmentsResult = await query(
      "SELECT * FROM attachments WHERE task_id = ?",
      [parseInt(req.params.id)],
    );

    res.json({
      ...task,
      taskData: JSON.parse(task.task_data || "{}"),
      comments: JSON.parse(task.comments || "[]"),
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

    const result = await runQuery(
      `
      INSERT INTO tasks (firm_id, employee_id, task_type, task_data, status, progress, comments)
      VALUES (?, ?, ?, ?, 'new', 0, '[]')
    `,
      [firmId, employeeId, taskType, JSON.stringify(taskData)],
    );

    const newTask = await query("SELECT * FROM tasks WHERE id = ?", [
      result.lastID,
    ]);

    res.json({ success: true, task: newTask.rows[0] });
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

    if (taskData !== undefined) {
      updates.push(`task_data = ?`);
      values.push(JSON.stringify(taskData));
    }
    if (status !== undefined) {
      updates.push(`status = ?`);
      values.push(status);
    }
    if (progress !== undefined) {
      updates.push(`progress = ?`);
      values.push(Number(progress));
    }

    if (updates.length === 0) {
      return res.status(400).json({ message: "Нет данных для обновления" });
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(parseInt(id));

    await runQuery(
      `
      UPDATE tasks
      SET ${updates.join(", ")}
      WHERE id = ?
    `,
      values,
    );

    const updatedTask = await query("SELECT * FROM tasks WHERE id = ?", [
      parseInt(id),
    ]);

    if (updatedTask.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    res.json({ success: true, task: updatedTask.rows[0] });
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

    const taskResult = await query("SELECT comments FROM tasks WHERE id = ?", [
      parseInt(id),
    ]);

    if (taskResult.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }

    const comments = JSON.parse(taskResult.rows[0].comments || "[]");
    comments.push({
      author: author || "Аноним",
      text: text || "",
      createdAt: new Date().toISOString(),
    });

    await runQuery(
      "UPDATE tasks SET comments = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
      [JSON.stringify(comments), parseInt(id)],
    );

    res.json({ success: true });
  } catch (err) {
    console.error("Add comment error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

export default router;
