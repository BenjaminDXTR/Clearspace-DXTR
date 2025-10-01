import React from "react";
import "./ErrorPanel.css";

interface ErrorMessage {
  id: string;
  title?: string;
  message: string;
  severity?: "info" | "warning" | "error";
}

interface ErrorPanelProps {
  errors: ErrorMessage[];
  onDismiss?: (id: string) => void;
}

export default function ErrorPanel({ errors, onDismiss }: ErrorPanelProps) {
  if (errors.length === 0) return null;

  return (
    <div className="error-panel" role="alert" aria-live="polite" aria-atomic="true">
      {errors.map((err) => (
        <div
          key={err.id}
          className={`error-item error-${err.severity ?? "error"}`}
        >
          {err.title && <strong>{err.title}: </strong>}
          {err.message}
          {onDismiss && (
            <button
              className="error-dismiss"
              onClick={() => onDismiss(err.id)}
              aria-label={`Supprimer le message d’erreur: ${err.title ?? err.message}`}
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
