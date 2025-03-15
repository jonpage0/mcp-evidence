# Evidence.dev MCP Server

TypeScript implementation of an MCP (Model Context Protocol) server for Evidence.dev.

## Description

This server provides Model Context Protocol (MCP) access to Evidence.dev data sources. It allows LLMs to discover, query, and interact with Evidence.dev data sources (primarily Parquet files) via SQL.

## Features

- Discover Evidence.dev data sources
- List tables in data sources
- Get schema information for tables
- Execute SQL queries on data sources
- MCP protocol compatibility

## Installation

```bash
# Install from npm
npm install -g mcp-evidence

# Or install locally
npm install --save mcp-evidence
```

## Requirements

- Node.js 18 or higher
- DuckDB 0.9.0 or higher

## Usage

### Command Line

```bash
# Run the server
mcp-evidence --project-path /path/to/evidence/project

# With optional data path override
mcp-evidence --project-path /path/to/evidence/project --data-path /path/to/data

# With debug logging
mcp-evidence --project-path /path/to/evidence/project --debug

# For users who installed locally in a project
npx evidence-mcp --project-path ./my-evidence-project

# For users who installed globally
evidence-mcp --project-path ./my-evidence-project
```

### Programmatic Usage

```typescript
import { Config, startServer } from 'mcp-evidence';

// Create a configuration
const config = new Config({
  projectPath: '/path/to/evidence/project',
  dataPath: '/path/to/data', // Optional
  debug: true // Optional
});

// Start the server
await startServer(config);
```

## MCP Resources

This server exposes the following MCP resources:

- `evidence://{source}` - Information about a data source
- `evidence://query/{source}/{table}` - Data for a specific table
- `evidence://sql/{query}` - Results of a SQL query

## MCP Tools

This server provides the following MCP tools:

- `evidence-list-sources` - List all data sources
- `evidence-list-tables` - List all tables in a data source
- `evidence-describe-table` - Get schema information for a table
- `evidence-query` - Execute SQL queries on the data (tables should be referenced using source_name_table_name format)

## Using with Cline / Roo-Cline

To use this MCP server with Cline or Roo-Cline, follow these steps:

### 1. Install the MCP Server

```bash
# Install globally
npm install -g mcp-evidence

# Or install locally in your project
npm install --save mcp-evidence
```

### 2. Configure Cline / Roo-Cline

Add the MCP server to your Cline configuration file:

For **Cline**, edit `~/.config/cline/config.json` (Linux/macOS) or `%APPDATA%\cline\config.json` (Windows):

```json
{
  "mcpServers": {
    "evidence": {
      "command": "mcp-evidence",
      "args": ["--project-path", "/path/to/your/evidence/project"],
      "env": {},
      "disabled": false,
      "alwaysAllow": ["evidence-list-sources", "evidence-list-tables", "evidence-describe-table", "evidence-query"]
    }
  }
}
```

For **Roo-Cline**, edit:
- macOS: `~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`
- Windows: `%APPDATA%\Cursor\User\globalStorage\rooveterinaryinc.roo-cline\settings\cline_mcp_settings.json`
- Linux: `~/.config/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json`

```json
{
  "mcpServers": {
    "evidence": {
      "command": "mcp-evidence",
      "args": ["--project-path", "/path/to/your/evidence/project"],
      "env": {},
      "disabled": false,
      "alwaysAllow": ["evidence-list-sources", "evidence-list-tables", "evidence-describe-table", "evidence-query"]
    }
  }
}
```

If you installed the package locally, use the full path to the executable:

```json
"command": "node",
"args": ["/path/to/your/project/node_modules/mcp-evidence/dist/cli.js", "--project-path", "/path/to/your/evidence/project"]
```

### 3. Using in Cline / Roo-Cline

Once configured, you can use the MCP server in your conversations. For example:

- "Show me all available data sources"
- "Show me tables in the maniac_neon source"
- "Query the orders table from maniac_neon"
- "Run this SQL query: SELECT * FROM maniac_neon_orders LIMIT 10" (Note the source_name_table_name format)

The MCP server will expose Evidence.dev data sources to the LLM, allowing it to discover and query your data directly.

## Table Naming Convention

When writing SQL queries, tables should be referenced using the format `source_name_table_name`. For example:

- `maniac_neon_orders` refers to the "orders" table in the "maniac_neon" source
- `maniac_neon_2024_users` refers to the "users" table in the "maniac_neon_2024" source

This format enables cross-source joins, for example:

```sql
SELECT u.full_name, COUNT(o.id) AS order_count 
FROM maniac_neon_2024_users u 
LEFT JOIN maniac_neon_orders o ON u.primary_email_address = o.m_email
GROUP BY u.full_name
```

## Advanced Features

### Column Name Preservation

The MCP server preserves column names from SQL queries, including complex queries with Common Table Expressions (CTEs). This ensures that query results maintain meaningful column names rather than generic ones like "column0", "column1", etc.

For example, when executing a CTE query like:

```sql
WITH sales_summary AS (
  SELECT 
    SUM(amount) AS total_sales,
    COUNT(DISTINCT customer_id) AS customer_count
  FROM maniac_neon_orders
)
SELECT * FROM sales_summary
```

The result will maintain the column names "total_sales" and "customer_count" rather than using generic names.

This feature is especially useful when:
- Working with complex queries that use CTEs
- Using SQL functions and expressions that create computed columns
- Analyzing data where column semantics are important

## License

MIT