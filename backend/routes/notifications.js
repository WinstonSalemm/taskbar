import { Router } from "express";
import { query } from "../db/index.js";

let io; // Will be set from server.js

const router = Router();

// Function to set io instance (called from server.js)
export const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Get all notifications for a user with pagination
router.get("/", async (req, res) => {
  try {
    const { userId } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    if (!userId) {
      return res.status(400).json({ message: "userId обязателен" });
    }

    const notificationsResult = await query(
      `SELECT n.*, t.task_type, e.name as employee_name, f.name as firm_name
       FROM notifications n
       LEFT JOIN tasks t ON n.task_id = t.id
       LEFT JOIN employees e ON t.employee_id = e.id
       LEFT JOIN firms f ON t.firm_id = f.id
       WHERE n.user_id = $1
       ORDER BY n.created_at DESC
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset],
    );

    const totalCountResult = await query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1",
      [userId],
    );

    const unreadCountResult = await query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
      [userId],
    );

    res.json({
      notifications: notificationsResult.rows,
      total: parseInt(totalCountResult.rows[0].count),
      unread: parseInt(unreadCountResult.rows[0].count),
      page,
      totalPages: Math.ceil(totalCountResult.rows[0].count / limit),
    });
  } catch (err) {
    console.error("Get notifications error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Get unread notifications count
router.get("/unread", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ message: "userId обязателен" });
    }

    const result = await query(
      "SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND is_read = FALSE",
      [userId],
    );

    res.json({ unread: parseInt(result.rows[0].count) });
  } catch (err) {
    console.error("Get unread notifications error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Mark notification as read
router.patch("/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId обязателен" });
    }

    const result = await query(
      `UPDATE notifications 
       SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 AND user_id = $2 
       RETURNING *`,
      [parseInt(id), userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Уведомление не найдено" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Mark notification read error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Mark all notifications as read for user
router.patch("/read-all", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId обязателен" });
    }

    const result = await query(
      `UPDATE notifications 
       SET is_read = TRUE, updated_at = CURRENT_TIMESTAMP 
       WHERE user_id = $1 AND is_read = FALSE 
       RETURNING *`,
      [userId],
    );

    res.json({
      message: "Все уведомления отмечены как прочитанные",
      count: result.rows.length,
    });
  } catch (err) {
    console.error("Mark all notifications read error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Delete notification
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ message: "userId обязателен" });
    }

    const result = await query(
      "DELETE FROM notifications WHERE id = $1 AND user_id = $2 RETURNING *",
      [parseInt(id), userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Уведомление не найдено" });
    }

    res.json({ message: "Уведомление удалено" });
  } catch (err) {
    console.error("Delete notification error:", err);
    res.status(500).json({ message: "Ошибка сервера" });
  }
});

// Helper function to create notification (used by other routes)
export const createNotification = async (
  userId,
  taskId,
  type,
  title,
  message,
  metadata = {},
) => {
  try {
    const result = await query(
      `INSERT INTO notifications (user_id, task_id, type, title, message, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [userId, taskId, type, title, message, metadata],
    );

    const notification = result.rows[0];

    // Emit real-time notification to user's room
    if (io) {
      io.to(`notifications_${userId}`).emit("notification_created", {
        ...notification,
        createdAt: notification.created_at,
      });
    }

    return notification;
  } catch (err) {
    console.error("Create notification error:", err);
    throw err;
  }
};

export default router;
