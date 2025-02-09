import react from "@vitejs/plugin-react-swc";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      "*.wasm": {
        "Content-Type": "application/wasm",
      },
    },
  },
  base: "./",
  optimizeDeps: {
    exclude: ["babylon-mmd"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
