/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
import * as duckdb from '@duckdb/node-api';
// Import fs with node protocol
import * as fs from 'node:fs';
/**
 * Interface to DuckDB for querying Evidence.dev parquet files.
 */
export class DuckDBDatabase {
    /** Evidence.dev data discovery interface */
    discovery;
    /** Database instance */
    db = null;
    /** Connection cache */
    connection = null;
    /**
     * Initialize DuckDBDatabase.
     *
     * @param discovery Evidence.dev data discovery interface.
     */
    constructor(discovery) {
        this.discovery = discovery;
        // We'll initialize the db lazily when needed
    }
    /**
     * Extracts column names from a SQL SELECT query
     *
     * @param query The SQL query to parse
     * @returns An array of column names if they can be extracted, or null if parsing fails
     */
    extractColumnNames(query) {
        try {
            // Normalize the query to make parsing easier
            const normalizedQuery = query
                .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
                .replace(/\/\*.*?\*\//g, '') // Remove /* ... */ comments
                .replace(/--.*?$/gm, '') // Remove -- comments
                .trim();
            // Get the part between SELECT and FROM (case insensitive)
            const selectMatch = /SELECT\s+(.*?)\s+FROM/i.exec(normalizedQuery);
            if (!selectMatch || !selectMatch[1]) {
                return null;
            }
            const selectClause = selectMatch[1].trim();
            // If there's a * with no AS, we can't determine column names
            if (selectClause === '*') {
                return null;
            }
            // Split by commas, but respect parentheses (for functions like COUNT, SUM)
            const parts = [];
            let currentPart = '';
            let parenthesesCount = 0;
            for (let i = 0; i < selectClause.length; i++) {
                const char = selectClause[i];
                if (char === '(') {
                    parenthesesCount++;
                    currentPart += char;
                }
                else if (char === ')') {
                    parenthesesCount--;
                    currentPart += char;
                }
                else if (char === ',' && parenthesesCount === 0) {
                    parts.push(currentPart.trim());
                    currentPart = '';
                }
                else {
                    currentPart += char;
                }
            }
            // Add the last part
            if (currentPart.trim()) {
                parts.push(currentPart.trim());
            }
            // Extract column names from each part
            return parts.map(part => {
                // Check for explicit AS alias
                const asMatch = /\s+AS\s+[\"\']?([a-zA-Z0-9_]+)[\"\']?$/i.exec(part);
                if (asMatch?.[1]) {
                    return asMatch[1];
                }
                // Check for implicit alias (last part after space or dot)
                const implicitMatch = /[.\s]([a-zA-Z0-9_]+)$/i.exec(part);
                if (implicitMatch?.[1]) {
                    return implicitMatch[1];
                }
                // If it's a function call, use the whole function as name
                if (part.includes('(') && part.includes(')')) {
                    return part.trim();
                }
                // Fallback: use the whole part
                return part.trim();
            });
        }
        catch (e) {
            console.warn('Error parsing SQL for column names:', e);
            return null;
        }
    }
    /**
     * Create and get a DuckDB connection.
     *
     * @returns A Promise resolving to a DuckDB connection.
     */
    async connect() {
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
     * @returns The query results as an array of objects.
     */
    async executeQuery(query) {
        try {
            const connection = await this.connect();
            // Execute the query with or without parameters
            const result = await connection.run(query);
            // Convert result to array of objects, passing the query for column name extraction
            return this.resultToArray(result, query);
        }
        catch (e) {
            console.error('Query execution error:', e);
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
    async queryTable(query) {
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
                        }
                        else {
                            await connection.run(`CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`);
                        }
                    }
                    catch (e) {
                        // Log the error but continue with other tables
                        console.warn(`Error creating view for ${sourceName}.${tableName}: ${e.message}`);
                    }
                }
            }
            // Execute the query
            const result = await connection.run(query);
            // Convert to array of objects for compatibility, passing the query for column name extraction
            return this.resultToArray(result, query);
        }
        catch (e) {
            // Log the error and re-throw
            console.error(`Error executing query: ${e.message}`);
            console.error(`Query: ${query}`);
            throw e;
        }
    }
    /**
     * Convert a DuckDB result to an array of objects.
     *
     * @param result The DuckDB materialized result to convert.
     * @param query Optional SQL query to extract column names from
     * @returns An array of objects representing the result rows.
     */
    resultToArray(result, query) {
        const rows = [];
        // Return empty array if no result
        if (!result)
            return rows;
        // Try to extract column names directly from the result object
        const directColumnNames = this.getColumnNamesFromResult(result);
        // Try to extract column names from the SQL query if provided and direct extraction failed
        let extractedColumnNames = null;
        if (!directColumnNames && query) {
            extractedColumnNames = this.extractColumnNames(query);
        }
        try {
            // Process using the DuckDB API
            // Process each chunk of the result
            const chunkCount = result.chunkCount;
            for (let c = 0; c < chunkCount; c++) {
                const chunk = result.getChunk(c);
                // Get row count from chunk
                const rowCount = chunk.rowCount;
                // Get column count
                const columnCount = chunk.columnCount;
                // Determine column names to use
                let columnNames;
                if (directColumnNames && directColumnNames.length === columnCount) {
                    // Prefer directly extracted column names
                    columnNames = directColumnNames;
                }
                else if (extractedColumnNames && extractedColumnNames.length === columnCount) {
                    // Use the extracted column names from SQL if available and count matches
                    columnNames = extractedColumnNames;
                }
                else {
                    // Fallback to generic names if parsing failed or count doesn't match
                    columnNames = Array.from({ length: columnCount }, (_, i) => `column${i}`);
                }
                // Get all column data
                const columns = chunk.getColumns();
                // Use an alternate approach if direct column access fails
                if (!columns || columns.length === 0) {
                    // Fallback to row-based access
                    for (let r = 0; r < rowCount; r++) {
                        const rowValues = chunk.getRowValues(r);
                        const rowData = {};
                        for (let i = 0; i < rowValues.length; i++) {
                            // Handle BigInt values
                            const value = rowValues[i];
                            rowData[columnNames[i]] = this.handleBigIntValue(value);
                        }
                        rows.push(rowData);
                    }
                    continue;
                }
                // Build rows from columns
                for (let r = 0; r < rowCount; r++) {
                    const rowData = {};
                    // Map values to column names
                    for (let i = 0; i < columnCount; i++) {
                        // Handle BigInt values
                        const value = columns[i][r];
                        rowData[columnNames[i]] = this.handleBigIntValue(value);
                    }
                    rows.push(rowData);
                }
            }
            return rows;
        }
        catch (e) {
            console.warn('Error converting DuckDB result to array:', e);
            // Return empty rows array if we couldn't extract data
            return rows;
        }
    }
    /**
     * Extract column names directly from DuckDB result metadata
     *
     * @param result DuckDB materialized result
     * @returns Array of column names or null if extraction fails
     */
    getColumnNamesFromResult(result) {
        try {
            // Try to extract column names in various ways depending on DuckDB version/structure
            const unknownResult = result;
            // Method 1: Access schema.names property (common in newer versions)
            const withSchema = unknownResult;
            if (withSchema?.schema && Array.isArray(withSchema.schema.names)) {
                return withSchema.schema.names;
            }
            // Method 2: Access result.getColumns().name (used in some versions)
            const withResultGetColumns = unknownResult;
            if (withResultGetColumns?.result?.getColumns) {
                try {
                    const columns = withResultGetColumns.result.getColumns();
                    if (Array.isArray(columns)) {
                        return columns.map(col => col.name);
                    }
                }
                catch (e) {
                    // Ignore failures for this method
                }
            }
            // Method 3: Try to access result.meta property (used in some versions)
            const withMeta = unknownResult;
            if (Array.isArray(withMeta?.meta)) {
                return withMeta.meta.map(column => column.name);
            }
            // Method 4: Try to access chunk meta information
            if (result.chunkCount > 0) {
                const chunk = result.getChunk(0);
                if (Array.isArray(chunk?.metadata)) {
                    return chunk.metadata.map(column => column.name);
                }
            }
            // No method worked
            return null;
        }
        catch (e) {
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
    handleBigIntValue(value) {
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
                const bigIntValue = value.value;
                const scale = value.scale;
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
            return value.value.toString();
        }
        return value;
    }
}
//# sourceMappingURL=database.js.map