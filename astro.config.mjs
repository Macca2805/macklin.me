import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import expressiveCode from 'astro-expressive-code';

export default defineConfig({
  site: 'https://macklin.me',
  integrations: [
    expressiveCode({
      themes: ['github-light', 'github-dark'],
      styleOverrides: {
        borderRadius: '6px',
        frames: {
          shadowColor: 'transparent',
        },
      },
    }),
    mdx(),
  ],
});
