import { defineConfig } from 'vite';

export default defineConfig({
  base: '/inochi2d-test/',

  build: {
    rollupOptions: {
      input: {
        main: 'index.html',
        faceTest: 'face-test.html',
      },
    },
  },
});
