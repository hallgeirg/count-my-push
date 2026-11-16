import { defineConfig } from "vitest/config";

// Root tests only (backend). mobile/ has its own vitest setup.
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    exclude: ["mobile/**", "node_modules/**"],
    environment: "node",
    maxWorkers: 3,
  },
});
