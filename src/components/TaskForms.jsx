import { useState, useCallback } from "react";
import { useAuthStore } from "../store/authStore";
import { useTaskStore } from "../store/taskStore";
import { tasksAPI, filesAPI } from "../api";
import { useApi } from "../hooks/useApi";
import "./TaskForms.css";

// Типы задач
const TASK_TYPES = {
  PAYMENT: "payment_request", // Заявка на оплату
  INVOICE: "invoice", // Счёт-фактура
  OTHER: "other", // Прочее
};

export default function TaskForms({ onClose, taskType }) {
  const { user } = useAuthStore();
  const { addTask } = useTaskStore();
  const { execute: createTaskApi } = useApi(tasksAPI.create);
  const { execute: uploadFileApi } = useApi(filesAPI.upload);

  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState([]);
  const [screenshotMode, setScreenshotMode] = useState(false);

  // Формы для разных типов задач
  const [paymentData, setPaymentData] = useState({
    description: "",
    amount: "",
  });

  const [invoiceData, setInvoiceData] = useState({
    inn: "",
    subject: "",
    price: "",
    quantity: "",
  });

  const [otherData, setOtherData] = useState({
    essence: "",
    aspects: "",
    notes: "",
  });

  // Обработка скриншота из буфера обмена
  const handlePaste = useCallback(
    async (e) => {
      if (!screenshotMode) return;

      const items = e.clipboardData?.items;
      if (!items) return;

      for (let item of items) {
        if (item.type.indexOf("image") !== -1) {
          e.preventDefault();
          const blob = item.getAsFile();
          if (blob) {
            setFiles((prev) => [
              ...prev,
              {
                file: blob,
                name: `screenshot-${Date.now()}.png`,
                type: "screenshot",
              },
            ]);
          }
        }
      }
    },
    [screenshotMode],
  );

  // Обработка перетаскивания файлов
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    const droppedFiles = Array.from(e.dataTransfer.files);

    droppedFiles.forEach((file) => {
      if (file.type === "application/pdf" || file.type.startsWith("image/")) {
        setFiles((prev) => [
          ...prev,
          {
            file,
            name: file.name,
            type: file.type === "application/pdf" ? "pdf" : "image",
          },
        ]);
      }
    });
  }, []);

  // Обработка выбора файлов через input
  const handleFileSelect = (e) => {
    const selectedFiles = Array.from(e.target.files);

    selectedFiles.forEach((file) => {
      if (file.type === "application/pdf" || file.type.startsWith("image/")) {
        setFiles((prev) => [
          ...prev,
          {
            file,
            name: file.name,
            type: file.type === "application/pdf" ? "pdf" : "image",
          },
        ]);
      }
    });

    e.target.value = "";
  };

  // Удаление файла из списка
  const removeFile = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Сделать скриншот через MediaDevices API
  const takeScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: "always" },
        audio: false,
      });

      const track = stream.getVideoTracks()[0];
      const imageCapture = new ImageCapture(track);
      const bitmap = await imageCapture.grabFrame();

      const canvas = document.createElement("canvas");
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(bitmap, 0, 0);

      canvas.toBlob((blob) => {
        if (blob) {
          setFiles((prev) => [
            ...prev,
            {
              file: blob,
              name: `screenshot-${Date.now()}.png`,
              type: "screenshot",
            },
          ]);
        }
      }, "image/png");

      track.stop();
    } catch (err) {
      console.error("Ошибка скриншота:", err);
      alert("Не удалось сделать скриншот. Выберите файл вручную.");
    }
  };

  // Отправка формы
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      let taskData = {};
      const today = new Date().toISOString().split("T")[0];

      // Определяем статус задачи
      let status = "new";
      // Если сотрудник создаёт заявку на оплату - статус "на рассмотрении"
      if (taskType === TASK_TYPES.PAYMENT && user.role !== "director") {
        status = "review";
      }

      // Формируем данные в зависимости от типа задачи
      if (taskType === TASK_TYPES.PAYMENT) {
        taskData = {
          date: today,
          description: paymentData.description,
          amount: Number(paymentData.amount),
        };
      } else if (taskType === TASK_TYPES.INVOICE) {
        taskData = {
          date: today,
          inn: invoiceData.inn.replace(/\D/g, ""), // Только цифры
          subject: invoiceData.subject,
          price: Number(invoiceData.price),
          quantity: Number(invoiceData.quantity),
          total: Number(invoiceData.price) * Number(invoiceData.quantity),
        };
      } else {
        taskData = {
          date: today,
          essence: otherData.essence,
          aspects: otherData.aspects,
          notes: otherData.notes,
        };
      }

      // Создаём задачу
      const result = await createTaskApi({
        firmId: user.firmId,
        employeeId: user.id,
        taskType: taskType,
        taskData,
        status,
      });

      const task = result.task;

      // Загружаем файлы
      if (files.length > 0 && task) {
        for (const fileObj of files) {
          const formDataUpload = new FormData();
          formDataUpload.append("file", fileObj.file, fileObj.name);
          formDataUpload.append("uploadedBy", user.name);

          await uploadFileApi(formDataUpload, task.id);
        }
      }

      // Добавляем в store
      addTask({
        ...task,
        taskData,
        taskType: taskType,
        attachments: [],
      });

      onClose();
    } catch (err) {
      console.error("Ошибка:", err);
      alert("Ошибка при создании задачи");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose} onPaste={handlePaste}>
      <div
        className="modal-content task-form-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>
            {taskType === TASK_TYPES.PAYMENT && "📋 Заявка на оплату"}
            {taskType === TASK_TYPES.INVOICE && "📄 Счёт-фактура"}
            {taskType === TASK_TYPES.OTHER && "📌 Прочее"}
          </h3>
          <button className="btn-icon" onClick={onClose}>
            ✕
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
          className="excel-form"
        >
          {/* Табличная форма в стиле Excel */}
          <table className="excel-table">
            <tbody>
              {/* Дата (автоматически, только чтение) */}
              <tr className="excel-row">
                <td className="excel-label">Дата</td>
                <td className="excel-value">
                  <input
                    type="text"
                    value={new Date().toISOString().split("T")[0]}
                    readOnly
                    className="excel-input read-only"
                  />
                </td>
              </tr>

              {/* Поля для Заявки на оплату */}
              {taskType === TASK_TYPES.PAYMENT && (
                <>
                  <tr className="excel-row">
                    <td className="excel-label">Документ основания</td>
                    <td className="excel-value">
                      <div className="file-upload-cell">
                        <label className="btn btn-secondary btn-sm btn-file">
                          📎 Прикрепить PDF
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={handleFileSelect}
                            hidden
                          />
                        </label>
                        {screenshotMode && (
                          <span className="screenshot-hint">
                            Ctrl+V для вставки
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr className="excel-row">
                    <td className="excel-label">Описание</td>
                    <td className="excel-value">
                      <textarea
                        value={paymentData.description}
                        onChange={(e) =>
                          setPaymentData({
                            ...paymentData,
                            description: e.target.value,
                          })
                        }
                        className="excel-textarea"
                        rows={3}
                        placeholder="Введите описание..."
                        required
                      />
                    </td>
                  </tr>
                  <tr className="excel-row">
                    <td className="excel-label">Сумма</td>
                    <td className="excel-value">
                      <input
                        type="number"
                        value={paymentData.amount}
                        onChange={(e) =>
                          setPaymentData({
                            ...paymentData,
                            amount: e.target.value,
                          })
                        }
                        className="excel-input"
                        placeholder="0"
                        min="0"
                        step="0.01"
                        required
                      />
                    </td>
                  </tr>
                </>
              )}

              {/* Поля для Счёта-фактуры */}
              {taskType === TASK_TYPES.INVOICE && (
                <>
                  <tr className="excel-row">
                    <td className="excel-label">Документ основания</td>
                    <td className="excel-value">
                      <div className="file-upload-cell">
                        <label className="btn btn-secondary btn-sm btn-file">
                          📎 Прикрепить PDF
                          <input
                            type="file"
                            accept=".pdf,image/*"
                            onChange={handleFileSelect}
                            hidden
                          />
                        </label>
                        {screenshotMode && (
                          <span className="screenshot-hint">
                            Ctrl+V для вставки
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                  <tr className="excel-row">
                    <td className="excel-label">ИНН контрагента</td>
                    <td className="excel-value">
                      <input
                        type="text"
                        value={invoiceData.inn}
                        onChange={(e) =>
                          setInvoiceData({
                            ...invoiceData,
                            inn: e.target.value.replace(/\D/g, ""),
                          })
                        }
                        className="excel-input"
                        placeholder="Только цифры"
                        maxLength={12}
                        pattern="\d*"
                        required
                      />
                    </td>
                  </tr>
                  <tr className="excel-row">
                    <td className="excel-label">Предмет</td>
                    <td className="excel-value">
                      <input
                        type="text"
                        value={invoiceData.subject}
                        onChange={(e) =>
                          setInvoiceData({
                            ...invoiceData,
                            subject: e.target.value,
                          })
                        }
                        className="excel-input"
                        placeholder="Наименование товара/услуги"
                        required
                      />
                    </td>
                  </tr>
                  <tr className="excel-row">
                    <td className="excel-label">Цена / Кол-во</td>
                    <td className="excel-value">
                      <div className="input-row">
                        <input
                          type="number"
                          value={invoiceData.price}
                          onChange={(e) =>
                            setInvoiceData({
                              ...invoiceData,
                              price: e.target.value,
                            })
                          }
                          className="excel-input"
                          placeholder="Цена"
                          min="0"
                          step="0.01"
                          required
                        />
                        <span className="input-separator">/</span>
                        <input
                          type="number"
                          value={invoiceData.quantity}
                          onChange={(e) =>
                            setInvoiceData({
                              ...invoiceData,
                              quantity: e.target.value,
                            })
                          }
                          className="excel-input"
                          placeholder="Кол-во"
                          min="1"
                          step="1"
                          required
                        />
                      </div>
                    </td>
                  </tr>
                  <tr className="excel-row excel-total">
                    <td className="excel-label">Сумма</td>
                    <td className="excel-value">
                      <input
                        type="text"
                        value={
                          invoiceData.price && invoiceData.quantity
                            ? (
                                Number(invoiceData.price) *
                                Number(invoiceData.quantity)
                              ).toFixed(2)
                            : "0"
                        }
                        readOnly
                        className="excel-input read-only total-value"
                      />
                    </td>
                  </tr>
                </>
              )}

              {/* Поля для Прочего */}
              {taskType === TASK_TYPES.OTHER && (
                <>
                  <tr className="excel-row">
                    <td className="excel-label">Суть</td>
                    <td className="excel-value">
                      <textarea
                        value={otherData.essence}
                        onChange={(e) =>
                          setOtherData({
                            ...otherData,
                            essence: e.target.value,
                          })
                        }
                        className="excel-textarea"
                        rows={2}
                        placeholder="Введите суть задачи..."
                        required
                      />
                    </td>
                  </tr>
                  <tr className="excel-row">
                    <td className="excel-label">Затронутые аспекты</td>
                    <td className="excel-value">
                      <textarea
                        value={otherData.aspects}
                        onChange={(e) =>
                          setOtherData({
                            ...otherData,
                            aspects: e.target.value,
                          })
                        }
                        className="excel-textarea"
                        rows={2}
                        placeholder="Какие аспекты затрагивает..."
                      />
                    </td>
                  </tr>
                  <tr className="excel-row">
                    <td className="excel-label">Примечания</td>
                    <td className="excel-value">
                      <textarea
                        value={otherData.notes}
                        onChange={(e) =>
                          setOtherData({ ...otherData, notes: e.target.value })
                        }
                        className="excel-textarea"
                        rows={2}
                        placeholder="Дополнительные примечания..."
                      />
                    </td>
                  </tr>
                </>
              )}

              {/* Загрузка файлов (для всех типов) */}
              <tr className="excel-row">
                <td className="excel-label">Файлы</td>
                <td className="excel-value">
                  <div className="file-actions">
                    <button
                      type="button"
                      className={`btn btn-sm ${screenshotMode ? "btn-primary" : "btn-secondary"}`}
                      onClick={() => setScreenshotMode(!screenshotMode)}
                    >
                      📸 Скриншот
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-secondary"
                      onClick={takeScreenshot}
                    >
                      🖥️ Экран
                    </button>
                  </div>

                  {screenshotMode && (
                    <div className="screenshot-hint-block">
                      💡 Нажмите <strong>Ctrl+V</strong> для вставки скриншота
                      из буфера
                    </div>
                  )}

                  {/* Список файлов */}
                  {files.length > 0 && (
                    <div className="file-list">
                      {files.map((fileObj, index) => (
                        <div key={index} className="file-item">
                          <span className="file-item-icon">
                            {fileObj.type === "pdf" ? "📄" : "🖼️"}
                          </span>
                          <span className="file-item-name">{fileObj.name}</span>
                          <button
                            type="button"
                            className="btn-icon delete btn-icon-sm"
                            onClick={() => removeFile(index)}
                          >
                            ✕
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Кнопки */}
          <div className="modal-actions">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={loading}
            >
              Отмена
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading || files.length === 0}
            >
              {loading ? "Создание..." : "Создать задачу"}
            </button>
          </div>

          {files.length === 0 && (
            <p className="file-required-hint">
              ⚠️ Необходимо прикрепить хотя бы один файл (PDF или скриншот)
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
