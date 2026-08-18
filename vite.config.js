import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths so the build runs from any location: a root domain,
  // a GitHub Pages project subfolder (/repo-name/), or an itch.io HTML5 upload.
  base: "./",
});
