# MCP-Evidence Public Release Plan

This document outlines the necessary steps to prepare the MCP-Evidence TypeScript server for public release, focusing on sanitization, documentation, security, and ease of installation across multiple platforms including Cursor, Roo-Cline / Cline, and Claude Desktop.

## Current Project Overview

The MCP-Evidence project is a TypeScript implementation of a Model Context Protocol (MCP) server for Evidence.dev, enabling LLMs to:

- Discover Evidence.dev data sources
- List tables in data sources
- Get schema information for tables
- Execute SQL queries on data sources

The implementation uses DuckDB to query data sources (primarily Parquet files and SQL files), with functionality to properly handle column names, BigInt values, and other data type considerations.

## Release Preparation Tasks

### 1. Credential & Sensitive Data Sanitization

#### Issues Identified
- Connection files in `/sources/` contain sensitive information:
  - Database hostnames, usernames, and base64-encoded passwords
  - Connection details that may be specific to internal systems
  - Potential PII in SQL views/queries

#### Remediation Steps
- [ ] Sanitize all connection YAML files:
  - Replace all connection files with templated examples
  - Create a `.gitignore` pattern to exclude real connection files
  - Add documentation on how to create/format connection files
- [ ] Scan codebase for hardcoded credentials with tool like TruffleHog
- [ ] Implement environment variable support for credentials
- [ ] Create a `.env.example` file with placeholder values 
- [ ] Ensure SQL files do not contain sensitive information or PII

### 2. Security Enhancements

#### DuckDB-Specific Controls
- [ ] Implement recommended DuckDB security settings:
  ```sql
  SET disabled_filesystems = 'LocalFileSystem';  -- Block local file access
  SET memory_limit = '4GB';  -- Prevent memory exhaustion attacks
  ```
- [ ] Add configuration options for enabling/disabling DuckDB security features
- [ ] Document security implications of different settings

#### MCP Server Security
- [ ] Add input validation using Zod for all parameters
- [ ] Implement proper error handling that doesn't leak system information
- [ ] Create a SECURITY.md file with vulnerability reporting guidelines
- [ ] Add options for read-only mode to prevent data modification

### 3. Documentation Improvements

#### Core Documentation Files
- [ ] Update README.md with:
  - Clear project description and purpose
  - Complete installation instructions
  - Usage examples
  - Security considerations
  - License information
  - Badges (build status, license, etc.)
- [ ] Create CONTRIBUTING.md with contribution guidelines
- [ ] Add CODE_OF_CONDUCT.md
- [ ] Add CHANGELOG.md for tracking version changes

#### Integration Guides
- [ ] Create detailed setup guides for:
  - Cursor
  - Roo-Cline / Cline
  - Claude Desktop
  - Other MCP-capable clients
- [ ] Include screenshots and configuration examples for each platform

#### Example Usage
- [ ] Add example queries and use cases
- [ ] Provide sample data files that demonstrate functionality

### 4. Package & Distribution Improvements

#### NPM Package Configuration
- [ ] Update package.json with appropriate metadata:
  - Author information
  - Repository links
  - Keywords for discoverability
  - Proper version numbering
- [ ] Ensure correct files are included/excluded in the package

#### Configuration Simplification
- [ ] Create command-line options for common settings
- [ ] Implement auto-discovery of Evidence.dev projects
- [ ] Add interactive setup wizard (optional)

### 5. Platform-Specific Integration

#### Cursor Integration
- [ ] Document Cursor MCP settings location:
  ```
  ~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json
  ```
- [ ] Create Cursor-specific configuration templates
- [ ] Add troubleshooting section for common Cursor issues

#### Roo-Cline / Cline Integration
- [ ] Document Cline configuration paths for each OS:
  - macOS: `~/.config/cline/config.json`
  - Windows: `%APPDATA%\cline\config.json`
- [ ] Provide complete MCP server configuration examples
- [ ] Add Roo-Cline specific considerations

#### Claude Desktop Integration
- [ ] Document Claude Desktop settings location:
  ```
  ~/Library/Application Support/Claude/claude_desktop_config.json
  ```
- [ ] Address Claude-specific security considerations
- [ ] Provide sample queries specific to Claude's capabilities

### 6. License & Legal Compliance

- [ ] Select and add appropriate OSI-approved license (recommend MIT)
- [ ] Ensure all dependencies have compatible licenses
- [ ] Add copyright notices to source files
- [ ] Verify third-party code attribution

### 7. CI/CD & Quality Assurance

- [ ] Set up GitHub Actions for:
  - Automated testing
  - Linting
  - Security scanning
  - Package publishing
- [ ] Add test coverage reporting
- [ ] Implement release tagging automation

### 8. FastMCP Migration

