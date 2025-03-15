/**
 * Evidence.dev MCP Server Implementation.
 */
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
// These imports are used at runtime
import type { Config } from './config.js';
import { EvidenceDataDiscovery, type SchemaData } from './discovery.js';
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
function renameColumns(results: unknown[], query: string): unknown[] {
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
  const firstResult = results[0] as Record<string, unknown>;
  const hasGenericColumns = Object.keys(firstResult).some(key => /^column\d+$/.test(key));
  
  if (!hasGenericColumns) {
    return results; // No generic column names, return original results
  }
  
  // Map generic column names to extracted column names
  return results.map(row => {
    const originalRow = row as Record<string, unknown>;
    const newRow: Record<string, unknown> = {};
    
    Object.keys(originalRow).forEach((key, index) => {
      // If column name is generic (column0, column1, etc.) and we have a better name, use it
      if (/^column\d+$/.test(key) && index < columnNames.length) {
        newRow[columnNames[index]] = originalRow[key];
      } else {
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
export async function startServer(config: Config): Promise<void> {
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
  server.tool(
    'evidence-list-sources',
    {},
    async () => {
      try {
        const sources = discovery.getSources();
        return {
          content: [{ type: 'text', text: safeJsonStringify(sources) }]
        };
      } catch (e) {
        const error = e as Error;
        return {
          content: [{ 
            type: 'text', 
            text: `Error: ${error.message}
            
USAGE: Please provide a valid SQL query like:
SELECT * FROM source_table WHERE conditions LIMIT 10

IMPORTANT: Do NOT use "memory." prefix with Evidence tables - access Evidence data sources directly.

Note: Use source_table format with underscore, NOT source.table with dot. While Evidence.dev itself uses dot notation (source.table), this MCP server requires underscore notation (source_table).` }],
          isError: true
        };
      }
    }
  );
  
  // List tables in a source
  server.tool(
    'evidence-list-tables',
    {
      source: z.string().describe('Source name')
    },
    async ({ source }) => {
      try {
        const tables = discovery.getSourceTables(source);
        return {
          content: [{ type: 'text', text: safeJsonStringify(tables) }]
        };
      } catch (e) {
        const error = e as Error;
        return {
          content: [{ 
            type: 'text', 
            text: `Error: ${error.message}
            
USAGE: Please provide a valid SQL query like:
SELECT * FROM source_table WHERE conditions LIMIT 10

CONTEXT MATTERS: When using this MCP server/tool, use underscore notation (source_table). When writing actual Evidence.dev code files, use dot notation (source.table).
IMPORTANT: Do NOT use "memory." prefix with Evidence tables - access Evidence data sources directly.` }],
          isError: true
        };
      }
    }
  );
  
  // Describe a table
  server.tool(
    'evidence-describe-table',
    {
      source: z.string().describe('Source name'),
      table: z.string().describe('Table name')
    },
    async ({ source, table }) => {
      try {
        const schema = db.describeTable(source, table);
        return {
          content: [{ type: 'text', text: safeJsonStringify(schema) }]
        };
      } catch (e) {
        const error = e as Error;
        return {
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
  
  // Execute SQL query
  server.tool(
    'evidence-query',
    {
      query: z.string().describe(
        'SQL query to execute. Example: "SELECT * FROM maniac_neon_orders LIMIT 5". IMPORTANT CONTEXT DISTINCTION: When using this MCP server/tool, use underscore notation (source_table). When writing actual Evidence.dev code files, use dot notation (source.table). Also, do NOT use "memory." prefix with Evidence tables - access Evidence data sources directly.'
      ),
      maxResults: z.number().optional().describe('Maximum number of rows to return. Results are limited to 10 rows by default, use this parameter to request more rows.')
    },
    async ({ query, maxResults }) => {
      try {
        // Add explicit column aliases to ensure column names are preserved
        const enhancedQuery = addExplicitColumnAliases(query);
        
        // Execute the query - column names will be properly extracted via the DuckDB Neo API
        const results = await db.queryTable(enhancedQuery);
        
        // Apply result limiting if specified or using default limit
        const limitedResults = results.slice(0, maxResults || config.defaultResultLimit || 10);
        
        // Include metadata about limiting if applied
        const resultMeta = {
          total: results.length,
          returned: limitedResults.length,
          limited: results.length > limitedResults.length
        };
        
        return {
          content: [{ 
            type: 'text', 
            text: safeJsonStringify({
              results: limitedResults,
              meta: {
                ...resultMeta,
                important_note: "CONTEXT MATTERS: When using this MCP server/tool, use underscore notation (source_table). When writing actual Evidence.dev code files, use dot notation (source.table).",
                warning: "Do NOT use 'memory.' prefix with Evidence tables. Access Evidence data sources directly.",
                feature_limitation: "Query chaining (using `${query_name}` in SQL) is NOT supported in this MCP server, but is available in Evidence.dev applications.",
                correct_usage: "Use: SELECT * FROM source_table LIMIT 10",
                result_limits: `Results are limited to ${config.defaultResultLimit || 10} rows by default. Use the maxResults parameter to request more rows.`,
                query_examples: {
                  simple: "SELECT * FROM source_table LIMIT 10"
                }
              }
            }) 
          }]
        };
      } catch (e) {
        const error = e as Error;
        return {
          content: [{ 
            type: 'text', 
            text: `Error: ${error.message}
            
USAGE: Please provide a valid SQL query like:
SELECT * FROM source_table WHERE conditions LIMIT 10

FEATURE LIMITATION: Query chaining (using \`\${query_name}\` in SQL) is NOT supported in this MCP server.
Results are limited to ${config.defaultResultLimit || 10} rows by default. Use the maxResults parameter to request more rows.
CONTEXT MATTERS: When using this MCP server/tool, use underscore notation (source_table). When writing actual Evidence.dev code files, use dot notation (source.table).` }],
          isError: true
        };
      }
    }
  );
  
  // Documentation tool
  server.tool(
    'evidence-documentation',
    {},
    async () => {
      try {
        // Get a source and table for examples if available
        const sources = discovery.getSources();
        let exampleSource = 'maniac_neon';
        let exampleTable = 'orders';
        
        if (sources.length > 0) {
          exampleSource = sources[0].name;
          const tables = discovery.getSourceTables(exampleSource);
          if (tables.length > 0) {
            exampleTable = tables[0];
          }
        }
        
        return {
          content: [{ 
            type: 'text', 
            text: `# Evidence.dev MCP Query Guide

## IMPORTANT NOTE ABOUT QUERY SYNTAX
Two different notations are used depending on context:

1. When using this MCP server/tool → Use underscore notation: \`source_table\` 
2. When writing actual Evidence.dev code files → Use dot notation: \`source.table\` 

## WARNING: Do NOT use "memory." prefix with Evidence tables - access Evidence data sources directly.

## RESULT LIMITS
Results are limited to ${config.defaultResultLimit || 10} rows by default. Use the "maxResults" parameter to request more rows.

## FEATURE LIMITATIONS
Query chaining (using \`\${query_name}\` in SQL) is available in Evidence.dev applications but is NOT supported in this MCP server.
For information about query chaining, see: https://docs.evidence.dev/core-concepts/queries/#query-chaining

## Available Tools

### evidence-query
Execute SQL queries against available data sources.

\`\`\`json
{
  "method": "evidence-query",
  "params": {
    "query": "SELECT * FROM ${exampleSource}_${exampleTable} LIMIT 5",
    "maxResults": 10
  }
}
\`\`\`

### evidence-list-sources
List all available data sources.

\`\`\`json
{
  "method": "evidence-list-sources",
  "params": {}
}
\`\`\`

### evidence-list-tables
List tables in a specific source.

\`\`\`json
{
  "method": "evidence-list-tables",
  "params": {
    "source": "${exampleSource}"
  }
}
\`\`\`

### evidence-describe-table
Get schema information for a specific table.

\`\`\`json
{
  "method": "evidence-describe-table",
  "params": {
    "source": "${exampleSource}",
    "table": "${exampleTable}"
  }
}
\`\`\`

## Resource URIs

### Table data: evidence://query/{source}/{table}
Example: \`evidence://query/${exampleSource}/${exampleTable}\`

NOTE: This is different from accessing memory data. Do NOT use memory.table_name for Evidence data.

### SQL Query: evidence://sql/{url_encoded_query}
Example: \`evidence://sql/SELECT%20*%20FROM%20${exampleSource}_${exampleTable}%20LIMIT%205\`

## Tips for Constructing Queries
1. CONTEXT MATTERS:
   - When using this MCP server/tool → Use underscore notation: \`source_table\`
   - When writing actual Evidence.dev code files → Use dot notation: \`source.table\`
2. Result Limits:
   - Results are limited to ${config.defaultResultLimit || 10} rows by default
   - Use the "maxResults" parameter to request more rows if needed
3. Do NOT prefix Evidence tables with "memory." - access them directly`
          }]
        };
      } catch (e) {
        const error = e as Error;
        return {
          content: [{ 
            type: 'text', 
            text: `Error generating documentation: ${error.message}` 
          }],
          isError: true
        };
      }
    }
  );
  
  // Schema discovery tool - helps LLMs understand structure and correct query format
  server.tool(
    'evidence-discover-schema',
    {},
    async () => {
      try {
        // Define the schema object with proper types
        interface SchemaMap {
          [source: string]: { 
            [table: string]: SchemaData | { error: string } 
          };
        }
        
        const sources = discovery.getSources();
        const schema: SchemaMap = {};
        const queryExamples = [];
        
        for (const source of sources) {
          schema[source.name] = {};
          const tables = discovery.getSourceTables(source.name);
          
          for (const table of tables) {
            try {
              // Store table schema
              schema[source.name][table] = db.describeTable(source.name, table);
              
              // Add example query for this table
              queryExamples.push({
                description: `Query ${source.name}_${table}`,
                query: `SELECT * FROM ${source.name}_${table} LIMIT 5`
              });
              
              // If we have enough examples, stop adding more
              if (queryExamples.length >= 5) break;
            } catch (e) {
              schema[source.name][table] = { error: `Could not describe table: ${(e as Error).message}` };
            }
          }
          
          // If we have enough examples, stop processing sources
          if (queryExamples.length >= 5) break;
        }
        
        return {
          content: [{ 
            type: 'text', 
            text: safeJsonStringify({
              description: "Complete database schema with example queries for MCP use",
              warning: "Do NOT use 'memory.' prefix with Evidence tables. Access Evidence data sources directly.",
              correct_usage: "Use: SELECT * FROM source_table",
              important_note: "CONTEXT MATTERS: When using this MCP server/tool, use underscore notation (source_table). When writing actual Evidence.dev code files, use dot notation (source.table).",
              schema,
              query_examples: queryExamples
            })
          }]
        };
      } catch (e) {
        const error = e as Error;
        return {
          content: [{ type: 'text', text: `Error discovering schema: ${error.message}` }],
          isError: true
        };
      }
    }
  );
  
  // Add resources
  
  // Create a resource for each data source
  for (const source of discovery.getSources()) {
    server.resource(
      `evidence-${source.name}`,
      `evidence://${source.name}`,
      async (uri) => {
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
        } catch (e) {
          const error = e as Error;
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'text/plain',
              text: `Error reading source: ${error.message}`
            }]
          };
        }
      }
    );
  }
  
  // Add resource templates
  
  // Template for querying specific tables
  server.resource(
    'evidence-table',
    new ResourceTemplate('evidence://query/{source}/{table}', { list: undefined }),
    async (uri, { source, table }) => {
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
          } else {
            await connection.run(`CREATE VIEW "${viewName}" AS SELECT * FROM read_parquet('${parquetPath.replace(/'/g, "''")}')`);
          }
          
          // Execute the query - column names will be automatically handled by the DuckDB Neo API
          const result = await connection.run(`SELECT * FROM "${viewName}" LIMIT 100`);
          
          // Use our helper method to convert the result to an array
          const resultArray = db.resultToArray(result);
          
          // Apply result limiting using default limit
          const limitedResults = resultArray.slice(0, config.defaultResultLimit);
          
          // Include metadata about limiting if applied
          const resultMeta = {
            total: resultArray.length,
            returned: limitedResults.length,
            limited: resultArray.length > limitedResults.length
          };
          
          return {
            contents: [{
              uri: uri.href,
              mimeType: 'application/json',
              text: safeJsonStringify({
                results: limitedResults,
                meta: {
                  ...resultMeta,
                  important_note: "CONTEXT MATTERS: When using this MCP server/tool, use underscore notation (source_table). When writing actual Evidence.dev code files, use dot notation (source.table).",
                  warning: "Do NOT use 'memory.' prefix with Evidence tables. Access Evidence data sources directly.",
                  correct_usage: "Use: SELECT * FROM source_table",
                  query_examples: {
                    access_directly: `SELECT * FROM ${sourceStr}_${tableStr} LIMIT 10`,
                    evidence_code_file_format: `// This is for Evidence.dev code files ONLY, not for MCP: ${sourceStr}.${tableStr}`,
                    join_example: `SELECT t1.*, t2.column_name FROM ${sourceStr}_${tableStr} t1 JOIN another_source_another_table t2 ON t1.id = t2.id LIMIT 10`
                  }
                }
              })
            }]
          };
        } catch (e) {
          // Log error details before throwing
          console.error(`Error querying table ${sourceStr}.${tableStr}:`, e);
          throw e;
        }
      } catch (e) {
        const error = e as Error;
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: `Error querying table: ${error.message}
             
USAGE: This resource URI accesses table data directly. Format: 
evidence://query/{source}/{table} 
 
CONTEXT MATTERS: When using this MCP server/tool → underscore notation. When writing Evidence.dev code files → dot notation.
IMPORTANT: Do NOT use "memory." prefix with Evidence tables - access Evidence data sources directly.
Example: evidence://query/source_name/table_name
When using SQL, remember to use source_table format with underscore, NOT source.table with dot.`
          }]
        };
      }
    }
  );
  
  // Template for executing SQL queries
  server.resource(
    'evidence-sql',
    new ResourceTemplate('evidence://sql/{query}', { list: undefined }),
    async (uri, { query }) => {
      try {
        // URL decode the query
        const queryStr = Array.isArray(query) ? query[0] : query;
        let decodedQuery = decodeURIComponent(queryStr);
        
        // Add explicit column aliases to ensure column names are preserved
        decodedQuery = addExplicitColumnAliases(decodedQuery);
        
        // Execute the query
        const results = await db.queryTable(decodedQuery);
        
        // Apply result limiting using default limit
        const limitedResults = results.slice(0, config.defaultResultLimit);
        
        // Include metadata about limiting if applied
        const resultMeta = {
          total: results.length,
          returned: limitedResults.length,
          limited: results.length > limitedResults.length
        };
        
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'application/json',
            text: safeJsonStringify({
              results: limitedResults,
              meta: resultMeta
            })
          }]
        };
      } catch (e) {
        const error = e as Error;
        return {
          contents: [{
            uri: uri.href,
            mimeType: 'text/plain',
            text: `Error executing SQL query: ${error.message}
            
USAGE: Please provide a valid SQL query in the format:
SELECT * FROM source_table WHERE conditions LIMIT 10

IMPORTANT: Do NOT use "memory." prefix with Evidence tables - access Evidence data sources directly.

Note: Use source_table format with underscore, NOT source.table with dot. 
While Evidence.dev itself uses dot notation (source.table), this MCP server requires underscore notation (source_table).`
          }]
        };
      }
    }
  );
  
  // Start receiving messages on stdin and sending messages on stdout
  console.info('Starting MCP server on stdio transport');
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.info('MCP server running. Press Ctrl+C to exit.');
}
