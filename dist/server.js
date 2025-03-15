/**
 * Evidence.dev MCP Server Implementation.
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EvidenceDataDiscovery } from './discovery.js';
import { DuckDBDatabase } from './database.js';
// Import fs with node protocol for reading SQL files
import * as fs from 'node:fs';
// Import our utilities for handling BigInt serialization
import { safeJsonStringify } from './utils.js';
// Import SQL utilities for column name handling
import { addExplicitColumnAliases, extractColumnNames } from './sql-utils.js';
/**
 * Renames generic column names (column0, column1, etc.) to meaningful names
 * based on the SQL query.
 *
 * @param results The original query results with generic column names
 * @param query The SQL query that was executed
 * @returns The results with renamed columns
 */
function renameColumns(results, query) {
    // If no results, return empty array
    if (!results || results.length === 0) {
        return results;
    }
    // Extract column names from the query
    const columnNames = extractColumnNames(query);
    if (!columnNames) {
        return results; // Cannot extract column names, return original results
    }
    // Check if results have generic column names (column0, column1, etc.)
    const firstResult = results[0];
    const hasGenericColumns = Object.keys(firstResult).some(key => /^column\d+$/.test(key));
    if (!hasGenericColumns) {
        return results; // No generic column names, return original results
    }
    // Map generic column names to extracted column names
    return results.map(row => {
        const originalRow = row;
        const newRow = {};
        Object.keys(originalRow).forEach((key, index) => {
            // If column name is generic (column0, column1, etc.) and we have a better name, use it
            if (/^column\d+$/.test(key) && index < columnNames.length) {
                newRow[columnNames[index]] = originalRow[key];
            }
            else {
                // Otherwise keep the original key
                newRow[key] = originalRow[key];
            }
        });
        return newRow;
    });
}
/**
 * Create and start the Evidence.dev MCP server
 *
 * @param config Server configuration
 */
export async function startServer(config) {
    console.info('Starting Evidence.dev MCP Server');
    // Create data discovery and database interfaces
    const discovery = new EvidenceDataDiscovery(config);
    const db = new DuckDBDatabase(discovery);
    // Create the MCP server
    const server = new McpServer({
        name: 'evidence-mcp-server',
        version: '0.1.0'
    });
    // Add tools
    // List all sources
    server.tool('evidence-list-sources', {}, async () => {
        try {
            const sources = discovery.getSources();
            return {
                content: [{ type: 'text', text: safeJsonStringify(sources) }]
            };
        }
        catch (e) {
            const error = e;
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
            };
        }
    });
    // List tables in a source
    server.tool('evidence-list-tables', {
        source: z.string().describe('Source name')
    }, async ({ source }) => {
        try {
            const tables = discovery.getSourceTables(source);
            return {
                content: [{ type: 'text', text: safeJsonStringify(tables) }]
            };
        }
        catch (e) {
            const error = e;
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
            };
        }
    });
    // Describe a table
    server.tool('evidence-describe-table', {
        source: z.string().describe('Source name'),
        table: z.string().describe('Table name')
    }, async ({ source, table }) => {
        try {
            const schema = db.describeTable(source, table);
            return {
                content: [{ type: 'text', text: safeJsonStringify(schema) }]
            };
        }
        catch (e) {
            const error = e;
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
            };
        }
    });
    // Execute SQL query
    server.tool('evidence-query', {
        query: z.string().describe('SQL query to execute')
    }, async ({ query }) => {
        try {
            // Add explicit column aliases to ensure column names are preserved
            const enhancedQuery = addExplicitColumnAliases(query);
            const results = await db.queryTable(enhancedQuery);
            // Column names should now be properly extracted in resultToArray
            // We don't need to rename columns here anymore as it's handled in database.ts
            return {
                content: [{ type: 'text', text: safeJsonStringify(results) }]
            };
        }
        catch (e) {
            const error = e;
            return {
                content: [{ type: 'text', text: `Error: ${error.message}` }],
                isError: true
            };
        }
    });
    // Add resources
    // Create a resource for each data source
    for (const source of discovery.getSources()) {
        server.resource(`evidence-${source.name}`, `evidence://${source.name}`, async (uri) => {
            try {
                const tables = discovery.getSourceTables(source.name);
                return {
                    contents: [{
                            uri: uri.href,
                            mimeType: 'application/json',
                            text: safeJsonStringify({
                                source: source.name,
                                tables,
                                path: source.path
                            })
                        }]
                };
            }
            catch (e) {
                const error = e;
                return {
                    contents: [{
                            uri: uri.href,
                            mimeType: 'text/plain',
                            text: `Error reading source: ${error.message}`
                        }]
                };
            }
        });
    }
    // Add resource templates
    // Template for querying specific tables
    server.resource('evidence-table', new ResourceTemplate('evidence://query/{source}/{table}', { list: undefined }), async (uri, { source, table }) => {
        try {
            // Get path to parquet file
            const sourceStr = Array.isArray(source) ? source[0] : source;
            const tableStr = Array.isArray(table) ? table[0] : table;
            const parquetPath = discovery.getParquetPath(sourceStr, tableStr);
            // Query the data
            try {
                // Get a connection
                const connection = await db.connect();
                // Create a view for the table
                const viewName = `${sourceStr}_${tableStr}`;
                // Handle SQL files differently than parquet files
                if (parquetPath.endsWith('.sql')) {
                    const sqlContent = fs.readFileSync(parquetPath, 'utf-8');
                    await connection.run(`CREATE VIEW "${viewName}" AS ${sqlContent}`);
                }
                else {
                    await connection.run(`CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`);
                }
                // Execute the query
                const result = await connection.run(`SELECT * FROM "${viewName}" LIMIT 100`);
                // Use our helper method to convert the result to an array
                const resultArray = db.resultToArray(result, `SELECT * FROM "${viewName}" LIMIT 100`);
                return {
                    contents: [{
                            uri: uri.href,
                            mimeType: 'application/json',
                            text: safeJsonStringify(resultArray)
                        }]
                };
            }
            catch (e) {
                // Log error details before throwing
                console.error(`Error querying table ${sourceStr}.${tableStr}:`, e);
                throw e;
            }
        }
        catch (e) {
            const error = e;
            return {
                contents: [{
                        uri: uri.href,
                        mimeType: 'text/plain',
                        text: `Error querying table: ${error.message}`
                    }]
            };
        }
    });
    // Template for executing SQL queries
    server.resource('evidence-sql', new ResourceTemplate('evidence://sql/{query}', { list: undefined }), async (uri, { query }) => {
        try {
            // URL decode the query
            const queryStr = Array.isArray(query) ? query[0] : query;
            let decodedQuery = decodeURIComponent(queryStr);
            // Add explicit column aliases to ensure column names are preserved
            decodedQuery = addExplicitColumnAliases(decodedQuery);
            // Execute the query
            const results = await db.queryTable(decodedQuery);
            // Column names should now be properly extracted in resultToArray
            // We don't need to rename columns here anymore as it's handled in database.ts
            return {
                contents: [{
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: safeJsonStringify(results)
                    }]
            };
        }
        catch (e) {
            const error = e;
            return {
                contents: [{
                        uri: uri.href,
                        mimeType: 'text/plain',
                        text: `Error executing SQL query: ${error.message}`
                    }]
            };
        }
    });
    // Start receiving messages on stdin and sending messages on stdout
    console.info('Starting MCP server on stdio transport');
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.info('MCP server running. Press Ctrl+C to exit.');
}
//# sourceMappingURL=server.js.map