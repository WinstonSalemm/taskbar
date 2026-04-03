import { Router } from "express";
import { query } from "../db/index.js";

const router = Router();

// Получить все фирмы (для админа)
router.get("/", async (req, res) => {
  try {
    console.log("Fetching firms...");
    const firmsResult = await query("SELECT * FROM firms ORDER BY name");
    console.log("Firms:", firmsResult.rows.length);

    const employeesResult = await query(
      "SELECT firm_id, COUNT(*) as count FROM employees GROUP BY firm_id",
    );
    console.log("Employees:", employeesResult.rows);

    const tasksResult = await query(`
      SELECT firm_id,
             COUNT(*) as total,
             COUNT(*) FILTER (WHERE status = 'new') as new_count
      FROM tasks
      GROUP BY firm_id
    `);
    console.log("Tasks:", tasksResult.rows);

    const employeeCounts = new Map(
      employeesResult.rows.map((r) => [r.firm_id, parseInt(r.count)]),
    );
    const taskCounts = new Map(
      tasksResult.rows.map((r) => [
        r.firm_id,
        {
          total: parseInt(r.total),
          new: parseInt(r.new_count || 0),
        },
      ]),
    );

    const firms = firmsResult.rows.map((firm) => ({
      id: firm.id,
      name: firm.name,
      email: firm.email,
      employeeCount: employeeCounts.get(firm.id) || 0,
      taskCount: taskCounts.get(firm.id)?.total || 0,
      newTaskCount: taskCounts.get(firm.id)?.new || 0,
    }));

    console.log("Result:", firms);
    res.json(firms);
  } catch (err) {
    console.error("Get firms error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Получить фирму по ID
router.get("/:id", async (req, res) => {
  try {
    const result = await query("SELECT * FROM firms WHERE id = $1", [
      req.params.id,
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Фирма не найдена" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Get firm error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Получить сотрудников фирмы
router.get("/:firmId/employees", async (req, res) => {
  try {
    const result = await query(
      "SELECT id, name, firm_id FROM employees WHERE firm_id = $1 ORDER BY name",
      [req.params.firmId],
    );
    res.json(result.rows);
  } catch (err) {
    console.error("Get employees error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Создать сотрудника
router.post("/:firmId/employees", async (req, res) => {
  try {
    const { firmId } = req.params;
    const { name, password } = req.body;

    if (!name || !password) {
      return res.status(400).json({ message: "Имя и пароль обязательны" });
    }

    // Проверяем существование фирмы
    const firmResult = await query("SELECT * FROM firms WHERE id = $1", [
      firmId,
    ]);
    if (firmResult.rows.length === 0) {
      return res.status(404).json({ message: "Фирма не найдена" });
    }

    // Генерируем ID для сотрудника
    const employeesResult = await query(
      "SELECT COUNT(*) as count FROM employees WHERE firm_id = $1",
      [firmId],
    );
    const empId = `${firmId}_emp_${parseInt(employeesResult.rows[0].count) + 1}`;

    const result = await query(
      "INSERT INTO employees (id, firm_id, name, password) VALUES ($1, $2, $3, $4) RETURNING *",
      [empId, firmId, name, password],
    );

    res.json({
      success: true,
      employee: result.rows[0],
    });
  } catch (err) {
    console.error("Create employee error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Удалить сотрудника
router.delete("/:firmId/employees/:employeeId", async (req, res) => {
  try {
    const { firmId, employeeId } = req.params;

    await query("DELETE FROM employees WHERE id = $1 AND firm_id = $2", [
      employeeId,
      firmId,
    ]);

    res.json({ success: true });
  } catch (err) {
    console.error("Delete employee error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Получить все файлы фирмы
router.get("/:firmId/files", async (req, res) => {
  try {
    const { firmId } = req.params;

    const result = await query(
      `SELECT a.*, t.id as task_id, t.task_type
       FROM attachments a
       JOIN tasks t ON a.task_id = t.id
       WHERE t.firm_id = $1
       ORDER BY a.uploaded_at DESC`,
      [firmId],
    );

    res.json(result.rows);
  } catch (err) {
    console.error("Get firm files error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

export default router;
