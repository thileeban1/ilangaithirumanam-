import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://<user>.github.io/ilangaithirumanam-/ via GitHub Pages.
export default defineConfig({
  plugins: [react()],
  base: "/ilangaithirumanam-/",
});
