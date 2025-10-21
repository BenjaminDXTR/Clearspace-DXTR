import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, ".."), "");

  // Parse la liste des hosts autorisés depuis la variable d’environnement
  const allowedHostsEnv = env.VITE_ALLOWED_HOSTS || "";
  const allowedHosts = allowedHostsEnv
    .split(",")
    .map((host) => host.trim())
    .filter((host) => host.length > 0);

  return {
    plugins: [react()],
    server: {
      host: true,
      port: parseInt(env.VITE_FRONTEND_PORT) || 3000,
      strictPort: true,
      open: true,
      allowedHosts: allowedHosts,
    },
  };
});
