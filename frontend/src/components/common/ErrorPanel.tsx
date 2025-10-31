import { useEffect } from "react";
import "./ErrorPanel.css";

interface ErrorMessage {
  id: string;
  title?: string;
  message: string;
  severity?: "info" | "warning" | "error";
  dismissible?: boolean;
}

interface ErrorPanelProps {
  synthesizedError?: ErrorMessage | null;
  synthesizedWarning?: ErrorMessage | null;
  onDismiss?: (id: string) => void;
}

export default function ErrorPanel({
  synthesizedError = null,
  synthesizedWarning = null,
  onDismiss,
}: ErrorPanelProps) {
  useEffect(() => {
    if (!onDismiss) return;
    const timeouts: NodeJS.Timeout[] = [];

    // Auto-dismiss pour warnings
    if (synthesizedWarning && synthesizedWarning.dismissible !== false) {
      const t = setTimeout(() => {
        onDismiss(synthesizedWarning.id);
      }, 10000);
      timeouts.push(t);
    }

    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [synthesizedWarning, onDismiss]);

  if (!synthesizedError && !synthesizedWarning) return null;

  return (
    <div
      className="error-panel"
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
    >
      {synthesizedError && (
        <div
          className="error-item error-error"
          tabIndex={0}
          aria-label="Bloc d'erreur critique"
        >
          <strong>Erreur critique : </strong>
          {synthesizedError.message}
          {onDismiss && synthesizedError.dismissible !== false && (
            <button
              className="error-dismiss"
              onClick={() => onDismiss(synthesizedError.id)}
              aria-label={`Supprimer le message d’erreur: ${synthesizedError.message}`}
            >
              &times;
            </button>
          )}
        </div>
      )}

      {synthesizedWarning && (
        <div
          className="error-item error-warning"
          tabIndex={0}
          aria-label="Bloc d'avertissement"
        >
          <strong>Avertissement : </strong>
          {synthesizedWarning.message}
          {onDismiss && synthesizedWarning.dismissible !== false && (
            <button
              className="error-dismiss"
              onClick={() => onDismiss(synthesizedWarning.id)}
              aria-label={`Supprimer le message d’avertissement: ${synthesizedWarning.message}`}
            >
              &times;
            </button>
          )}
        </div>
      )}
    </div>
  );
}
