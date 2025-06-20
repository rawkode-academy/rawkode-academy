import { describe, it, expect } from 'vitest';
import { parse, validate } from 'graphql';
import { schema } from './schema';

describe('GraphQL Schema', () => {
  it('should be a valid GraphQL schema', () => {
    expect(schema).toBeDefined();
    expect(schema.getQueryType()).toBeDefined();
  });

  it('should define Query type', () => {
    const queryType = schema.getQueryType();
    
    expect(queryType).toBeDefined();
    expect(queryType?.name).toBe('Query');
  });

  it('should have catalog query', () => {
    const queryType = schema.getQueryType();
    const catalogField = queryType?.getFields()['catalog'];
    
    expect(catalogField).toBeDefined();
    expect(catalogField?.type.toString()).toBe('Catalog');
  });

  it('should have analytics query', () => {
    const queryType = schema.getQueryType();
    const analyticsField = queryType?.getFields()['analytics'];
    
    expect(analyticsField).toBeDefined();
    expect(analyticsField?.type.toString()).toBe('Analytics!');
  });

  it('should define all required types', () => {
    // Check for existence of all types
    expect(schema.getType('Analytics')).toBeDefined();
    expect(schema.getType('EventCount')).toBeDefined();
    expect(schema.getType('Catalog')).toBeDefined();
    expect(schema.getType('TableMetadata')).toBeDefined();
    expect(schema.getType('TimeRangeInput')).toBeDefined();
  });

  it('should have correct field types for EventCount', () => {
    const eventCountType = schema.getType('EventCount') as any;
    const fields = eventCountType.getFields();
    
    expect(fields.dimensions.type.toString()).toBe('String!');
    expect(fields.count.type.toString()).toBe('Int!');
  });

  it('should have correct field types for Catalog', () => {
    const catalogType = schema.getType('Catalog') as any;
    const fields = catalogType.getFields();
    
    expect(fields.version.type.toString()).toBe('String!');
    expect(fields.lastUpdated.type.toString()).toBe('String!');
    expect(fields.tables.type.toString()).toBe('[TableMetadata!]!');
  });

  it('should validate a correct query', () => {
    const query = parse(`
      query {
        catalog {
          version
          lastUpdated
          tables {
            tableName
            eventType
            totalRows
          }
        }
      }
    `);
    
    const errors = validate(schema, query);
    expect(errors).toHaveLength(0);
  });

  it('should validate analytics query', () => {
    const query = parse(`
      query {
        analytics {
          eventCounts(eventType: "pageview") {
            dimensions
            count
          }
        }
      }
    `);
    
    const errors = validate(schema, query);
    expect(errors).toHaveLength(0);
  });

  it('should invalidate a query with wrong field', () => {
    const query = parse(`
      query {
        nonExistentField
      }
    `);
    
    const errors = validate(schema, query);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain('Cannot query field');
  });
});