import { defineContentConfig, defineCollection, z } from '@nuxt/content';

export default defineContentConfig({
  collections: {
    changelog: defineCollection({
      type: 'page',
      source: 'changelog/*.md',
      schema: z.object({
        version: z.string(),
        date: z.string(),
        title: z.string(),
        badge: z.string().optional(),
        isLatest: z.boolean().optional(),
        githubReleaseUrl: z.string().optional()
      })
    })
  }
});
