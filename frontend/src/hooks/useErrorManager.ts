// useErrorManager.ts
import { useState, useCallback } from "react";

export interface ErrorMessage {
  id: string;
  title?: string;
  message: string;
  severity?: "info" | "warning" | "error";
  dismissible?: boolean;
}

export function useErrorManager() {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);

  // Fonction pour journaliser l'erreur côté backend dès ajout
  async function logErrorToServer(error: ErrorMessage) {
    try {
      await fetch("/api/log-error", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...error,
          timestamp: new Date().toISOString(),
        }),
      });
    } catch {
      // silencieux: évite boucle d'erreur si logger est HS
    }
  }

  const addError = useCallback((error: ErrorMessage) => {
    setErrors((prev) => {
      // Eviter doublons stricts par id
      if (prev.find((e) => e.id === error.id)) return prev;

      // Eviter doublons logiques (message + sévérité identique)
      const similarExists = prev.some(
        (e) => e.message === error.message && e.severity === error.severity
      );
      if (similarExists) return prev;

      // Envoie l'erreur à logger côté serveur
      logErrorToServer(error);

      const newList = [...prev, error];
      newList.sort((a, b) => {
        const priority = { error: 3, warning: 2, info: 1 };
        return (
          (priority[b.severity ?? "info"] ?? 0) -
          (priority[a.severity ?? "info"] ?? 0)
        );
      });
      return newList;
    });
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, []);

  // Regroupe par sévérité (error/warning)
  const groupedErrors = errors.reduce<{
    error: ErrorMessage[];
    warning: ErrorMessage[];
  }>(
    (acc, curr) => {
      if (curr.severity === "error") acc.error.push(curr);
      else if (curr.severity === "warning") acc.warning.push(curr);
      return acc;
    },
    { error: [], warning: [] }
  );

  // Fusion en message unique par sévérité
  function synthesizeMessages(
    errList: ErrorMessage[]
  ): ErrorMessage | null {
    if (errList.length === 0) return null;
    if (errList.length === 1) return errList[0];
    const combinedMessage = errList
      .map((e) =>
        e.title ? `${e.title}: ${e.message}` : e.message
      )
      .join(" | ");
    return {
      id: `grouped-${errList[0].severity}`,
      message: combinedMessage,
      severity: errList[0].severity,
      dismissible: true,
    };
  }

  const synthesizedError = synthesizeMessages(groupedErrors.error);
  const synthesizedWarning = synthesizeMessages(groupedErrors.warning);

  return {
    errors,
    addError,
    dismissError,
    groupedErrors,
    synthesizedError,
    synthesizedWarning,
  };
}
