/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
import * as duckdb from '@duckdb/node-api';
import type { EvidenceDataDiscovery, SchemaData } from './discovery.js';
// Import fs with node protocol
import * as fs from 'node:fs';

// Define interfaces for DuckDB types based on the official documentation
// https://duckdb.org/docs/stable/clients/node_neo/overview.html
interface DuckDBInstanceType {
  connect(): Promise<DuckDBConnectionType>;
}

interface DuckDBConnectionType {
  run(query: string): Promise<DuckDBMaterializedResultType>;
}

// Interface for DuckDB result as per actual API behavior
interface DuckDBMaterializedResultType {
  // Properties
  readonly rowCount: number;        // Getter, not a method
  readonly chunkCount: number;      // Getter, not a method
  
  // Methods for Neo API
  columnNames(): string[];          // Get column names
  columnTypes(): unknown[];         // Get column types
  
  // Methods for data access
  getChunk(index: number): DuckDBDataChunkType;
}

// Interface for DuckDB data chunk as per documentation
interface DuckDBDataChunkType {
  // Properties
  readonly columnCount: number; // Getter, not a method
  readonly rowCount: number;    // Getter, not a method
  
  // Methods for accessing data
  getColumnVector(index: number): DuckDBVectorType;
  getColumns(): DuckDBVectorType[];
  getRowValues(index: number): unknown[];
  getRows(): unknown[][];
}

// Interface for DuckDB vectors
interface DuckDBVectorType {
  getValue(index: number): unknown;
  getValues(): unknown[];
}

/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
export class DuckDBDatabase {
  /** Evidence.dev data discovery interface */
  private discovery: EvidenceDataDiscovery;
  /** Database instance */
  private db: duckdb.DuckDBInstance | null = null;
  /** Connection cache */
  private connection: duckdb.DuckDBConnection | null = null;
  
  /**
   * Initialize DuckDBDatabase.
   * 
   * @param discovery Evidence.dev data discovery interface.
   */
  constructor(discovery: EvidenceDataDiscovery) {
    this.discovery = discovery;
    // We'll initialize the db lazily when needed
  }
  
  /**
   * Create and get a DuckDB connection.
   * 
   * @returns A Promise resolving to a DuckDB connection.
   */
  async connect(): Promise<duckdb.DuckDBConnection> {
    try {
      // Create the database if it doesn't exist yet
      if (!this.db) {
        // Create an in-memory database
        this.db = await duckdb.DuckDBInstance.create(':memory:');
      }
      
      // Create and return a new connection if we don't have one
      if (!this.connection) {
        this.connection = await this.db.connect();
      }
      
      return this.connection;
    } catch (error) {
      console.error('Error connecting to DuckDB:', error);
      throw new Error(`Failed to initialize DuckDB: ${(error as Error).message}`);
    }
  }
  
  /**
   * Execute a SQL query.
   * 
   * @param query The SQL query to execute.
   * @returns The query results as an array of objects.
   */
  async executeQuery(query: string): Promise<Record<string, unknown>[]> {
    try {
      const connection = await this.connect();
      
      // Execute the query with or without parameters
      const result = await connection.run(query);
      
      // Convert result to array of objects
      return this.resultToArray(result);
    } catch (e) {
      console.error('Query execution error:', e);
      throw e;
    }
  }
  
  /**
   * List all tables across all sources.
   * 
   * @returns A list of table information objects.
   */
  listTables(): { source: string; table: string }[] {
    const tables: { source: string; table: string }[] = [];
    
    const sources = this.discovery.getSources();
    for (const source of sources) {
      for (const tableName of source.tables) {
        tables.push({
          source: source.name,
          table: tableName
        });
      }
    }
    
    return tables;
  }
  
  /**
   * Get schema information for a table.
   * 
   * @param source The name of the data source.
   * @param table The name of the table.
   * @returns A list of schema field dictionaries.
   */
  describeTable(source: string, table: string): SchemaData {
    return this.discovery.getTableSchema(source, table);
  }
  
  /**
   * Execute a SQL query on the parquet data.
   * 
   * @param query The SQL query to execute.
   * @returns The query results as an array of objects.
   */
  async queryTable(query: string): Promise<unknown[]> {
    try {
      // Get a connection
      const connection = await this.connect();
      
      // Register all tables as views
      for (const source of this.discovery.getSources()) {
        const sourceName = source.name;
        
        for (const tableName of source.tables) {
          try {
            // Get path to the parquet file
            const parquetPath = this.discovery.getParquetPath(sourceName, tableName);
            
            // View name for combining source and table
            const viewName = `${sourceName}_${tableName}`;
            
            // Create a view for the parquet file with quoted identifiers to handle reserved words
            // For SQL files we can either read the content or use the file path
            if (parquetPath.endsWith('.sql')) {
              // Read the SQL file content and use it to create a view
              const sqlContent = fs.readFileSync(parquetPath, 'utf-8');
              await connection.run(`CREATE VIEW "${viewName}" AS ${sqlContent}`);
            } else {
              await connection.run(`CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`);
            }
          } catch (e) {
            // Log the error but continue with other tables
            console.warn(`Error creating view for ${sourceName}.${tableName}: ${(e as Error).message}`);
          }
        }
      }
      
      // Execute the query
      const result = await connection.run(query);
      
      // Convert to array of objects for compatibility
      return this.resultToArray(result);
    } catch (e) {
      // Log the error and re-throw
      console.error(`Error executing query: ${(e as Error).message}`);
      console.error(`Query: ${query}`);
      throw e;
    }
  }

