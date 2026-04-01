import { Router } from "express";
import { query } from "../db/index.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET =
  process.env.JWT_SECRET || "your-secret-key-change-in-production";

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
