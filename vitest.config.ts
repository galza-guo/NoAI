import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.{js,mjs,cjs,ts,tsx}"],
    exclude: [...configDefaults.exclude, "**/.worktrees/**"],
  },
});
