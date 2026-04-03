import { useState, useEffect } from "react";
import { useAuthStore } from "../store/authStore";
import { filesAPI } from "../api";
import "./Files.css";

export default function Files() {
  const { user } = useAuthStore();
  const [firmsWithFiles, setFirmsWithFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedFirm, setExpandedFirm] = useState(null);
  const [allFirmFiles, setAllFirmFiles] = useState({});

  useEffect(() => {
    if (!user?.firmId && user?.role !== "admin") return;

    const loadData = async () => {
      try {
        if (user?.role === "admin") {
          // Админ: загружаем все фирмы и их файлы
          const firmsRes = await fetch("/api/firms");
          if (firmsRes.ok) {
            const firms = await firmsRes.json();
            const firmsData = await Promise.all(
              firms.map(async (firm) => {
                const filesRes = await fetch(`/api/firms/${firm.id}/files`);
                const files = filesRes.ok ? await filesRes.json() : [];
                return {
                  ...firm,
                  files: files.slice(0, 5), // последние 5
                  totalFiles: files.length,
                  allFiles: files,
                };
              }),
            );
            setFirmsWithFiles(firmsData);
          }
        } else {
          // Сотрудник: файлы своей фирмы
          const filesRes = await fetch(`/api/firms/${user.firmId}/files`);
          if (filesRes.ok) {
            const files = await filesRes.json();
            setFirmsWithFiles([
              {
                id: user.firmId,
                name: user.firmName,
                files: files.slice(0, 5),
                totalFiles: files.length,
                allFiles: files,
              },
            ]);
          }
        }
      } catch (err) {
        console.error("Error loading files:", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [user]);

  const handleExpand = async (firm) => {
    if (expandedFirm === firm.id) {
      setExpandedFirm(null);
      return;
    }

    // Если файлы уже загружены — просто показываем
    if (firm.allFiles) {
      setExpandedFirm(firm.id);
      return;
    }

    // Загружаем все файлы фирмы
    try {
      const res = await fetch(`/api/firms/${firm.id}/files`);
      if (res.ok) {
        const files = await res.json();
        setAllFirmFiles((prev) => ({ ...prev, [firm.id]: files }));
        setExpandedFirm(firm.id);
      }
    } catch (err) {
      console.error("Error loading firm files:", err);
    }
  };

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

  const getDisplayFiles = (firm) => {
    if (expandedFirm === firm.id) {
      return firm.allFiles || firm.allFiles || [];
    }
    return firm.files || [];
  };

  if (loading) return <div className="files-loading">Загрузка файлов...</div>;

  if (firmsWithFiles.length === 0) {
    return (
      <div className="files-page">
        <h2 className="files-title">📁 Файлы</h2>
        <div className="files-empty">
          <div className="files-empty-icon">📂</div>
          <p>Файлов нет</p>
          <span>Файлы появятся при создании задач</span>
        </div>
      </div>
    );
  }

  return (
    <div className="files-page">
      <h2 className="files-title">📁 Файлы</h2>

      {firmsWithFiles.map((firm) => (
        <div key={firm.id} className="files-firm-section">
          <div className="files-firm-header">
            <h3 className="files-firm-name">{firm.name}</h3>
            <span className="files-firm-count">
              {firm.totalFiles} файл
              {firm.totalFiles === 1 ? "" : firm.totalFiles < 5 ? "а" : "ов"}
            </span>
          </div>

          {firm.totalFiles === 0 ? (
            <div className="files-firm-empty">
              <p>Нет файлов</p>
            </div>
          ) : (
            <>
              <div className="files-grid">
                {getDisplayFiles(firm).map((file) => (
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

              {firm.totalFiles > 5 && (
                <button
                  className="files-show-all-btn"
                  onClick={() => handleExpand(firm)}
                >
                  {expandedFirm === firm.id
                    ? "▲ Свернуть"
                    : `▼ Увидеть все файлы (${firm.totalFiles})`}
                </button>
              )}
            </>
          )}
        </div>
      ))}
    </div>
  );
}
