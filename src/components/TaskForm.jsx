import { useState, useCallback } from 'react'
import { useAuthStore } from '../store/authStore'
import { useTaskStore } from '../store/taskStore'
import { tasksAPI, filesAPI } from '../api'
import { useApi } from '../hooks/useApi'
import './TaskForm.css'

const TASK_TYPES = [
  { id: 'payment', icon: '💳', title: 'Платёж', desc: 'Выплата, перевод' },
  { id: 'invoice', icon: '📄', title: 'Счёт', desc: 'Счёт, акт' },
  { id: 'document', icon: '📑', title: 'Документы', desc: 'Документы' },
  { id: 'other', icon: '📌', title: 'Другое', desc: 'Иное' },
]

export default function TaskForm({ onClose, editTask }) {
  const { user } = useAuthStore()
  const { addTask, updateTask } = useTaskStore()
  
  const [formData, setFormData] = useState({
    taskType: editTask?.taskType || 'other',
    description: editTask?.taskData?.description || '',
    amount: editTask?.taskData?.amount || '',
    date: editTask?.taskData?.date || new Date().toISOString().split('T')[0],
    recipient: editTask?.taskData?.recipient || '',
  })
  
  const [files, setFiles] = useState([])
  const [uploading, setUploading] = useState(false)
  const [screenshotMode, setScreenshotMode] = useState(false)

  const { execute: createTaskApi } = useApi(tasksAPI.create)
  const { execute: updateTaskApi } = useApi(tasksAPI.update)
  const { execute: uploadFileApi } = useApi(filesAPI.upload)

  // Обработка скриншота из буфера обмена
  const handlePaste = useCallback(async (e) => {
    if (!screenshotMode) return
    
    const items = e.clipboardData?.items
    if (!items) return

    for (let item of items) {
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault()
        const blob = item.getAsFile()
        if (blob) {
          setFiles(prev => [...prev, {
            file: blob,
            name: `screenshot-${Date.now()}.png`,
            type: 'screenshot'
          }])
        }
      }
    }
  }, [screenshotMode])

  // Обработка перетаскивания файлов
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    const droppedFiles = Array.from(e.dataTransfer.files)
    
    droppedFiles.forEach(file => {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        setFiles(prev => [...prev, {
          file,
          name: file.name,
          type: file.type === 'application/pdf' ? 'pdf' : 'image'
        }])
      }
    })
  }, [])

  // Обработка выбора файлов через input
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files)
    
    selectedFiles.forEach(file => {
      if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
        setFiles(prev => [...prev, {
          file,
          name: file.name,
          type: file.type === 'application/pdf' ? 'pdf' : 'image'
        }])
      }
    })
    
    e.target.value = ''
  }

  // Удаление файла из списка
  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  // Сделать скриншот через MediaDevices API
  const takeScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false
      })
      
      const track = stream.getVideoTracks()[0]
      const imageCapture = new ImageCapture(track)
      const bitmap = await imageCapture.grabFrame()
      
      // Конвертируем в Blob
      const canvas = document.createElement('canvas')
      canvas.width = bitmap.width
      canvas.height = bitmap.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bitmap, 0, 0)
      
      canvas.toBlob((blob) => {
        if (blob) {
          setFiles(prev => [...prev, {
            file: blob,
            name: `screenshot-${Date.now()}.png`,
            type: 'screenshot'
          }])
        }
      }, 'image/png')
      
      track.stop()
    } catch (err) {
      console.error('Ошибка скриншота:', err)
      alert('Не удалось сделать скриншот. Выберите файл вручную.')
    }
  }

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault()
    setUploading(true)

    try {
      const taskData = {
        description: formData.description,
        amount: formData.amount ? Number(formData.amount) : null,
        date: formData.date,
        recipient: formData.recipient,
      }

      let task
      if (editTask) {
        // Редактирование
        const result = await updateTaskApi(editTask.id, { taskData })
        task = result.task
      } else {
        // Создание
        const result = await createTaskApi({
          firmId: user.firmId,
          employeeId: user.id,
          taskType: formData.taskType,
          taskData,
        })
        task = result.task
      }

      // Загрузка файлов
      if (files.length > 0 && task) {
        for (const fileObj of files) {
          const formDataUpload = new FormData()
          formDataUpload.append('file', fileObj.file, fileObj.name)
          formDataUpload.append('uploadedBy', user.name)
          
          await uploadFileApi(formDataUpload, task.id)
        }
      }

      if (editTask) {
        updateTask(task.id, { taskData })
      } else {
        addTask({
          ...task,
          taskData,
          taskType: formData.taskType,
          attachments: []
        })
      }

      onClose()
    } catch (err) {
      console.error('Ошибка:', err)
      alert('Ошибка при создании задачи')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content task-form-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{editTask ? 'Редактировать задачу' : 'Новая задача'}</h3>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} onPaste={handlePaste} onDrop={handleDrop} onDragOver={e => e.preventDefault()}>
          {/* Тип задачи */}
          <div className="form-group">
            <label>Тип задачи</label>
            <div className="task-type-selector">
              {TASK_TYPES.map(type => (
                <button
                  key={type.id}
                  type="button"
                  className={`task-type-option ${formData.taskType === type.id ? 'selected' : ''}`}
                  onClick={() => setFormData({...formData, taskType: type.id})}
                >
                  <span className="task-type-option-icon">{type.icon}</span>
                  <span className="task-type-option-title">{type.title}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Описание */}
          <div className="form-group">
            <label>Описание *</label>
            <textarea
              value={formData.description}
              onChange={e => setFormData({...formData, description: e.target.value})}
              className="form-textarea"
              rows={3}
              placeholder="Опишите задачу..."
              required
            />
          </div>

          {/* Сумма и дата */}
          <div className="form-row">
            <div className="form-group">
              <label>Сумма</label>
              <input
                type="number"
                value={formData.amount}
                onChange={e => setFormData({...formData, amount: e.target.value})}
                className="form-input"
                placeholder="0"
              />
            </div>
            <div className="form-group">
              <label>Дата</label>
              <input
                type="date"
                value={formData.date}
                onChange={e => setFormData({...formData, date: e.target.value})}
                className="form-input"
              />
            </div>
          </div>

          {/* Получатель */}
          <div className="form-group">
            <label>Получатель / Контрагент</label>
            <input
              type="text"
              value={formData.recipient}
              onChange={e => setFormData({...formData, recipient: e.target.value})}
              className="form-input"
              placeholder="Название организации или ФИО"
            />
          </div>

          {/* Загрузка файлов */}
          <div className="form-group">
            <label>Файлы</label>
            <div className="file-upload-section">
              <div className="file-upload-buttons">
                <label className="btn btn-secondary btn-file">
                  📎 Прикрепить файл
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    onChange={handleFileSelect}
                    hidden
                  />
                </label>
                
               
              </div>

              {screenshotMode && (
                <div className="screenshot-hint">
                  💡 <strong>Режим скриншота:</strong> Нажмите Ctrl+V для вставки из буфера обмена
                </div>
              )}

              {/* Список файлов */}
              {files.length > 0 && (
                <div className="file-list">
                  {files.map((fileObj, index) => (
                    <div key={index} className="file-item">
                      <span className="file-item-icon">
                        {fileObj.type === 'pdf' ? '📄' : '🖼️'}
                      </span>
                      <span className="file-item-name">{fileObj.name}</span>
                      <button
                        type="button"
                        className="btn-icon delete"
                        onClick={() => removeFile(index)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Кнопки */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={uploading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={uploading}
            >
              {uploading ? 'Загрузка...' : editTask ? 'Сохранить' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
