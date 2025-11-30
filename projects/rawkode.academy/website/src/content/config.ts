import { defineCollection, reference, z } from "astro:content";
import { glob } from "astro/loaders";
import { createCollections } from "@rawkodeacademy/content/astro";

export const collections = createCollections({ defineCollection, reference, glob, z });
