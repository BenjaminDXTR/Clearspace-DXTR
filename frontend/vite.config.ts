import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  // Charger les variables .env du dossier racine (../) au lieu du dossier frontend
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.FRONTEND_PORT) || 3000,
      strictPort: true,
      open: true,
    },
  };
});
