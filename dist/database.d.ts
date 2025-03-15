import type { EvidenceDataDiscovery, SchemaData } from './discovery.js';
/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
export declare class DuckDBDatabase {
    /** Evidence.dev data discovery interface */
    private discovery;
    /**
     * Initialize DuckDBDatabase.
     *
     * @param discovery Evidence.dev data discovery interface.
     */
    constructor(discovery: EvidenceDataDiscovery);
    /**
     * Create a DuckDB connection.
     *
     * @returns A DuckDB connection.
     */
    connect(): any;
    /**
     * Execute a SQL query.
     *
     * @param query The SQL query to execute.
     * @param parameters Optional parameters for the query.
     * @returns The query results as an array of objects.
     */
    executeQuery(query: string, parameters?: Record<string, unknown>): unknown;
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
    queryTable(query: string): unknown;
}
