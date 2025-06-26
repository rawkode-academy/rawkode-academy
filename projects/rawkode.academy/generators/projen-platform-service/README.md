# Projen Platform Service Template

A projen template for creating GraphQL microservices following the Rawkode Academy platform architecture.

## Features

- 🚀 GraphQL Federation with Apollo Federation v2
- 💾 Cloudflare D1 database with Drizzle ORM
- ⚡ Cloudflare Workers runtime
- 📝 TypeScript with strict mode
- 🔄 Optional write model with Cloudflare Workflows
- 🧪 Optional test suite with Bun test
- 🎯 Consistent project structure
- 📦 Managed dependencies and configuration

## Installation

```bash
npm install @rawkode-academy/projen-platform-service --save-dev
# or
yarn add @rawkode-academy/projen-platform-service --dev
# or
bun add @rawkode-academy/projen-platform-service --dev
```

## Usage

Create a `.projenrc.ts` file in your project root:

```typescript
import { Project } from 'projen';
import { PlatformServiceProject } from '@rawkode-academy/projen-platform-service';

const project = new Project({
  name: 'my-services',
  // ... other project options
});

// Create a new platform service
new PlatformServiceProject(project, {
  serviceName: 'user-profiles',
  serviceDescription: 'GraphQL service for managing user profiles',
  tableName: 'user_profiles',
  graphqlTypeName: 'UserProfile',
  
  // Optional features
  includeWriteModel: true,
  includeTests: true,
  extendsVideo: false, // This service doesn't extend Video type
  
  // Database configuration
  databaseId: 'your-d1-database-id', // Or leave empty to set later
  
  // Note: Schemas are now hand-crafted by the author
  // The schemaFields and databaseColumns options are deprecated
  // You'll need to manually create your data-model/schema.ts and read-model/schema.ts files
  
  // Custom scripts
  customScripts: {
    'seed': 'bun run data-model/seed.ts',
  },
});

project.synth();
```

Then run:

```bash
npx projen
```

## Configuration Options

### Required Options

- `serviceName`: The name of the service (lowercase with hyphens)
- `serviceDescription`: Brief description of the service
- `tableName`: Primary database table name (singular)
- `graphqlTypeName`: GraphQL type name (PascalCase)

### Optional Features

- `includeWriteModel`: Include write operations via Cloudflare Workflows (default: false)
- `includeTests`: Include test suite (default: false)
- `extendsVideo`: Whether this service extends the Video type (default: true)
- `useDurableObjects`: Use Cloudflare Durable Objects (default: false)

### Database Configuration

- `databaseId`: Cloudflare D1 Database ID (optional, can be set later)

### Schema Management

**Important**: Schemas are now hand-crafted by the author. The `schemaFields` and `databaseColumns` options are deprecated and no longer generate schema files.

You need to manually create:
- `data-model/schema.ts` - Your Drizzle ORM schema definition
- `read-model/schema.ts` - Your GraphQL schema using Pothos

### Dependencies

- `additionalDependencies`: Extra npm dependencies
- `additionalDevDependencies`: Extra dev dependencies

### Scripts

- `customScripts`: Additional npm scripts to include

## Examples

### Basic Service

```typescript
new PlatformServiceProject(project, {
  serviceName: 'chapters',
  serviceDescription: 'Manages video chapters',
  tableName: 'chapters',
  graphqlTypeName: 'Chapter',
});
```

### Service with Write Model

```typescript
new PlatformServiceProject(project, {
  serviceName: 'comments',
  serviceDescription: 'User comments on videos',
  tableName: 'comments',
  graphqlTypeName: 'Comment',
  includeWriteModel: true,
  // Note: You'll need to manually create schema files
  // data-model/schema.ts and read-model/schema.ts
});
```

### Service with Custom Dependencies

