import tailwind from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

/* Env lives in the project root beside the server's own settings. Only
   VITE_-prefixed values are ever exposed to the bundle. */
const projectRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, projectRoot, "VITE_");
  const api = env.VITE_API_URL || "http://localhost:4747";
  const proxied = ["/api", "/auth", "/client-metadata.json"];

  return {
    root: "web",
    envDir: projectRoot,
    plugins: [react(), tailwind()],
    build: { outDir: "dist", emptyOutDir: true },
    server: {
      host: "127.0.0.1",
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
      /* changeOrigin stays off so the Host header still names this dev server:
         the API refuses a request whose host is not the app's own origin. */
      proxy: Object.fromEntries(
        proxied.map((path) => [path, { target: api, changeOrigin: false }]),
      ),
    },
  };
});
