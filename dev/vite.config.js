import { defineConfig } from 'vite';
import { resolve } from 'path';

// The playground imports from ../src/* so HMR triggers on edits to library
// source files. We add ../src to fs.allow so Vite will serve those files.
export default defineConfig({
  root: __dirname,
  server: {
    fs: {
      allow: [resolve(__dirname, '..')],
    },
  },
});
