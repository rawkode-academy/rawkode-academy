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

      // Validate and sanitize inputs
      const validColumns = ['event_type', 'source', 'subject', 'time'];
      const groupByColumns = args.groupBy?.filter(col => validColumns.includes(col)) || [];
      const groupByClause = groupByColumns.length ? groupByColumns.join(', ') : 'event_type';

      let query = `
        SELECT
          ${groupByClause},
          COUNT(*) as count
        FROM read_parquet('s3://analytics-source/events/**/*.parquet')
        WHERE 1=1
      `;

      if (args.eventType) {
        // Escape single quotes and validate eventType
        const escapedEventType = args.eventType.replace(/'/g, "''");
        query += ` AND type = '${escapedEventType}'`;
      }

      if (args.timeRange) {
        // Validate ISO timestamps
        const startDate = new Date(args.timeRange.start);
        const endDate = new Date(args.timeRange.end);
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
          throw new Error('Invalid time range provided');
        }
        query += ` AND time >= '${startDate.toISOString()}'::TIMESTAMP`;
        query += ` AND time <= '${endDate.toISOString()}'::TIMESTAMP`;
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

      // Normalize and validate query
      const normalizedQuery = args.query.trim();
      const upperQuery = normalizedQuery.toUpperCase();

      // Safety checks
      if (!upperQuery.startsWith('SELECT')) {
        throw new Error('Only SELECT queries are allowed');
      }

      // Additional security checks
      const forbiddenKeywords = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'EXEC', 'EXECUTE'];
      for (const keyword of forbiddenKeywords) {
        if (upperQuery.includes(keyword)) {
          throw new Error(`Query contains forbidden keyword: ${keyword}`);
        }
      }

      // Check for suspicious patterns that might indicate SQL injection attempts
      const suspiciousPatterns = [/;\s*SELECT/i, /UNION\s+SELECT/i, /--/];
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(normalizedQuery)) {
          throw new Error('Query contains suspicious patterns');
        }
      }

      // Limit query execution time (this would need to be implemented in DuckDBClient)
      const results = await client.query(normalizedQuery);
      return JSON.stringify(results, null, 2);
    } finally {
      await client.close();
    }
  },
};
