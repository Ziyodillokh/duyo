import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Dev/preview proxy: the admin app calls `/v1/...` (relative) and the proxy
// forwards to the local backend (uvicorn on :8000). In production the admin
// host (admin.duyo.uz) proxies /v1 to the API, or VITE_API_BASE_URL is set.
const proxy = {
  "/v1": { target: "http://localhost:8000", changeOrigin: true },
};

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: { proxy },
  preview: { proxy },
});
