import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, "../..", "");
  const serverOrigin =
    process.env.VITE_SERVER_ORIGIN ??
    env.VITE_SERVER_ORIGIN ??
    "http://localhost:3002";

  return {
    plugins: [react()],
    server: {
      port: 5173,
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
