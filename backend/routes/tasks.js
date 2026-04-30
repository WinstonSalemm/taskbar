import { Router } from "express";
import { query } from "../db/index.js";
import { createNotification } from "./notifications.js";

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
      priority: task.priority || "medium",
      priorityReason: task.priority_reason,
      requestedDeadline: task.requested_deadline,
      actualDeadline: task.actual_deadline,
      completedAt: task.completed_at,
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
          priority: task.priority || "medium",
          priorityReason: task.priority_reason,
          requestedDeadline: task.requested_deadline,
          actualDeadline: task.actual_deadline,
          completedAt: task.completed_at,
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
      priority: task.priority || "medium",
      priorityReason: task.priority_reason,
      requestedDeadline: task.requested_deadline,
      actualDeadline: task.actual_deadline,
      completedAt: task.completed_at,
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
      priority: task.priority || "medium",
      priorityReason: task.priority_reason,
      requestedDeadline: task.requested_deadline,
      actualDeadline: task.actual_deadline,
      completedAt: task.completed_at,
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
    const {
      firmId,
      employeeId,
      taskType,
      taskData,
      status,
      priority,
      priority_reason,
      requested_deadline,
      actual_deadline,
    } = req.body;

    // Валидация приоритета
    const validPriorities = ["low", "medium", "high", "critical"];
    const taskPriority = priority || "medium";

    if (!validPriorities.includes(taskPriority)) {
      return res.status(400).json({ message: "Недопустимый приоритет" });
    }

    // Валидация причины срочности для critical приоритета
    if (taskPriority === "critical" && !priority_reason?.trim()) {
      return res.status(400).json({
        message:
          "Для критического приоритета необходимо указать причину срочности",
      });
    }

    const result = await query(
      `
      INSERT INTO tasks (
        firm_id, employee_id, task_type, task_data, status, progress, comments,
        priority, priority_reason, requested_deadline, actual_deadline
      )
      VALUES ($1, $2, $3, $4, $5, 0, '[]', $6, $7, $8, $9)
      RETURNING *
    `,
      [
        firmId,
        employeeId,
        taskType,
        JSON.stringify(taskData),
        status || "new",
        taskPriority,
        priority_reason || null,
        requested_deadline || null,
        actual_deadline || null,
      ],
    );

    const newTask = result.rows[0];

    // Create notification for assigned employee
    if (employeeId) {
      try {
        const taskTitle =
          taskData?.title ||
          taskData?.description ||
          `Новая задача (${taskType})`;
        await createNotification(
          employeeId,
          newTask.id,
          "task_created",
          "Новая задача",
          `Вам назначена новую задачу: ${taskTitle}`,
          { taskType, priority: taskPriority, taskData },
        );
      } catch (notifErr) {
        console.error("Task creation notification error:", notifErr);
      }
    }

    res.json({ success: true, task: newTask });
  } catch (err) {
    console.error("Create task error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Обновить задачу
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      taskData,
      status,
      progress,
      priority,
      priority_reason,
      requested_deadline,
      actual_deadline,
    } = req.body;

    // Получаем текущую задачу для проверки смены статуса
    const currentTaskResult = await query("SELECT * FROM tasks WHERE id = $1", [
      parseInt(id),
    ]);
    if (currentTaskResult.rows.length === 0) {
      return res.status(404).json({ message: "Задача не найдена" });
    }
    const currentTask = currentTaskResult.rows[0];

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

      // Логика completed_at
      if (status === "done" && currentTask.status !== "done") {
        updates.push(`completed_at = CURRENT_TIMESTAMP`);
        values.push();
        paramCount++;
      } else if (status !== "done" && currentTask.status === "done") {
        updates.push(`completed_at = NULL`);
        values.push();
        paramCount++;
      }
    }
    if (progress !== undefined) {
      updates.push(`progress = $${paramCount}`);
      values.push(Number(progress));
      paramCount++;
    }
    if (priority !== undefined) {
      // Валидация приоритета
      const validPriorities = ["low", "medium", "high", "critical"];
      if (!validPriorities.includes(priority)) {
        return res.status(400).json({ message: "Недопустимый приоритет" });
      }

      // Валидация причины срочности для critical приоритета
      if (priority === "critical" && !priority_reason?.trim()) {
        return res.status(400).json({
          message:
            "Для критического приоритета необходимо указать причину срочности",
        });
      }

      updates.push(`priority = $${paramCount}`);
      values.push(priority);
      paramCount++;
    }
    if (priority_reason !== undefined) {
      updates.push(`priority_reason = $${paramCount}`);
      values.push(priority_reason);
      paramCount++;
    }
    if (requested_deadline !== undefined) {
      updates.push(`requested_deadline = $${paramCount}`);
      values.push(requested_deadline);
      paramCount++;
    }
    if (actual_deadline !== undefined) {
      updates.push(`actual_deadline = $${paramCount}`);
      values.push(actual_deadline);
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

    const updatedTask = result.rows[0];

    // Create notifications for various changes
    if (updatedTask.employee_id) {
      try {
        const taskTitle =
          updatedTask.task_data?.title ||
          updatedTask.task_data?.description ||
          `Задача #${updatedTask.id}`;

        // Status change notification
        if (status !== undefined && currentTask.status !== status) {
          let notificationTitle, notificationMessage;
          if (status === "done") {
            notificationTitle = "Задача завершена";
            notificationMessage = `Задача "${taskTitle}" была завершена`;
          } else if (status === "in_progress") {
            notificationTitle = "Задача в работе";
            notificationMessage = `Задача "${taskTitle}" взята в работу`;
          } else {
            notificationTitle = "Статус задачи изменён";
            notificationMessage = `Статус задачи "${taskTitle}" изменён на "${status}"`;
          }

          await createNotification(
            updatedTask.employee_id,
            updatedTask.id,
            "status_changed",
            notificationTitle,
            notificationMessage,
            { oldStatus: currentTask.status, newStatus: status, taskTitle },
          );
        }

        // Priority change notification
        if (priority !== undefined && currentTask.priority !== priority) {
          await createNotification(
            updatedTask.employee_id,
            updatedTask.id,
            "priority_changed",
            "Приоритет задачи изменён",
            `Приоритет задачи "${taskTitle}" изменён на "${priority}"`,
            {
              oldPriority: currentTask.priority,
              newPriority: priority,
              taskTitle,
            },
          );
        }

        // Deadline change notification
        if (
          (requested_deadline !== undefined &&
            currentTask.requested_deadline !== requested_deadline) ||
          (actual_deadline !== undefined &&
            currentTask.actual_deadline !== actual_deadline)
        ) {
          await createNotification(
            updatedTask.employee_id,
            updatedTask.id,
            "deadline_changed",
            "Дедлайн задачи изменён",
            `Дедлайн задачи "${taskTitle}" был изменён`,
            {
              requestedDeadline:
                requested_deadline || currentTask.requested_deadline,
              actualDeadline: actual_deadline || currentTask.actual_deadline,
              taskTitle,
            },
          );
        }

        // Task completion notification
        if (status === "done" && currentTask.status !== "done") {
          await createNotification(
            updatedTask.employee_id,
            updatedTask.id,
            "task_completed",
            "Задача выполнена",
            `Поздравляем! Задача "${taskTitle}" успешно выполнена`,
            { taskTitle, completedAt: updatedTask.completed_at },
          );
        }
      } catch (notifErr) {
        console.error("Task update notification error:", notifErr);
      }
    }

    res.json({ success: true, task: updatedTask });
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
