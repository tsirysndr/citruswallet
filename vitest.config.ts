import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from the app config: tests never read .env.prod or use real API keys.
export default defineConfig({
  plugins: [react()],
  define: {
    "import.meta.env.VITE_KLIPY_API_KEY": JSON.stringify("test-klipy-key"),
  },
  test: {
    environment: "jsdom",
    environmentOptions: { jsdom: { url: "http://localhost:3000" } },
    include: ["web/src/**/*.test.{ts,tsx}"],
    setupFiles: ["./web/src/test/setup.ts"],
    clearMocks: true,
    restoreMocks: true,
    maxWorkers: 4,
    testTimeout: 15000,
  },
});
