/**
 * Evidence.dev MCP Server Implementation.
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { EvidenceDataDiscovery } from './discovery.js';
import { DuckDBDatabase } from './database.js';
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
                content: [{ type: 'text', text: JSON.stringify(sources, null, 2) }]
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
                content: [{ type: 'text', text: JSON.stringify(tables, null, 2) }]
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
                content: [{ type: 'text', text: JSON.stringify(schema, null, 2) }]
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
            const results = db.queryTable(query);
            return {
                content: [{ type: 'text', text: JSON.stringify(results, null, 2) }]
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
                            text: JSON.stringify({
                                source: source.name,
                                tables,
                                path: source.path
                            }, null, 2)
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
            const connection = db.connect();
            try {
                const viewName = `${sourceStr}_${tableStr}`;
                const createViewSql = `CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`;
                connection.prepare(createViewSql).run();
                const results = connection.prepare(`SELECT * FROM "${viewName}" LIMIT 100`).all();
                connection.close();
                return {
                    contents: [{
                            uri: uri.href,
                            mimeType: 'application/json',
                            text: JSON.stringify(results, null, 2)
                        }]
                };
            }
            catch (e) {
                if (connection) {
                    connection.close();
                }
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
            const decodedQuery = decodeURIComponent(queryStr);
            // Execute the query
            const results = db.queryTable(decodedQuery);
            return {
                contents: [{
                        uri: uri.href,
                        mimeType: 'application/json',
                        text: JSON.stringify(results, null, 2)
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