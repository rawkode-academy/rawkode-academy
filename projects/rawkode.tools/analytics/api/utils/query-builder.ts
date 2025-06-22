// Safe query builder for DuckDB that prevents SQL injection
export class QueryBuilder {
  private selectClause: string[] = [];
  private fromClause: string = '';
  private whereConditions: string[] = [];
  private groupByClause: string[] = [];
  private orderByClause: string[] = [];
  private parameters: Map<string, any> = new Map();

  select(...columns: string[]): this {
    // Validate column names to prevent injection
    const validColumns = columns.filter(col => this.isValidIdentifier(col));
    this.selectClause.push(...validColumns);
    return this;
  }

  from(table: string): this {
    // Validate table name
    if (this.isValidTablePath(table)) {
      this.fromClause = table;
    }
    return this;
  }

  where(column: string, operator: string, value: any): this {
    if (!this.isValidIdentifier(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    
    const validOperators = ['=', '!=', '<', '>', '<=', '>=', 'LIKE', 'IN', 'NOT IN'];
    if (!validOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}`);
    }

    // Generate a unique parameter placeholder
    const paramName = `param${this.parameters.size}`;
    this.parameters.set(paramName, value);
    
    // For DuckDB, we'll need to properly escape the value inline
    // since it doesn't support traditional parameter binding
    const escapedValue = this.escapeValue(value);
    this.whereConditions.push(`${column} ${operator} ${escapedValue}`);
    
    return this;
  }

  whereRaw(condition: string): this {
    // Only allow specific safe patterns
    if (!/^[a-zA-Z0-9_]+ (=|!=|<|>|<=|>=) \?$/.test(condition)) {
      throw new Error('Unsafe WHERE condition');
    }
    this.whereConditions.push(condition);
    return this;
  }

  groupBy(...columns: string[]): this {
    const validColumns = columns.filter(col => this.isValidIdentifier(col));
    this.groupByClause.push(...validColumns);
    return this;
  }

  orderBy(column: string, direction: 'ASC' | 'DESC' = 'ASC'): this {
    if (!this.isValidIdentifier(column)) {
      throw new Error(`Invalid column name: ${column}`);
    }
    this.orderByClause.push(`${column} ${direction}`);
    return this;
  }

  build(): string {
    const parts: string[] = [];

    // SELECT
    if (this.selectClause.length === 0) {
      throw new Error('SELECT clause is required');
    }
    parts.push(`SELECT ${this.selectClause.join(', ')}`);

    // FROM
    if (!this.fromClause) {
      throw new Error('FROM clause is required');
    }
    parts.push(`FROM ${this.fromClause}`);

    // WHERE
    if (this.whereConditions.length > 0) {
      parts.push(`WHERE ${this.whereConditions.join(' AND ')}`);
    }

    // GROUP BY
    if (this.groupByClause.length > 0) {
      parts.push(`GROUP BY ${this.groupByClause.join(', ')}`);
    }

    // ORDER BY
    if (this.orderByClause.length > 0) {
      parts.push(`ORDER BY ${this.orderByClause.join(', ')}`);
    }

    return parts.join('\n');
  }

  private isValidIdentifier(identifier: string): boolean {
    // Allow alphanumeric, underscore, dot (for table.column), parentheses, asterisk, and space
    // for expressions like 'COUNT(*) as count'
    return /^[a-zA-Z0-9_\.\(\)\*\s]+$/.test(identifier) && identifier.trim().length > 0;
  }

  private isValidTablePath(path: string): boolean {
    // Allow read_parquet with S3 paths
    const parquetPattern = /^read_parquet\(['"]s3:\/\/[a-zA-Z0-9\-_\/\*\.]+['"]\)$/;
    return parquetPattern.test(path) || this.isValidIdentifier(path);
  }

  private escapeValue(value: any): string {
    if (value === null) {
      return 'NULL';
    }

    if (typeof value === 'number') {
      // Validate number to prevent injection
      if (!isFinite(value)) {
        throw new Error('Invalid number value');
      }
      return value.toString();
    }

    if (typeof value === 'boolean') {
      return value ? 'TRUE' : 'FALSE';
    }

    if (value instanceof Date) {
      // Validate date
      if (isNaN(value.getTime())) {
        throw new Error('Invalid date value');
      }
      return `'${value.toISOString()}'::TIMESTAMP`;
    }

    if (typeof value === 'string') {
      // Escape single quotes by doubling them
      // This is the standard SQL way to escape quotes
      const escaped = value.replace(/'/g, "''");
      
      // Additional validation to prevent other injection attempts
      // Check for null bytes and other control characters
      if (/[\x00-\x1F\x7F]/.test(value)) {
        throw new Error('String contains invalid control characters');
      }
      
      return `'${escaped}'`;
    }

    if (Array.isArray(value)) {
      // For IN clauses
      const escapedValues = value.map(v => this.escapeValue(v));
      return `(${escapedValues.join(', ')})`;
    }

    throw new Error(`Unsupported value type: ${typeof value}`);
  }
}

// Helper function for time range conditions
export function addTimeRangeConditions(
  builder: QueryBuilder,
  timeRange: { start: string; end: string },
  column: string = 'time'
): QueryBuilder {
  const startDate = new Date(timeRange.start);
  const endDate = new Date(timeRange.end);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    throw new Error('Invalid time range provided');
  }
  
  return builder
    .where(column, '>=', startDate)
    .where(column, '<=', endDate);
}