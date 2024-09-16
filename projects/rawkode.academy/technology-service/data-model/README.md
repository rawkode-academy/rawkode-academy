# Technology Services

## Data Model

### Questions

#### Why are default values in Zod and not the database?

This allows us to change the default values with a database migration.

#### Why Zod?

I really wanted to use Valibot, because I think it's the better library.

However, we need to make it possible for other services within this monorepository to work with the data model; and Zod has more integrations.

With Zod, we can:

- Generate JSON Schema
- Generate protos
- Generate anything else

Valibot isn't there yet.

Technically, we can support both. For now, we're using Zod to support other use-cases.
