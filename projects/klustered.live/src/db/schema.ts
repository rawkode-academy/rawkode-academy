// Re-export the portal's Drizzle schema. klustered.dev owns the source of
// truth; klustered.live reads through the same D1 binding.
export * from "../../../klustered.dev/src/db/schema.ts";
