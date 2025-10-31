// errorService.ts
import { config } from "../config";

const ERROR_LOG_URL = config.apiUrl + "/log-error";

async function logErrorToBackend(error: {
  id: string;
  title?: string;
  message: string;
  severity?: string;
  timestamp: string;
}): Promise<void> {
  try {
    const response = await fetch(ERROR_LOG_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(error),
    });
    if (!response.ok) {
      console.error(`Erreur lors de la journalisation erreur : ${response.status} ${response.statusText}`);
    }
  } catch (err) {
    console.error("Impossible de joindre le serveur de journalisation des erreurs", err);
  }
}

export default {
  logErrorToBackend,
};
