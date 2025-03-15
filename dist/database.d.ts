/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
import * as duckdb from '@duckdb/node-api';
import type { EvidenceDataDiscovery, SchemaData } from './discovery.js';
/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
export declare class DuckDBDatabase {
    /** Evidence.dev data discovery interface */
    private discovery;
    /** Database instance */
    private db;
    /** Connection cache */
    private connection;
    /**
     * Initialize DuckDBDatabase.
     *
     * @param discovery Evidence.dev data discovery interface.
     */
    constructor(discovery: EvidenceDataDiscovery);
    /**
     * Extracts column names from a SQL SELECT query
     *
     * @param query The SQL query to parse
     * @returns An array of column names if they can be extracted, or null if parsing fails
     */
    private extractColumnNames;
    /**
     * Create and get a DuckDB connection.
     *
     * @returns A Promise resolving to a DuckDB connection.
     */
    connect(): Promise<duckdb.DuckDBConnection>;
    /**
     * Execute a SQL query.
     *
     * @param query The SQL query to execute.
     * @returns The query results as an array of objects.
     */
    executeQuery(query: string): Promise<Record<string, unknown>[]>;
    /**
     * List all tables across all sources.
     *
     * @returns A list of table information objects.
     */
    listTables(): {
        source: string;
        table: string;
    }[];
    /**
     * Get schema information for a table.
     *
     * @param source The name of the data source.
     * @param table The name of the table.
     * @returns A list of schema field dictionaries.
     */
    describeTable(source: string, table: string): SchemaData;
    /**
     * Execute a SQL query on the parquet data.
     *
     * @param query The SQL query to execute.
     * @returns The query results as an array of objects.
     */
    queryTable(query: string): Promise<unknown[]>;
    /**
     * Convert a DuckDB result to an array of objects.
     *
     * @param result The DuckDB materialized result to convert.
     * @param query Optional SQL query to extract column names from
     * @returns An array of objects representing the result rows.
     */
    resultToArray(result: duckdb.DuckDBMaterializedResult, query?: string): Record<string, unknown>[];
    /**
     * Extract column names directly from DuckDB result metadata
     *
     * @param result DuckDB materialized result
     * @returns Array of column names or null if extraction fails
     */
    private getColumnNamesFromResult;
    /**
     * Handle BigInt values for JSON serialization
     *
     * @param value The value to check and convert if needed
     * @returns The processed value safe for JSON serialization
     */
    private handleBigIntValue;
}
