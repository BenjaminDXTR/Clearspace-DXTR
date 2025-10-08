import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [react()],
    server: {
      port: parseInt(env.FRONTEND_PORT) || 3000,
      strictPort: true, // Stoppe le serveur si le port est déjà utilisé
      open: true,
    },
  };
});
