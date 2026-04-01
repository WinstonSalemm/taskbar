import { Router } from 'express'
import multer from 'multer'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import { query } from '../db/index.js'

const router = Router()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Настройка хранилища файлов
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads')
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true })
    }
    cb(null, uploadDir)
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(Math.random() * 1E9)}-${file.originalname}`
    cb(null, uniqueName)
  }
})

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|gif|pdf|doc|docx|xls|xlsx|txt|zip/
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase())
    const mimetype = allowedTypes.test(file.mimetype)
    
    if (extname || mimetype) {
      return cb(null, true)
    }
    cb(new Error('Неподдерживаемый тип файла'))
  }
})

// Загрузка файла
router.post('/tasks/:taskId/files', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'Файл не загружен' })
    }

    const { taskId } = req.params
    const { uploadedBy } = req.body

    const fileUrl = `/api/files/${req.file.filename}`
    
    const result = await query(`
      INSERT INTO attachments (task_id, file_name, file_id, file_url, uploaded_by, uploaded_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      RETURNING *
    `, [taskId, req.file.originalname, req.file.filename, fileUrl, uploadedBy || 'Unknown'])

    res.json({
      success: true,
      fileId: req.file.filename,
      fileName: req.file.originalname,
      fileUrl,
      attachment: result.rows[0]
    })
  } catch (err) {
    console.error('Upload file error:', err)
    res.status(500).json({ message: 'Ошибка загрузки файла' })
  }
})

// Получить файлы задачи
router.get('/tasks/:taskId/files', async (req, res) => {
  try {
    const result = await query(
      'SELECT * FROM attachments WHERE task_id = $1',
      [req.params.taskId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('Get files error:', err)
    res.status(500).json({ message: 'Ошибка сервера' })
  }
})

// Скачать файл
router.get('/:fileId/download', (req, res) => {
  try {
    const filePath = path.join(__dirname, '../../uploads', req.params.fileId)
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Файл не найден' })
    }

    res.download(filePath)
  } catch (err) {
    console.error('Download file error:', err)
    res.status(500).json({ message: 'Ошибка скачивания файла' })
  }
})

// Удалить файл
router.delete('/tasks/:taskId/files/:fileId', async (req, res) => {
  try {
    const { fileId } = req.params

    // Удаляем файл с диска
    const filePath = path.join(__dirname, '../../uploads', fileId)
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
    }

    // Удаляем запись из БД
    await query('DELETE FROM attachments WHERE file_id = $1', [fileId])

    res.json({ success: true })
  } catch (err) {
    console.error('Delete file error:', err)
    res.status(500).json({ message: 'Ошибка удаления файла' })
  }
})

export default router
