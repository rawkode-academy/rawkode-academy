# @RawkodeAcademy Show Data

## Why Am I Not Using Prisma?

- Prisma currently doesn't support PostgreSQL `GENERATED ALWAYS AS ... STORED`
  - We use this to set the ID on the people table, from the GitHub handle.
- Prisma currently doesn't support creating VIEWS
  - We use these VIEWS to flatten the many to many relationships with Hasura

Prisma is working on these features, so I'll double back in 6 months. My data structure will rarely change, so this isn't a big deal.