#### Overview
The project will be migrated from the standard MCP SDK to [FastMCP](https://github.com/punkpeye/fastmcp), a TypeScript framework that simplifies MCP server development with improved developer experience, type safety, and additional features.

#### Benefits of FastMCP
- Simplified, declarative API with less boilerplate
- Enhanced type safety through Zod integration
- Built-in authentication and session management
- Support for image content via helper functions
- Integrated logging and error handling
- Progress notifications for long-running operations
- Support for SSE transport (in addition to stdio)
- Built-in CLI for testing and debugging
- Automatic handling of protocol details

#### Migration Steps

##### 8.1 Dependencies
- [ ] Update package.json dependencies:
  ```diff
  - "@modelcontextprotocol/sdk": "^1.7.0",
  + "fastmcp": "^1.20.5",
  ```
- [ ] Run `pnpm install` to update dependencies

##### 8.2 Server Configuration
- [ ] Refactor server initialization to use FastMCP:
  ```typescript
  // Before:
  const server = new McpServer({
    name: 'evidence-mcp-server',
    version: '0.1.0'
  });
  
  // After:
  const server = new FastMCP({
    name: 'evidence-mcp-server',
    version: '0.1.0',
    // Optional authentication handler
    authenticate: ({ request }) => {
      // Implement authentication if needed
      return {}; // Session data
    }
  });
  ```

##### 8.3 Tool Definition Refactoring
- [ ] Refactor tool definitions to use FastMCP's simplified syntax:
  ```typescript
  // Before:
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
          content: [{ type: 'text', text: `Error: ${error.message}` }],
          isError: true
        };
      }
    }
  );
  
  // After:
  server.addTool({
    name: 'evidence-list-sources',
    description: 'List all available data sources',
    parameters: z.object({}),
    execute: async (args, { log }) => {
      try {
        const sources = discovery.getSources();
        return safeJsonStringify(sources);
      } catch (e) {
        const error = e as Error;
        throw new UserError(`Error: ${error.message}`);
      }
    }
  });
  ```

##### 8.4 Resource Definition Refactoring
- [ ] Refactor resource definitions:
  ```typescript
  // Before:
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
  
  // After:
  server.addResource({
    uri: `evidence://${source.name}`,
    name: `${source.name} Data Source`,
    mimeType: 'application/json',
    async load() {
      try {
        const tables = discovery.getSourceTables(source.name);
        return {
          text: safeJsonStringify({
            source: source.name,
            tables,
            path: source.path
          })
        };
      } catch (e) {
        const error = e as Error;
        throw new UserError(`Error reading source: ${error.message}`);
      }
    }
  });
  ```

##### 8.5 Resource Templates Refactoring
- [ ] Refactor resource templates:
  ```typescript
  // Before:
  server.resource(
    'evidence-table',
    new ResourceTemplate('evidence://query/{source}/{table}', { list: undefined }),
    async (uri, { source, table }) => {
      // Implementation...
    }
  );
  
  // After:
  server.addResourceTemplate({
    uriTemplate: 'evidence://query/{source}/{table}',
    name: 'Query Table',
    mimeType: 'application/json',
    arguments: [
      {
        name: 'source',
        description: 'Source name',
        required: true
      },
      {
        name: 'table',
        description: 'Table name',
        required: true
      }
    ],
    async load({ source, table }) {
      // Implementation...
    }
  });
  ```

##### 8.6 Transport Configuration
- [ ] Update server startup to use FastMCP transport configuration:
  ```typescript
  // Before:
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  // After:
  server.start({
    transportType: 'stdio',
    // Add SSE transport option for web usage
    // transportType: 'sse',
    // sse: {
    //   endpoint: '/mcp',
    //   port: 8080
    // }
  });
  ```

##### 8.7 Error Handling Enhancements
- [ ] Implement proper error handling with UserError:
  ```typescript
  import { UserError } from 'fastmcp';
  
  try {
    // ... operation that may fail
  } catch (e) {
    throw new UserError(`Operation failed: ${e.message}`, { cause: e });
  }
  ```

##### 8.8 Session and Authentication Implementation
- [ ] Add authentication if needed:
  ```typescript
  const server = new FastMCP({
    name: 'evidence-mcp-server',
    version: '0.1.0',
    authenticate: ({ request }) => {
      const apiKey = request.headers['x-api-key'];
      
      if (process.env.API_KEY && apiKey !== process.env.API_KEY) {
        throw new UserError('Invalid API key');
      }
      
      return {
        authenticated: true,
        // Additional session data if needed
      };
    }
  });
  ```

##### 8.9 CLI Integration
- [ ] Add dev commands to package.json:
  ```json
  "scripts": {
    "dev": "fastmcp dev src/cli.ts",
    "inspect": "fastmcp inspect src/cli.ts"
  }
  ```

##### 8.10 Testing and Validation
- [ ] Update existing tests to work with FastMCP
- [ ] Add additional tests for new FastMCP features
- [ ] Test in all supported client environments

### 9. File Change Detection Implementation

#### Overview
Currently, when SQL files in the source directory are modified, the server needs to be restarted to refresh the in-memory DuckDB views. This creates a poor developer experience and can lead to confusion when changes don't appear to take effect.

#### Implementation Plan

##### 9.1 File Watching System
- [ ] Add file watching capability using Chokidar or Node.js fs.watch:
  ```typescript
  // Add dependency for robust file watching
  import chokidar from 'chokidar';
  
  // Set up watcher for SQL files
  const watcher = chokidar.watch('sources/**/*.sql', {
    persistent: true,
    ignoreInitial: true
  });
  
  // React to file changes
  watcher.on('change', (path) => {
    console.log(`File ${path} has been modified`);
    // Extract source and table from path
    const pathParts = path.split('/');
    const sourceName = pathParts[pathParts.length - 2];
    const tableName = pathParts[pathParts.length - 1].replace('.sql', '');
    
    // Refresh the corresponding view
    refreshView(sourceName, tableName);
  });
  ```

##### 9.2 View Refresh Logic
- [ ] Implement method to drop and recreate views when SQL files change:
  ```typescript
  async function refreshView(sourceName: string, tableName: string) {
    try {
      // Get connection to the database
      const connection = await db.connect();
      const viewName = `${sourceName}_${tableName}`;
      
      // Drop the existing view
      await connection.run(`DROP VIEW IF EXISTS "${viewName}"`);
      
      // Re-read the SQL file
      const sqlPath = discovery.getParquetPath(sourceName, tableName);
      if (sqlPath.endsWith('.sql')) {
        const sqlContent = fs.readFileSync(sqlPath, 'utf-8');
        // Create the view again with updated SQL
        await connection.run(`CREATE VIEW "${viewName}" AS ${sqlContent}`);
        console.log(`View ${viewName} refreshed successfully`);
      }
    } catch (error) {
      console.error(`Error refreshing view ${sourceName}_${tableName}:`, error);
    }
  }
  ```

##### 9.3 Integration with Server Lifecycle
- [ ] Initialize file watchers when server starts:
  ```typescript
  export async function startServer(config: Config): Promise<void> {
    // Existing initialization code...
    
    // Set up file watchers for SQL files
    if (config.enableFileWatching) {
      setupFileWatchers(discovery, db);
    }
    
    // Existing server setup code...
  }
  ```

##### 9.4 Configuration Options
- [ ] Add configuration options to enable/disable file watching:
  ```typescript
  // In Config class
  readonly enableFileWatching: boolean = true;
  
  // In CLI options
  program.option('--disable-file-watching', 'Disable automatic file watching and view refreshing');
  ```

#### Benefits
- Improved developer experience - changes take effect immediately without server restart
- Reduced debugging complexity - no confusion over stale view definitions
- Selective view refresh - only modified views are updated, not the entire database
- Real-time feedback - log messages indicate when views are refreshed

## Security Considerations

### DuckDB Security
DuckDB in MCP servers presents specific security considerations:

1. **Filesystem Access**: By default, DuckDB can read arbitrary files on the system. Always use:
   ```sql
   SET disabled_filesystems = 'LocalFileSystem';
   ```

2. **Resource Controls**: Implement memory and thread limits to prevent DOS attacks:
   ```sql
   SET memory_limit = '4GB';
   SET threads = 4;
   ```

3. **Configuration Locking**: Once security settings are applied, lock them:
   ```sql
   SET lock_configuration = true;
   ```

4. **SQL Injection**: Validate all user-provided SQL queries to prevent injection attacks

### MCP Authentication
- Document proper token/credential storage for MCP server configuration
- Recommend using system keychain rather than config files where possible
- Suggest running the server with minimal privileges

## Installation Guide Outline

The installation guide should include the following sections:

1. **Prerequisites**
   - Node.js 18+
   - Evidence.dev project (optional)
   - Permission requirements

2. **Installation Methods**
   - Global installation: `npm install -g mcp-evidence`
   - Local installation: `npm install --save mcp-evidence`
   - Docker installation (if applicable)

3. **Basic Configuration**
   - Command-line options
   - Environment variables
   - Configuration files

4. **Client Integration**
   - Step-by-step setup for each supported client
   - Example configurations
   - Testing the connection

5. **Troubleshooting**
   - Common issues and solutions
   - Diagnostic tools
   - Support channels

## Next Steps & Timeline

1. **Immediate (1-2 days)**
   - Sanitize all credentials
   - Update README with basic information
   - Add license file

2. **Short-term (1 week)**
   - Implement security enhancements
   - Create basic installation guides 
   - Package configuration updates

3. **Medium-term (2-3 weeks)**
   - Complete platform-specific documentation
   - Implement CI/CD pipeline
   - Add comprehensive examples
   - Begin FastMCP migration

4. **Long-term (1+ months)**
   - Complete FastMCP migration
   - Enable SSE transport for web usage
   - Community engagement
   - Feature additions based on feedback
   - Version 1.0 release preparation