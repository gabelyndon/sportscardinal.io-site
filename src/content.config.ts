import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
	schema: ({ image }) =>
		z.object({
			title: z.string(),
			date: z.coerce.date(),
			// Optional: overrides the filename-derived slug when you want a
			// different URL than the markdown file's name.
			slug: z.string().optional(),
			excerpt: z.string(),
			tags: z.array(z.string()).default([]),
			draft: z.boolean().default(false),
			heroImage: image().optional(),
		}),
});

export const collections = { blog };
