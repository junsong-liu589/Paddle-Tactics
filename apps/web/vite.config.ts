import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  const serverOrigin =
    process.env.VITE_SERVER_ORIGIN ??
    env.VITE_SERVER_ORIGIN ??
    "http://localhost:3002";
  const port = Number(process.env.VITE_PORT ?? 5173);

  return {
    plugins: [react()],
    server: {
      port,
      proxy: {
        "/api": serverOrigin,
        "/health": serverOrigin,
        "/socket.io": {
          target: serverOrigin,
          ws: true,
        },
      },
    },
  };
});
