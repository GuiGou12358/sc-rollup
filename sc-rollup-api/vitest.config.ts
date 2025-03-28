import {defineConfig} from "vitest/config";
//import tsconfigPaths from "vite-tsconfig-paths/dist";

export default defineConfig({
  test: {
    include: ["**/*.spec.ts"],
    disableConsoleIntercept: false,
    testTimeout: 500000,
  },
  //plugins: [tsconfigPaths()]
})