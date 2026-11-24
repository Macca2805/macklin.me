import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import expressiveCode from 'astro-expressive-code';
import mermaid from 'astro-mermaid';

export default defineConfig({
  site: 'https://macklin.me',
  integrations: [
    mermaid({
      theme: 'neutral',
      autoTheme: true,
      mermaidConfig: {
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      },
    }),
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
