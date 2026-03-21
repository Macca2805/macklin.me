import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.string(),
    hero: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(),
  }),
});

const talks = defineCollection({
  loader: glob({ pattern: '**/*.{md,mdx}', base: './src/content/talks' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    date: z.string(),
    hero: z.string().optional(),
    description: z.string().optional(),
    type: z.string().optional(),
  }),
});

export const collections = { posts, talks };
