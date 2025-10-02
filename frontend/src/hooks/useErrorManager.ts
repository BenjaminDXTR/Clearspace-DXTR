import { useState, useCallback } from "react";

export interface ErrorMessage {
  id: string;
  title?: string;
  message: string;
  severity?: "info" | "warning" | "error";
  dismissible?: boolean;
}

const MAX_HISTORY = 20;

export function useErrorManager() {
  const [errors, setErrors] = useState<ErrorMessage[]>([]);
  const [errorHistory, setErrorHistory] = useState<ErrorMessage[]>([]);

  const addError = useCallback((error: ErrorMessage) => {
    setErrors((prev) => {
      // Eviter les doublons stricts
      if (prev.find((e) => e.id === error.id)) return prev;
      const newList = [...prev, error];
      newList.sort((a, b) => {
        const priority = { error: 3, warning: 2, info: 1 };
        return (priority[b.severity ?? "info"] ?? 0) - (priority[a.severity ?? "info"] ?? 0);
      });
      return newList;
    });

    setErrorHistory((prevHist) => {
      if (prevHist.find((e) => e.id === error.id)) {
        return prevHist.length >= MAX_HISTORY ? prevHist.slice(1) : prevHist;
      }
      const newHist = [...prevHist, error];
      if (newHist.length > MAX_HISTORY) newHist.shift();
      return newHist;
    });
  }, []);

  const dismissError = useCallback((id: string) => {
    setErrors((prev) => {
      const filtered = prev.filter((e) => e.id !== id);
      // Ne modifier que si différent
      if (filtered.length === prev.length) return prev;
      return filtered;
    });
  }, []);

  const criticalErrors = errors.filter((e) => e.severity === "error");

  return {
    errors,
    criticalErrors,
    errorHistory,
    addError,
    dismissError,
  };
}
