# @RawkodeAcademy Show Data

## Why Am I Not Using Prisma?

- Prisma currently doesn't support PostgreSQL `GENERATED ALWAYS AS ... STORED`
  - We use this to set the ID on the people table, from the GitHub handle.
- Prisma currently doesn't support creating VIEWS
  - We use these VIEWS to flatten the many to many relationships with Hasura

Prisma is working on these features, so I'll double back in 6 months. My data structure will rarely change, so this isn't a big deal.


## Example Queries

```sql
INSERT INTO "episodes" (title, show, live, "scheduledFor") VALUES ('LIVE TEST', 'rawkode-live', true, '2022-01-01T01:02:03Z');
INSERT INTO "episodes" (title, show, live) VALUES ('NOT LIVE TEST', 'rawkode-live', false);
INSERT INTO "episodes" (title, show, live, chapters) VALUES ('CHAPTER TEST', 'rawkode-live', false, array[row('5M1S', '5 mins 1 sec title')::chapter]);
```
