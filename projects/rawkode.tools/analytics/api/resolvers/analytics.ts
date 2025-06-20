import type { Context, TimeRange } from '../types';
import { DuckDBClient } from '../utils/duckdb-client';
import { QueryBuilder, addTimeRangeConditions } from '../utils/query-builder';

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
      const groupByClause = groupByColumns.length ? groupByColumns : ['event_type'];

      // Build query safely using QueryBuilder
      const builder = new QueryBuilder()
        .select(...groupByClause, 'COUNT(*) as count')
        .from("read_parquet('s3://analytics-source/events/**/*.parquet')");

      // Add conditions safely
      if (args.eventType) {
        builder.where('type', '=', args.eventType);
      }

      if (args.timeRange) {
        addTimeRangeConditions(builder, args.timeRange);
      }

      // Add grouping and ordering
      builder
        .groupBy(...groupByClause)
        .orderBy('count', 'DESC');

      const query = builder.build();

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
    // Consider disabling raw queries entirely in production
    if (context.env.NODE_ENV === 'production') {
      throw new Error('Raw queries are disabled in production for security reasons');
    }

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
      const forbiddenKeywords = [
        'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 
        'EXEC', 'EXECUTE', 'CALL', 'MERGE', 'REPLACE', 'ATTACH', 'DETACH',
        'INSTALL', 'LOAD', 'SET', 'PRAGMA', 'EXPORT', 'IMPORT', 'COPY'
      ];
      
      for (const keyword of forbiddenKeywords) {
        // Check for keyword with word boundaries to avoid false positives
        const keywordRegex = new RegExp(`\\b${keyword}\\b`, 'i');
        if (keywordRegex.test(normalizedQuery)) {
          throw new Error(`Query contains forbidden keyword: ${keyword}`);
        }
      }

      // Check for suspicious patterns that might indicate SQL injection attempts
      const suspiciousPatterns = [
        /;\s*SELECT/i,           // Multiple statements
        /UNION\s+SELECT/i,       // UNION attacks
        /--/,                    // SQL comments
        /\/\*/,                  // Multi-line comments
        /\bOR\b.*=.*\bOR\b/i,    // OR 1=1 style attacks
        /\bAND\b.*=.*\bAND\b/i,  // AND 1=1 style attacks
        /\bSLEEP\b/i,            // Time-based attacks
        /\bBENCHMARK\b/i,        // MySQL benchmark attacks
        /\bWAITFOR\b/i,          // SQL Server delay attacks
        /0x[0-9a-fA-F]+/,        // Hex encoding
        /CHAR\s*\(/i,            // Character encoding
        /\|\|/,                  // String concatenation
      ];
      
      for (const pattern of suspiciousPatterns) {
        if (pattern.test(normalizedQuery)) {
          throw new Error('Query contains suspicious patterns');
        }
      }

      // Additional check: ensure query only reads from allowed tables
      const allowedTables = [
        /read_parquet\s*\(\s*'s3:\/\/analytics-source\/[^']+'\s*\)/i,
        /read_parquet\s*\(\s*'s3:\/\/analytics-processed\/[^']+'\s*\)/i,
      ];
      
      let hasAllowedTable = false;
      for (const tablePattern of allowedTables) {
        if (tablePattern.test(normalizedQuery)) {
          hasAllowedTable = true;
          break;
        }
      }
      
      if (!hasAllowedTable) {
        throw new Error('Query must read from allowed analytics tables only');
      }

      // Execute query with timeout
      const results = await client.query(normalizedQuery);
      return JSON.stringify(results, null, 2);
    } finally {
      await client.close();
    }
  },
};
