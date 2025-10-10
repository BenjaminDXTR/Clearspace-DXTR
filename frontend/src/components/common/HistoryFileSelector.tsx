import React from "react";

interface HistoryFileSelectorProps {
  historyFiles: string[];
  currentFile: string | null;
  onSelectFile: (filename: string) => void;
}

// Fonction pour convertir "YYYY-MM-DD" en "DD/MM/YYYY"
function formatDateFrench(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  return `${day}/${month}/${year}`;
}

// Fonction pour extraire la période et la formater en "DD/MM/YYYY to DD/MM/YYYY"
function extractPeriodFromFilename(filename: string): string {
  const match = filename.match(/history-(\d{4}-\d{2}-\d{2})_to_(\d{4}-\d{2}-\d{2})\.json/);
  if (match) {
    return `${formatDateFrench(match[1])} to ${formatDateFrench(match[2])}`;
  }
  return filename;
}

export default function HistoryFileSelector({
  historyFiles,
  currentFile,
  onSelectFile,
}: HistoryFileSelectorProps) {
  return (
    <div style={{ marginBottom: "1rem" }}>
      <label htmlFor="history-file-select" style={{ marginRight: "0.5rem", fontWeight: "bold" }}>
        Choisir un fichier historique :
      </label>
      <select
        id="history-file-select"
        value={currentFile || ""}
        onChange={(e) => onSelectFile(e.target.value)}
        style={{ padding: "0.3rem 0.5rem" }}
      >
        <option value="" disabled>
          -- Sélectionnez un fichier --
        </option>
        {historyFiles.map((file) => (
          <option key={file} value={file}>
            {extractPeriodFromFilename(file)}
          </option>
        ))}
      </select>
    </div>
  );
}
