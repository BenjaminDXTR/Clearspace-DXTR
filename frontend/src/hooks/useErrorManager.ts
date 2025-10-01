import { useState, useCallback } from "react";

export interface ErrorMessage {
    id: string;
    message: string;
    severity?: "info" | "warning" | "error";
    dismissible?: boolean;
}

const MAX_HISTORY = 20;

export function useErrorManager() {
    // Etat des erreurs visibles
    const [errors, setErrors] = useState<ErrorMessage[]>([]);
    // Historique pour debug
    const [errorHistory, setErrorHistory] = useState<ErrorMessage[]>([]);

    // Ajout d'une erreur si elle n’existe pas déjà
    const addError = useCallback((error: ErrorMessage) => {
        setErrors(prev => {
            const duplicate = prev.find(e =>
                e.message === error.message && e.severity === error.severity && e.id === error.id);
            if (duplicate) return prev;

            const newList = [...prev, error];

            // Priorisation par sévérité : error > warning > info
            newList.sort((a, b) => {
                const priority = { error: 3, warning: 2, info: 1 };
                return (priority[b.severity ?? "info"] ?? 0) - (priority[a.severity ?? "info"] ?? 0);
            });
            return newList;
        });

        // Maintien d’un historique limité
        setErrorHistory(prevHist => {
            const newHist = [...prevHist, error];
            if (newHist.length > MAX_HISTORY) newHist.shift();
            return newHist;
        });
    }, []);

    // Suppression d’une erreur par ID
    const dismissError = useCallback((id: string) => {
        setErrors(prev => prev.filter(e => e.id !== id));
    }, []);

    // Erreurs critiques extraites
    const criticalErrors = errors.filter(e => e.severity === "error");

    return {
        errors,
        criticalErrors,
        errorHistory,
        addError,
        dismissError,
    };
}
