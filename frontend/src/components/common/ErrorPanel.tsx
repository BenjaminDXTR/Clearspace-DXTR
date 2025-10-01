import React, { useEffect } from "react";
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
  // Auto-dismiss erreurs info et warning après 10 secondes
  useEffect(() => {
    if (!onDismiss) return;
    const timeouts: NodeJS.Timeout[] = [];

    errors.forEach(err => {
      if (err.severity === "info" || err.severity === "warning") {
        const t = setTimeout(() => {
          onDismiss(err.id);
        }, 10000);
        timeouts.push(t);
      }
    });

    return () => {
      timeouts.forEach(t => clearTimeout(t));
    };
  }, [errors, onDismiss]);

  if (errors.length === 0) return null;

  return (
    <div className="error-panel" role="alert" aria-live="assertive" aria-atomic="true">
      {errors.map((err) => (
        <div
          key={err.id}
          className={`error-item error-${err.severity ?? "error"}`}
          tabIndex={0}
        >
          {err.title && <strong>{err.title}: </strong>}
          {err.message}
          {(err.severity === "info" || err.severity === "warning") && onDismiss && (
            <button
              className="error-dismiss"
              onClick={() => onDismiss(err.id)}
              aria-label={`Supprimer le message d’erreur: ${err.title ?? err.message}`}
            >
              &times;
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