  /**
   * Convert a DuckDB result to an array of objects.
   * 
   * @param result The DuckDB materialized result to convert.
   * @returns An array of objects representing the result rows.
   */
  public resultToArray(result: duckdb.DuckDBMaterializedResult): Record<string, unknown>[] {
    const rows: Record<string, unknown>[] = [];
    
    // Return empty array if no result
    if (!result || result.chunkCount === 0) return rows;
    
    // Get column names using DuckDB Neo API
    const columnNames = this.getColumnNamesFromResult(result);
    
    try {
      // Process each chunk of the result to build rows
      const chunkCount = result.chunkCount;
      
      for (let c = 0; c < chunkCount; c++) {
        const chunk = result.getChunk(c);
        
        // Get row count from chunk
        const rowCount = chunk.rowCount;
        
        // Get column count
        const columnCount = chunk.columnCount;
        
        // Determine column names to use
        const names = columnNames || Array.from({ length: columnCount }, (_, i) => `column${i}`);
        
        // Get all column data
        const columns = chunk.getColumns();
        
        // Use an alternate approach if direct column access fails
        if (!columns || columns.length === 0) {
          // Fallback to row-based access
          for (let r = 0; r < rowCount; r++) {
            const rowValues = chunk.getRowValues(r);
            const rowData: Record<string, unknown> = {};
            
            for (let i = 0; i < rowValues.length; i++) {
              // Handle BigInt values
              const value = rowValues[i];
              rowData[names[i]] = this.handleBigIntValue(value);
            }
            
            rows.push(rowData);
          }
          continue;
        }
        
        // Build rows from columns
        for (let r = 0; r < rowCount; r++) {
          const rowData: Record<string, unknown> = {};
          
          // Map values to column names
          for (let i = 0; i < columnCount; i++) {
            // Handle BigInt values
            const value = columns[i][r];
            rowData[names[i]] = this.handleBigIntValue(value);
          }
          
          rows.push(rowData);
        }
      }
      
      return rows;
    } catch (e) {
      console.warn('Error converting DuckDB result to array:', e);
      
      // Return empty rows array if we couldn't extract data
      return rows;
    }
  }

  /**
   * Get column names from the DuckDB result using the Neo API
   * 
   * @param result DuckDB materialized result object
   * @returns Array of column names or null if extraction fails 
   */
  private getColumnNamesFromResult(result: duckdb.DuckDBMaterializedResult): string[] | null {
    try {
      if (typeof result.columnNames === 'function') {
        return result.columnNames();
      }
      return null;
    } catch (e) {
      console.warn('Failed to extract column names from result:', e);
      return null;
    }
  }

  /**
   * Handle BigInt values for JSON serialization
   * 
   * @param value The value to check and convert if needed
   * @returns The processed value safe for JSON serialization
   */
  private handleBigIntValue(value: unknown): unknown {
    // Handle BigInt values
    if (typeof value === 'bigint') {
      return value.toString();
    }
    
    // Handle DuckDB decimal values with BigInt
    if (value && 
        typeof value === 'object' && 
        value.constructor && 
        'constructor' in value &&
        'name' in value.constructor &&
        value.constructor.name === 'DuckDBDecimalValue' && 
        'value' in value && 
        typeof value.value === 'bigint') {
      
      // If it has scale, apply it to represent a decimal
      if ('scale' in value && typeof value.scale === 'number') {
        const bigIntValue = value.value as bigint;
        const scale = value.scale as number;
        
        // Convert to string with correct decimal places
        const stringValue = bigIntValue.toString();
        if (scale === 0) {
          return stringValue;
        }
        
        if (stringValue.length <= scale) {
          // Handle small numbers that need leading zeros
          return `0.${'0'.repeat(scale - stringValue.length)}${stringValue}`;
        }
        
        // Insert decimal point at the right position
        const insertPos = stringValue.length - scale;
        return `${stringValue.substring(0, insertPos)}.${stringValue.substring(insertPos)}`;
      }
      
      // Fallback: just return the value as string
      return (value.value as bigint).toString();
    }
    
    return value;
  }
}