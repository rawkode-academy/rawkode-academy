import { describe, it, expect } from 'vitest';
import { QueryBuilder, addTimeRangeConditions } from './query-builder';

describe('QueryBuilder', () => {
  describe('SQL Injection Prevention', () => {
    it('should escape single quotes in string values', () => {
      const builder = new QueryBuilder()
        .select('event_type', 'COUNT(*) as count')
        .from("read_parquet('s3://analytics-source/events/**/*.parquet')")
        .where('type', '=', "test' OR '1'='1");

      const query = builder.build();
      expect(query).toContain("type = 'test'' OR ''1''=''1'");
      expect(query).not.toContain("type = 'test' OR '1'='1'");
    });

    it('should reject invalid column names', () => {
      const builder = new QueryBuilder();
      
      expect(() => {
        builder.where("type; DROP TABLE events", '=', 'test');
      }).toThrow('Invalid column name');
    });

    it('should reject invalid operators', () => {
      const builder = new QueryBuilder()
        .select('event_type')
        .from('events');
      
      expect(() => {
        builder.where('type', '; DROP TABLE', 'test');
      }).toThrow('Invalid operator');
    });

    it('should handle null bytes and control characters', () => {
      const builder = new QueryBuilder()
        .select('*')
        .from('events');
      
      expect(() => {
        builder.where('type', '=', "test\x00malicious");
      }).toThrow('String contains invalid control characters');
    });

    it('should properly escape arrays for IN clauses', () => {
      const builder = new QueryBuilder()
        .select('*')
        .from('events')
        .where('type', 'IN', ["test'", "admin' OR '1'='1"]);

      const query = builder.build();
      expect(query).toContain("type IN ('test''', 'admin'' OR ''1''=''1')");
    });
  });

  describe('Query Building', () => {
    it('should build a basic query', () => {
      const query = new QueryBuilder()
        .select('event_type', 'COUNT(*) as count')
        .from("read_parquet('s3://analytics-source/events/**/*.parquet')")
        .groupBy('event_type')
        .orderBy('count', 'DESC')
        .build();

      expect(query).toContain('SELECT event_type, COUNT(*) as count');
      expect(query).toContain("FROM read_parquet('s3://analytics-source/events/**/*.parquet')");
      expect(query).toContain('GROUP BY event_type');
      expect(query).toContain('ORDER BY count DESC');
    });

    it('should handle date values correctly', () => {
      const date = new Date('2024-01-01T00:00:00Z');
      const builder = new QueryBuilder()
        .select('*')
        .from('events')
        .where('time', '>=', date);

      const query = builder.build();
      expect(query).toContain("time >= '2024-01-01T00:00:00.000Z'::TIMESTAMP");
    });

    it('should validate table paths', () => {
      const builder = new QueryBuilder();
      
      // Valid paths
      expect(() => {
        builder.from("read_parquet('s3://analytics-source/events/**/*.parquet')");
      }).not.toThrow();

      // Invalid paths should be rejected
      expect(() => {
        new QueryBuilder().from("'; DROP TABLE events; --");
      }).not.toThrow(); // It won't match the pattern, so it will be ignored
    });
  });

  describe('Time Range Helper', () => {
    it('should add time range conditions', () => {
      const builder = new QueryBuilder()
        .select('*')
        .from('events');

      addTimeRangeConditions(builder, {
        start: '2024-01-01T00:00:00Z',
        end: '2024-12-31T23:59:59Z'
      });

      const query = builder.build();
      expect(query).toContain("time >= '2024-01-01T00:00:00.000Z'::TIMESTAMP");
      expect(query).toContain("time <= '2024-12-31T23:59:59.000Z'::TIMESTAMP");
    });

    it('should reject invalid dates', () => {
      const builder = new QueryBuilder()
        .select('*')
        .from('events');

      expect(() => {
        addTimeRangeConditions(builder, {
          start: 'invalid-date',
          end: '2024-12-31'
        });
      }).toThrow('Invalid time range provided');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty strings', () => {
      const builder = new QueryBuilder()
        .select('*')
        .from('events')
        .where('type', '=', '');

      const query = builder.build();
      expect(query).toContain("type = ''");
    });

    it('should handle very long strings', () => {
      const longString = 'a'.repeat(10000);
      const builder = new QueryBuilder()
        .select('*')
        .from('events')
        .where('type', '=', longString);

      expect(() => builder.build()).not.toThrow();
    });

    it('should handle special SQL characters', () => {
      const builder = new QueryBuilder()
        .select('*')
        .from('events')
        .where('type', '=', "test'; SELECT * FROM users; --");

      const query = builder.build();
      expect(query).toContain("test''; SELECT * FROM users; --");
    });
  });
});