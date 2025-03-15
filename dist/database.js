/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
// Using require for DuckDB since its CommonJS module doesn't work well with ES modules
// eslint-disable-next-line @typescript-eslint/no-var-requires
const duckdb = require('duckdb');
/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
export class DuckDBDatabase {
    /** Evidence.dev data discovery interface */
    discovery;
    /**
     * Initialize DuckDBDatabase.
     *
     * @param discovery Evidence.dev data discovery interface.
     */
    constructor(discovery) {
        this.discovery = discovery;
    }
    /**
     * Create a DuckDB connection.
     *
     * @returns A DuckDB connection.
     */
    connect() {
        // For in-memory databases, we can't use read_only mode
        // Wrap in try/catch to handle potential initialization errors
        try {
            // Return a new DuckDB connection
            return new duckdb.Database(':memory:');
        }
        catch (error) {
            console.error('Error connecting to DuckDB:', error);
            throw new Error(`Failed to initialize DuckDB: ${error.message}`);
        }
    }
    /**
     * Execute a SQL query.
     *
     * @param query The SQL query to execute.
     * @param parameters Optional parameters for the query.
     * @returns The query results as an array of objects.
     */
    executeQuery(query, parameters) {
        const connection = this.connect();
        try {
            // Create a connection
            const db = connection.prepare(query);
            // Execute the query
            let results;
            if (parameters) {
                results = db.all(parameters);
            }
            else {
                results = db.all();
            }
            // Close the database connection
            connection.close();
            return results;
        }
        catch (e) {
            // Make sure to close the connection even if there's an error
            connection.close();
            throw e;
        }
    }
    /**
     * List all tables across all sources.
     *
     * @returns A list of table information objects.
     */
    listTables() {
        const tables = [];
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
    describeTable(source, table) {
        return this.discovery.getTableSchema(source, table);
    }
    /**
     * Execute a SQL query on the parquet data.
     *
     * @param query The SQL query to execute.
     * @returns The query results as an array of objects.
     */
    queryTable(query) {
        const connection = this.connect();
        try {
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
                        const stmt = connection.prepare(`CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`);
                        stmt.run();
                    }
                    catch (e) {
                        // Log the error but continue with other tables
                        console.warn(`Error creating view for ${sourceName}.${tableName}: ${e.message}`);
                    }
                }
            }
            // Execute the query
            const stmt = connection.prepare(query);
            const results = stmt.all();
            // Close the connection
            connection.close();
            return results;
        }
        catch (e) {
            // Make sure to close the connection even if there's an error
            connection.close();
            // Log the error and re-throw
            console.error(`Error executing query: ${e.message}`);
            console.error(`Query: ${query}`);
            throw e;
        }
    }
}
//# sourceMappingURL=database.js.map