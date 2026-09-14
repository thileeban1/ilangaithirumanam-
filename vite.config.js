import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Relative base so the same build works whether it's served from a subpath
// (GitHub Pages: https://<user>.github.io/ilangaithirumanam-/) or from the
// root of a domain (Firebase Hosting: https://<project>.web.app/).
export default defineConfig({
  plugins: [react()],
  base: "./",
});
