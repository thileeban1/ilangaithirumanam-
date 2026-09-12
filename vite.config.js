import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Served from https://<user>.github.io/ilangaithirumanam-/ via GitHub Pages.
// NOTE: if you rename the repo, update this base path to match, or the
// built JS/CSS files will 404 even though the page itself loads.
export default defineConfig({
  plugins: [react()],
  base: "/ilangaithirumanam-/",
});
