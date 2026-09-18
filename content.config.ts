import { defineCollection, defineContentConfig, z } from "@nuxt/content";

const contentSchema = z.object({
  title: z.string(),
  slug: z.string(),
  description: z.string(),
  category: z.string().optional(),
  order: z.number().optional(),
  date: z.string().optional(),
  seoTitle: z.string(),
  seoDescription: z.string(),
  source: z.string().optional(),
  sourceUrl: z.string().optional(),
  sourceDate: z.string().optional(),
  type: z.string().optional(),
  tags: z.array(z.string()).optional(),
  volume: z.string().optional(),
  volumeOrder: z.number().optional(),
  chapterOrder: z.number().optional(),
});

export default defineContentConfig({
  collections: {
    dao: defineCollection({
      type: "page",
      source: "dao/**/*.md",
      schema: contentSchema,
    }),
  },
});