```typescript
new PlatformServiceProject(project, {
  serviceName: 'analytics',
  serviceDescription: 'Analytics tracking service',
  tableName: 'analytics_events',
  graphqlTypeName: 'AnalyticsEvent',
  extendsVideo: false,
  additionalDependencies: {
    '@cloudflare/analytics-engine': '^1.0.0',
    'date-fns': '^3.0.0',
  },
  customScripts: {
    'export': 'bun run scripts/export-analytics.ts',
  },
});
```

### Complete Example with All Features

```typescript
new PlatformServiceProject(project, {
  serviceName: 'course-progress',
  serviceDescription: 'Tracks user progress through courses',
  tableName: 'course_progress',
  graphqlTypeName: 'CourseProgress',
  
  // Enable all features
  includeWriteModel: true,
  includeTests: true,
  extendsVideo: true,
  
  // Database setup
  databaseId: process.env.D1_DATABASE_ID,
  
  // Note: Manually create your schema files:
  // - data-model/schema.ts for database tables
  // - read-model/schema.ts for GraphQL types
  
  // Custom scripts
  customScripts: {
    'migrate:fresh': 'bun run wrangler d1 migrations drop && bun run wrangler d1 migrations apply',
    'analytics': 'bun run scripts/progress-analytics.ts',
  },
});
```

## Generated Structure

The template creates the following structure:

```
<service-name>/
├── README.md              # Service documentation
├── package.json           # Dependencies and scripts
├── tsconfig.json          # TypeScript configuration
├── biome.json             # Code formatting/linting
├── dagger.json            # Dagger CI configuration
├── data-model/
│   ├── schema.ts          # Drizzle ORM schema
│   ├── drizzle.config.ts  # Drizzle configuration
│   ├── client.ts          # Database client
│   ├── integrations/
│   │   └── zod.ts         # Zod validation schemas
│   └── migrations/        # Database migrations
├── read-model/
│   ├── main.ts            # Worker entry point
│   ├── schema.ts          # GraphQL schema
│   ├── publish.ts         # Schema publishing
│   └── wrangler.jsonc     # Worker configuration
├── write-model/           # (Optional) Write operations
│   ├── main.ts            # HTTP API endpoints
│   ├── workflow.ts        # Cloudflare Workflow
│   └── wrangler.jsonc     # Worker configuration
└── tests/                 # (Optional) Test suite
    ├── setup.ts           # Test setup
    └── *.test.ts          # Test files
```

## Post-Generation Steps

After running `npx projen`:

1. **Navigate to the service directory**:
   ```bash
   cd <service-name>
   ```

2. **Create D1 database** (if not provided):
   ```bash
   bun run wrangler d1 create <service-name>-db
   ```

3. **Update wrangler.jsonc files** with the database ID

4. **Generate initial migration**:
   ```bash
   bun run drizzle-kit generate
   ```

5. **Apply migrations**:
   ```bash
   bun run wrangler d1 migrations apply <service-name>-db
   ```

6. **Publish GraphQL schema**:
   ```bash
   bun run publish:schema
   ```

7. **Deploy**:
   ```bash
   bun run deploy:read
   bun run deploy:write  # If write model included
   ```

## Advanced Usage

### Manual Schema Creation

Since schemas are now hand-crafted, you'll need to create your own schema files. Here's an example structure for a basic schema:

```typescript
// data-model/schema.ts
import { text, integer, sqliteTable } from 'drizzle-orm/sqlite-core';

export const myTable = sqliteTable('my_table', {
  id: text('id').primaryKey(),
  // Add your custom columns here
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});
```

### Multiple Services

```typescript
// Create multiple related services
const services = [
  {
    serviceName: 'courses',
    graphqlTypeName: 'Course',
    tableName: 'courses',
  },
  {
    serviceName: 'lessons',
    graphqlTypeName: 'Lesson',
    tableName: 'lessons',
  },
  {
    serviceName: 'enrollments',
    graphqlTypeName: 'Enrollment',
    tableName: 'enrollments',
  },
];

services.forEach(config => {
  new PlatformServiceProject(project, {
    ...config,
    serviceDescription: `Manages ${config.serviceName}`,
    includeWriteModel: true,
    includeTests: true,
  });
});
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT