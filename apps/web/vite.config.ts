import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const workspaceRoot = path.resolve(currentDir, "../..");

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@fuji/domain": path.resolve(workspaceRoot, "packages/domain/src/index.ts"),
      "@fuji/engine-webgl": path.resolve(
        workspaceRoot,
        "packages/engine-webgl/src/index.ts",
      ),
    },
  },
  publicDir: path.resolve(workspaceRoot, "assets"),
  server: {
    fs: {
      allow: [workspaceRoot],
    },
  },
});
