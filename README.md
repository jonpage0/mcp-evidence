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
- `evidence-query` - Execute SQL queries on the data

## License

MIT