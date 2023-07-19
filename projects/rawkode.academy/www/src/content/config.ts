import { defineCollection, z } from "astro:content";

// Blog collection schema
const blogsCollection = defineCollection({
  schema: z.object({
    id: z.string().optional(),
    title: z.string(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    date: z.date().optional(),
    image: z.string().optional(),
    author: z.string().optional(),
    categories: z.array(z.string()).default(["others"]),
    draft: z.boolean().optional(),
  }),
});

// Author collection schema
const authorsCollection = defineCollection({
  schema: z.object({
    id: z.string().optional(),
    title: z.string(),
    meta_title: z.string().optional(),
    email: z.string().optional(),
    image: z.string().optional(),
    description: z.string().optional(),
    social: z
      .object({
        facebook: z.string().optional(),
        twitter: z.string().optional(),
        instagram: z.string().optional(),
      })
      .optional(),
    draft: z.boolean().optional(),
  }),
});

// careers collection
const careersCollection = defineCollection({
  schema: z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    subtitle: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    career: z
      .object({
        title: z.string().optional(),
        subtitle: z.string().optional(),
      })
      .optional(),
    date: z.string().optional(),
    draft: z.boolean().optional(),
    job_nature: z.string().optional(),
  }),
});

// case studies collection schema
const caseStudiesCollection = defineCollection({
  schema: z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    description: z.string().optional(),
    draft: z.boolean().optional(),
    date: z.string().optional(),
    image: z.string().optional(),
    year: z.string().optional(),
    location: z.string().optional(),
    company_size: z.string().optional(),
  }),
});

// Pages collection schema
const pagesCollection = defineCollection({
  schema: z.object({
    id: z.string().optional(),
    title: z.string().optional(),
    meta_title: z.string().optional(),
    description: z.string().optional(),
    image: z.string().optional(),
    layout: z.string().optional(),
    draft: z.boolean().optional(),
  }),
});

// Export collections
export const collections = {
  blog: blogsCollection,
  authors: authorsCollection,
  careers: careersCollection,
  "case-studies": caseStudiesCollection,
  pages: pagesCollection,
};
