// src/hooks/useDebugLogger.ts
import { useCallback } from "react";

/**
 * Hook pour logger des messages de debug de façon conditionnelle.
 * @param enabled Activation ou désactivation du logging.
 * @param namespace Optionnel, préfixe pour identifier le contexte du log.
 * @returns Fonction d'écriture dans la console si activée.
 */
export default function useDebugLogger(enabled: boolean, namespace?: string) {
  return useCallback((...args: any[]) => {
    if (enabled) {
      if (namespace) {
        console.log(`[${namespace}]`, ...args);
      } else {
        console.log(...args);
      }
    }
  }, [enabled, namespace]);
}
