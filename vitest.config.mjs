import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    isolate: true,
    setupFiles: [],
    testTimeout: 10000,
  },
});
