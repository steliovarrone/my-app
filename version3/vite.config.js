import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

// Vite assumes a single-page app by default: one index.html, one entry point.
// We have three pages, so each one has to be declared as its own entry.
// Anything not listed here simply won't make it into dist/.
const page = (name) => fileURLToPath(new URL(`./${name}`, import.meta.url))

export default defineConfig({
  build: {
    outDir: 'dist',        // this name must match output_location in the workflow
    emptyOutDir: true,     // wipe dist/ each build so deleted files don't linger
    rollupOptions: {
      input: {
        main:     page('index.html'),
        about:    page('about.html'),
        notfound: page('404.html'),
      },
    },
  },

  server: {
    port: 5173,
    open: true,            // `npm run dev` pops open a browser
  },
})
