import React from 'react';

interface HistoryFileSelectorProps {
  historyFiles: string[];
  currentFile: string | null;
  onSelectFile: (filename: string) => void;
}

export default function HistoryFileSelector({ historyFiles, currentFile, onSelectFile }: HistoryFileSelectorProps) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <label htmlFor="history-file-select" style={{ marginRight: '0.5rem', fontWeight: 'bold' }}>
        Choisir un fichier historique :
      </label>
      <select
        id="history-file-select"
        value={currentFile || ''}
        onChange={(e) => onSelectFile(e.target.value)}
        style={{ padding: '0.3rem 0.5rem' }}
      >
        <option value="" disabled>-- Sélectionnez un fichier --</option>
        {historyFiles.map((file) => (
          <option key={file} value={file}>
            {file}
          </option>
        ))}
      </select>
    </div>
  );
}