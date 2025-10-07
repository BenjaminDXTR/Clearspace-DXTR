import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Charger les variables d'environnement du mode courant depuis le dossier racine
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      // Utiliser le port défini dans .env (ex: VITE_FRONTEND_PORT) ou 3000 par défaut
      port: parseInt(env.VITE_FRONTEND_PORT) || 3000,
      open: true,
    },
  };
});
