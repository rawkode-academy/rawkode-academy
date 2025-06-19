import type { Context, TimeRange } from '../types';
import { DuckDBClient } from '../utils/duckdb-client';

interface EventCountArgs {
  eventType?: string;
  timeRange?: TimeRange;
  groupBy?: string[];
}

interface RawQueryArgs {
  query: string;
}

export const analyticsResolver = {
  async eventCounts(_parent: unknown, args: EventCountArgs, context: Context) {
    const client = new DuckDBClient(context.env);

    try {
      await client.initialize();

      // Build the query
      const groupByClause = args.groupBy?.length ? args.groupBy.join(', ') : 'event_type';

      let query = `
        SELECT
          ${groupByClause},
          COUNT(*) as count
        FROM read_parquet('s3://analytics-source/events/**/*.parquet')
        WHERE 1=1
      `;

      if (args.eventType) {
        query += ` AND type = '${args.eventType}'`;
      }

      if (args.timeRange) {
        query += ` AND time >= '${args.timeRange.start}'::TIMESTAMP`;
        query += ` AND time <= '${args.timeRange.end}'::TIMESTAMP`;
      }

      query += ` GROUP BY ${groupByClause} ORDER BY count DESC`;

      const results = await client.query(query);

      // Transform results to match GraphQL schema
      return results.map((row: Record<string, unknown>) => {
        const dimensions: Record<string, unknown> = {};
        if (args.groupBy) {
          for (const key of args.groupBy) {
            dimensions[key] = row[key];
          }
        } else {
          dimensions.event_type = row.event_type;
        }
        return {
          dimensions: JSON.stringify(dimensions),
          count: row.count as number,
        };
      });
    } finally {
      await client.close();
    }
  },

  async rawQuery(_parent: unknown, args: RawQueryArgs, context: Context) {
    const client = new DuckDBClient(context.env);

    try {
      await client.initialize();

      // Safety check - only allow SELECT queries
      if (!args.query.trim().toUpperCase().startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
      }

      const results = await client.query(args.query);
      return JSON.stringify(results, null, 2);
    } finally {
      await client.close();
    }
  },
};
