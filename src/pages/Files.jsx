import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { filesAPI } from "../api";
import "./Files.css";

export default function Files() {
  const { user } = useAuthStore();
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all"); // all, pdf, image

  useEffect(() => {
    if (!user?.firmId) return;

    const loadFiles = async () => {
      try {
        const res = await fetch(`/api/firms/${user.firmId}/files`);
        if (res.ok) {
          const data = await res.json();
          setFiles(data);
        }
      } catch (err) {
        console.error("Error loading files:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFiles();
  }, [user?.firmId]);

  const filteredFiles = files.filter((f) => {
    if (filter === "all") return true;
    if (filter === "pdf") return f.file_name?.endsWith(".pdf");
    if (filter === "image") return f.file_name?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i);
    return true;
  });

  const formatDate = (dateStr) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getFileIcon = (fileName) => {
    if (fileName?.endsWith(".pdf")) return "📄";
    if (fileName?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) return "🖼️";
    return "📎";
  };

  const handleDownload = async (file) => {
    try {
      const response = await filesAPI.download(file.id);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", file.file_name || "file");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error downloading file:", err);
      if (file.file_url) {
        window.open(file.file_url, "_blank");
      }
    }
  };

  return (
    <div className="files-page">
      <div className="files-header">
        <h2 className="files-title">📁 Файлы</h2>
        <div className="files-filters">
          <button
            className={`files-filter-btn ${filter === "all" ? "active" : ""}`}
            onClick={() => setFilter("all")}
          >
            Все
          </button>
          <button
            className={`files-filter-btn ${filter === "pdf" ? "active" : ""}`}
            onClick={() => setFilter("pdf")}
          >
            📄 PDF
          </button>
          <button
            className={`files-filter-btn ${filter === "image" ? "active" : ""}`}
            onClick={() => setFilter("image")}
          >
            🖼️ Изображения
          </button>
        </div>
      </div>

      {loading ? (
        <div className="files-loading">Загрузка файлов...</div>
      ) : filteredFiles.length === 0 ? (
        <div className="files-empty">
          <div className="files-empty-icon">📂</div>
          <p>Файлов нет</p>
          <span>Файлы появятся при создании задач</span>
        </div>
      ) : (
        <div className="files-grid">
          {filteredFiles.map((file) => (
            <div key={file.id} className="file-card">
              <div className="file-card-icon">
                {getFileIcon(file.file_name)}
              </div>
              <div className="file-card-info">
                <span className="file-card-name" title={file.file_name}>
                  {file.file_name || "Файл"}
                </span>
                <span className="file-card-meta">
                  {file.uploaded_by && <span>{file.uploaded_by}</span>}
                  {file.uploaded_at && (
                    <span className="file-card-date">
                      {formatDate(file.uploaded_at)}
                    </span>
                  )}
                </span>
              </div>
              <button
                className="file-card-download"
                onClick={() => handleDownload(file)}
                title="Скачать"
              >
                ⬇️
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
