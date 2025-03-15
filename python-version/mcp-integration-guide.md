# Integrating Evidence.dev MCP Server with Cline/Roo-Cline

This guide explains how to add the Evidence.dev MCP server to Cline or Roo-Cline, allowing you to access and query Evidence.dev data sources, including those with SQL reserved words in their names.

## Overview

The Evidence.dev MCP server provides a Model Context Protocol interface to your Evidence.dev data sources, allowing tools like Cline or Roo-Cline to query your data directly. This is especially useful for:

- Accessing and analyzing your Evidence.dev data sources
- Running SQL queries on your data
- Referencing tables with SQL reserved words like "copy" in their names

## Step 1: Set Up Python Environment

First, create a Python virtual environment with all required dependencies:

```bash
# Navigate to your project directory
cd /Users/jonpage/Code/mcp/mcp-evidence

# Create a virtual environment
python3 -m venv venv

# Activate the virtual environment
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install required packages
pip install duckdb>=1.1.3
pip install mcp>=1.0.0
pip install pyarrow>=14.0.1
```

## Step 2: Configuration

Our custom MCP server script (`mcp_server_evidence.py`) is designed to work with Cline/Roo-Cline and handle SQL reserved words properly. The key features include:

- Proper handling of SQL reserved words in table names
- Standalone implementation that avoids import errors
- Custom JSON-RPC implementation that follows the MCP protocol
- Support for initializing the server connection with client applications

### Add to Roo-Cline Configuration

1. Open the MCP settings file:

   ```bash
   # For macOS
   open ~/Library/Application\ Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json
   ```

2. Add the Evidence.dev MCP server configuration:

   ```json
   "evidence": {
     "command": "/Users/jonpage/Code/mcp/mcp-evidence/venv/bin/python",
     "args": [
       "/Users/jonpage/Code/mcp/mcp-evidence/mcp_server_evidence.py",
       "--project-path", "/Users/jonpage/Code/mcp/mcp-evidence",
       "--data-path", "/Users/jonpage/Code/mcp/mcp-evidence/sources"
     ],
     "env": {},
     "disabled": false,
     "alwaysAllow": [
       "evidence-list-sources",
       "evidence-list-tables", 
       "evidence-describe-table",
       "evidence-query"
     ],
     "autoApprove": [
       "evidence-list-sources",
       "evidence-list-tables", 
       "evidence-describe-table",
       "evidence-query"
     ]
   }
   ```

   Replace paths with the appropriate ones for your system.

3. For debugging purposes, you can add the `--debug` flag:

   ```json
   "args": [
     "/Users/jonpage/Code/mcp/mcp-evidence/mcp_server_evidence.py",
     "--project-path", "/Users/jonpage/Code/mcp/mcp-evidence",
     "--data-path", "/Users/jonpage/Code/mcp/mcp-evidence/sources",
     "--debug"
   ]
   ```

### For Cline Desktop App

1. Open the Cline configuration file:

   ```bash
   # For macOS
   open ~/Library/Application\ Support/Cline/claude_desktop_config.json
   ```

2. Add the same configuration as above to the `mcpServers` section of this file.

## Step 3: Understanding the MCP Protocol

Our custom implementation adds important support for the MCP protocol's initialization method. The key components:

1. **Initialize Method**: When an MCP client (like Cline) connects to the server, it sends an "initialize" method call. Our custom implementation now handles this properly.

2. **JSON-RPC Format**: The MCP protocol uses JSON-RPC 2.0 for communication. Each request/response follows this format:

   ```json
   // Request
   {
     "jsonrpc": "2.0",
     "id": 1,
     "method": "initialize",
     "params": {}
   }
   
   // Response
   {
     "jsonrpc": "2.0",
     "id": 1,
     "result": {
       "server": {
         "name": "mcp-server-evidence",
         "version": "0.1.0",
         "specVersion": "2024-11-05"
       },
       "capabilities": {
         "tools": {},
         "resources": {}
       }
     }
   }
   ```

3. **Tool Methods**: The server exposes four main tools:
   - `evidence-list-sources`: List all data sources
   - `evidence-list-tables`: List tables in a specific source
   - `evidence-describe-table`: Get schema for a specific table
   - `evidence-query`: Execute SQL queries on the data

## Step 4: Restart and Test

1. Restart Cline or VSCode to apply the changes

2. You can verify the connection works by:
   - Opening Cline or Roo-Cline
   - Asking "What MCP servers are available?"
   - If properly configured, you should see the "evidence" server listed

3. Try using the tools:
   ```
   List all sources in the evidence server
   ```
   
   ```
   Query the first 10 rows from the maniac_neon_prod_referral_codes copy table
   ```

## Troubleshooting

### Common Issues and Solutions

1. **"Method not found" errors**: Make sure the server is properly handling the "initialize" method. Our custom implementation in `mcp_server_evidence.py` now includes this.

2. **Missing dependency errors**: If you see errors about missing modules:
   - Make sure you've activated the virtual environment 
   - Verify all dependencies are installed with the right versions
   - Use the full path to the Python executable in your venv

3. **Path errors**:
   - Ensure all paths in the configuration are absolute paths
   - Check that the specified data directory exists
   - Verify that SQL files are in the expected locations

4. **Connection issues**:
   - Enable debug mode with the `--debug` flag
   - Check the Cursor/VSCode logs for error messages
   - Verify the server is being started correctly by the client

## Advanced: Custom Implementation Details

Our `mcp_server_evidence.py` script includes several key components:

1. A custom JSON-RPC implementation that doesn't rely on the MCP SDK's StdioServerTransport
2. Proper handling of SQL reserved words by quoting identifiers in SQL statements
3. Support for the MCP initialization protocol
4. Flexible data source discovery from SQL files or parquet files

The custom implementation avoids common issues with the SDK:
- No relative import problems
- No version compatibility issues
- Full control over the JSON-RPC communication

## Reference

- [Model Context Protocol Specification](https://spec.modelcontextprotocol.io/specification/2024-11-05/architecture/)
- [MCP Python SDK](https://pypi.org/project/mcp/)
- [Create Python Server Template](https://github.com/modelcontextprotocol/create-python-server)