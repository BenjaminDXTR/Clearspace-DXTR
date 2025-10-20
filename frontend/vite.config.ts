import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");

  return {
    plugins: [react()],
    server: {
      host: true, // Écoute sur toutes les interfaces (0.0.0.0)
      port: parseInt(env.FRONTEND_PORT) || 3000,
      strictPort: true,
      open: true,
    },
  };
});
