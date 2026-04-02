import { Router } from "express";
import { query } from "../db/index.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

// Найти фирму по email и получить сотрудников
router.post("/find-firm", async (req, res) => {
  try {
    const { email } = req.body;
    console.log("Finding firm by email:", email);

    // Ищем фирму по email
    const firmResult = await query("SELECT * FROM firms WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);

    if (firmResult.rows.length === 0) {
      return res.status(404).json({ message: "Фирма не найдена" });
    }

    const firm = firmResult.rows[0];

    // Получаем сотрудников фирмы
    const employeesResult = await query(
      "SELECT id, name FROM employees WHERE firm_id = $1 ORDER BY name",
      [firm.id],
    );

    res.json({
      firm: {
        id: firm.id,
        name: firm.name,
        email: firm.email,
      },
      employees: employeesResult.rows,
    });
  } catch (err) {
    console.error("Find firm error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Вход сотрудника по ID и паролю
router.post("/login-with-employee", async (req, res) => {
  try {
    const { employeeId, password } = req.body;
    console.log("Login with employee:", employeeId);

    // Ищем сотрудника по ID
    const employeeResult = await query(
      "SELECT * FROM employees WHERE id = $1",
      [employeeId],
    );

    if (employeeResult.rows.length === 0) {
      return res.status(404).json({ message: "Сотрудник не найден" });
    }

    const employee = employeeResult.rows[0];

    // Проверяем пароль
    const validPassword =
      password === employee.password ||
      (await bcrypt.compare(password, employee.password));

    if (!validPassword) {
      return res.status(401).json({ message: "Неверный пароль" });
    }

    // Получаем фирму сотрудника
    const firmResult = await query("SELECT * FROM firms WHERE id = $1", [
      employee.firm_id,
    ]);
    const firm = firmResult.rows[0];

    console.log("Employee logged in:", employee.name);

    // Создаём токен
    const token = jwt.sign(
      {
        userId: employee.id,
        firmId: firm.id,
        role: "employee",
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: employee.id,
        name: employee.name,
        firmId: firm.id,
        firmName: firm.name,
        email: firm.email,
        role: "employee",
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Старый login (оставляем для обратной совместимости)
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    console.log("Login attempt:", email);

    // Ищем фирму по email
    const firmResult = await query("SELECT * FROM firms WHERE email = $1", [
      email.toLowerCase().trim(),
    ]);
    console.log("Firms found:", firmResult.rows.length);

    if (firmResult.rows.length === 0) {
      console.log("Firm not found");
      return res.status(401).json({ message: "Фирма не найдена" });
    }

    const firm = firmResult.rows[0];
    console.log("Firm:", firm.name);

    // Ищем сотрудника с таким паролем
    const employeeResult = await query(
      "SELECT * FROM employees WHERE firm_id = $1",
      [firm.id],
    );
    console.log("Employees found:", employeeResult.rows.length);

    let employee = null;
    for (const emp of employeeResult.rows) {
      const validPassword =
        emp.password === password ||
        (await bcrypt.compare(password, emp.password));
      console.log(
        "Checking employee:",
        emp.name,
        "password valid:",
        validPassword,
      );
      if (validPassword) {
        employee = emp;
        break;
      }
    }

    if (!employee) {
      console.log("No employee found with valid password");
      return res.status(401).json({ message: "Неверный пароль" });
    }

    console.log("Employee logged in:", employee.name);

    // Создаём токен
    const token = jwt.sign(
      {
        userId: employee.id,
        firmId: firm.id,
        role: "employee",
      },
      JWT_SECRET,
      { expiresIn: "7d" },
    );

    res.json({
      token,
      user: {
        id: employee.id,
        name: employee.name,
        firmId: firm.id,
        firmName: firm.name,
        email: firm.email,
        role: "employee",
      },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

export default router;
