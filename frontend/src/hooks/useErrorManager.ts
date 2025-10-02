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

  // Ajout d'une erreur avec déduplication stricte prenant en compte title/message/severity
  const addError = useCallback((error: ErrorMessage) => {
    setErrors((prev) => {
        // Chercher doublon strictement par id
        const duplicate = prev.find(e => e.id === error.id);
        if (duplicate) return prev;

        const newList = [...prev, error];
        newList.sort((a, b) => {
        const priority = { error: 3, warning: 2, info: 1 };
        return (priority[b.severity ?? "info"] ?? 0) - (priority[a.severity ?? "info"] ?? 0);
        });
        return newList;
    });

    setErrorHistory((prevHist) => {
        const duplicateHist = prevHist.find(e => e.id === error.id);
        if (duplicateHist) return prevHist.length >= MAX_HISTORY ? prevHist.slice(1) : prevHist;
        const newHist = [...prevHist, error];
        if (newHist.length > MAX_HISTORY) newHist.shift();
        return newHist;
    });
    }, []);

  // Suppression d’une erreur par id
  const dismissError = useCallback((id: string) => {
    setErrors((prev) => prev.filter((e) => e.id !== id));
  }, []);

  // Extraction d'erreurs critiques
  const criticalErrors = errors.filter((e) => e.severity === "error");

  return {
    errors,
    criticalErrors,
    errorHistory,
    addError,
    dismissError,
  };
}
