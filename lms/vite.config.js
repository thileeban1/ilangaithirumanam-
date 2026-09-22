import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the same build works from a GitHub Pages subpath or the
// root of a Firebase Hosting domain, same approach as the matrimony app.
export default defineConfig({
  plugins: [react()],
  base: "./",
});
