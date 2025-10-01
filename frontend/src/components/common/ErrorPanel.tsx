import { useEffect, useState } from "react";
import "./ErrorPanel.css";

interface ErrorMessage {
  id: string;
  title?: string;
  message: string;
  severity?: "info" | "warning" | "error";
  dismissible?: boolean;
}

interface ErrorPanelProps {
  errors: ErrorMessage[];          // Liste des erreurs à afficher (filtrée)
  criticalErrors?: ErrorMessage[]; // Erreurs critiques pour alertes séparées (optionnel)
  onDismiss?: (id: string) => void;
  showHistoryToggle?: boolean;     // Afficher bouton toggle historique des erreurs
  errorHistory?: ErrorMessage[];   // Historique erreurs passées à afficher si showHistory actif
}

export default function ErrorPanel({
  errors,
  criticalErrors = [],
  onDismiss,
  showHistoryToggle = true,
  errorHistory = [],
}: ErrorPanelProps) {
  // État local indiquant si l'historique est visible
  const [showHistory, setShowHistory] = useState(false);

  // Dismiss automatique des erreurs info/warning après 10 secondes si dismissible
  useEffect(() => {
    if (!onDismiss) return;
    const timeouts: NodeJS.Timeout[] = [];

    errors.forEach((err) => {
      if ((err.severity === "info" || err.severity === "warning") && err.dismissible !== false) {
        const t = setTimeout(() => {
          onDismiss(err.id);
        }, 10000);
        timeouts.push(t);
      }
    });

    // Nettoyage des timers lors du démontage ou changement d'erreurs
    return () => {
      timeouts.forEach(clearTimeout);
    };
  }, [errors, onDismiss]);

  // Ne rien afficher si pas d’erreurs visibles ou d’historique à voir
  if (errors.length === 0 && (!showHistory || errorHistory.length === 0)) return null;

  return (
    <div className="error-panel" role="alert" aria-live="assertive" aria-atomic="true">
      {/* Section erreurs critiques distinctes */}
      {criticalErrors.length > 0 && (
        <div className="error-critical-section">
          <strong>Erreurs critiques :</strong>
          <ul>
            {criticalErrors.map((err) => (
              <li key={err.id} className="error-item error-error" tabIndex={0}>
                {err.title && <strong>{err.title}: </strong>}
                {err.message}
                {onDismiss && err.dismissible !== false && (
                  <button
                    className="error-dismiss"
                    onClick={() => onDismiss(err.id)}
                    aria-label={`Supprimer le message d’erreur: ${err.title ?? err.message}`}
                  >
                    &times;
                  </button>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Section erreurs restantes (info, warning, error) */}
      {errors.length > 0 && (
        <div className="error-general-section">
          {errors.map((err) => (
            <div
              key={err.id}
              className={`error-item error-${err.severity ?? "error"}`}
              tabIndex={0}
            >
              {err.title && <strong>{err.title}: </strong>}
              {err.message}
              {(err.severity === "info" || err.severity === "warning") && onDismiss && err.dismissible !== false && (
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
      )}

      {/* Bouton pour basculer l’affichage de l’historique */}
      {showHistoryToggle && errorHistory.length > 0 && (
        <button
          className="error-history-toggle"
          onClick={() => setShowHistory(!showHistory)}
          aria-expanded={showHistory}
          aria-controls="error-history-list"
        >
          {showHistory ? "Masquer" : "Afficher"} l'historique des erreurs ({errorHistory.length})
        </button>
      )}

      {/* Affichage de l’historique des anciennes erreurs */}
      {showHistory && errorHistory.length > 0 && (
        <div id="error-history-list" className="error-history" aria-live="polite">
          <strong>Historique des erreurs :</strong>
          <ul>
            {errorHistory.map((err) => (
              <li key={err.id} className={`error-item error-${err.severity ?? "error"}`} tabIndex={0}>
                {err.title && <strong>{err.title}: </strong>}
                {err.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
