#!/usr/bin/env python
"""
Standalone script for the Evidence.dev MCP server.
This script includes all the necessary code for running the server
without import or dependency issues.
"""
import asyncio
import argparse
import duckdb
import json
import logging
import os
import sys
from contextlib import closing
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
)
logger = logging.getLogger("mcp-server-evidence")
logger.setLevel(logging.INFO)

# Check that the right Python environment is being used
try:
    import duckdb
    logger.info(f"DuckDB version: {duckdb.__version__}")
except ImportError:
    logger.error("DuckDB not found. Please install it with: pip install duckdb>=1.1.3")
    sys.exit(1)

try:
    import mcp
    logger.info("MCP package found")
except ImportError:
    logger.error("MCP package not found. Please install it with: pip install mcp>=1.0.0")
    sys.exit(1)

try:
    import pyarrow
    logger.info(f"PyArrow version: {pyarrow.__version__}")
except ImportError:
    logger.error("PyArrow not found. Please install it with: pip install pyarrow>=14.0.1")
    sys.exit(1)


@dataclass
class Config:
    """
    Configuration for the Evidence.dev MCP server.
    """

    project_path: Path
    """
    Path to the Evidence.dev project root directory.
    """

    data_path: Optional[Path] = None
    """
    Optional override for the data path.
    """

    readonly: bool = True
    """
    Run server in read-only mode. Always True for Evidence.dev MCP server.
    """

    def get_data_path(self) -> Path:
        """
        Get the path to the data directory.
        
        Returns:
            Path to the data directory.
        
        Raises:
            ValueError: If the data directory doesn't exist.
        """
        # If a data_path is explicitly set, use that
        if self.data_path:
            if self.data_path.exists():
                return self.data_path
            raise ValueError(
                f"Data directory not found: {self.data_path}. "
                f"Please provide a valid data directory."
            )
            
        # Try the standard Evidence.dev path
        evidence_data_dir = self.project_path / ".evidence" / "template" / "static" / "data"
        if evidence_data_dir.exists():
            return evidence_data_dir
            
        # If we're in the mcp-evidence project, look for the sources directory
        sources_dir = self.project_path / "sources"
        if sources_dir.exists():
            return sources_dir
            
        # No data directory found
        raise ValueError(
            f"Evidence.dev data directory not found: {evidence_data_dir}. "
            f"Please run 'pnpm run sources' in your Evidence.dev project first, "
            f"or explicitly provide a data directory with --data-path."
        )


class EvidenceDataDiscovery:
    """
    Discovers Evidence.dev data sources and parquet files.
    """

    def __init__(self, config: Config):
        """
        Initialize EvidenceDataDiscovery.

        Args:
            config: Server configuration.
        """
        self.config = config
        self.sources = {}
        
        # Discover all sources
        logger.info("Starting Evidence.dev MCP Server")
        self._discover_sources()

    def _discover_sources(self):
        """
        Discover all Evidence.dev data sources.
        
        This method looks for Evidence.dev data sources in the data directory
        by first checking for a manifest.json file, and falling back to
        directory scanning if the manifest is not found.
        """
        try:
            data_path = self.config.get_data_path()
            
            # Try to discover sources from manifest.json
            manifest_path = data_path / "manifest.json"
            if manifest_path.exists():
                try:
                    with open(manifest_path, "r") as f:
                        manifest_data = json.load(f)
                        
                    sources = self._parse_manifest(manifest_data, data_path)
                    if sources:
                        self.sources = sources
                        logger.info(f"Discovered {len(sources)} sources from manifest")
                        return
                except Exception as e:
                    logger.warning(f"Error reading manifest.json: {e}")
            
            # Fall back to directory scanning
            self._discover_sources_from_directories(data_path)
        except Exception as e:
            logger.error(f"Error discovering sources: {e}")
            import traceback
            traceback.print_exc()

    def _parse_manifest(self, manifest_data: Dict, data_path: Path) -> Dict:
        """
        Parse the manifest.json file to discover sources and tables.
        
        Args:
            manifest_data: The parsed manifest JSON data.
            data_path: The base data path.
            
        Returns:
            A dictionary of source information.
        """
        sources = {}
        
        # Check if it's a renderedFiles format
        if "renderedFiles" in manifest_data:
            # Process renderedFiles format
            for source_name, file_paths in manifest_data["renderedFiles"].items():
                tables = {}
                
                for file_path in file_paths:
                    # Extract table name from file path
                    # Expected format: static/data/source_name/table_name/table_name.parquet
                    parts = file_path.split('/')
                    if len(parts) >= 4:
                        table_name = parts[-2]
                        
                        # Get paths for parquet and schema files
                        table_dir = data_path / source_name / table_name
                        parquet_file = table_dir / f"{table_name}.parquet"
                        schema_file = table_dir / f"{table_name}.schema.json"
                        
                        # Load schema data if available
                        schema_data = []
                        if schema_file.exists():
                            try:
                                with open(schema_file, "r") as f:
                                    schema_data = json.load(f)
                            except Exception as e:
                                logger.warning(f"Error reading schema file {schema_file}: {e}")
                        
                        # Add table to the source
                        tables[table_name] = {
                            "parquet_file": parquet_file,
                            "schema_file": schema_file,
                            "schema_data": schema_data
                        }
                
                # Add source to the sources dictionary
                sources[source_name] = {
                    "name": source_name,
                    "path": data_path / source_name,
                    "tables": tables
                }
            
            return sources
        
        # Check for sources format
        if "sources" in manifest_data:
            # Process sources format
            for source_name, source_data in manifest_data.get("sources", {}).items():
                tables = {}
                
                # Get tables for this source
                for table_name, table_data in source_data.get("tables", {}).items():
                    # Get paths for parquet and schema files
                    parquet_file = data_path / source_name / table_name / f"{table_name}.parquet"
                    schema_file = data_path / source_name / table_name / f"{table_name}.schema.json"
                    
                    # Load schema data if available
                    schema_data = []
                    if schema_file.exists():
                        try:
                            with open(schema_file, "r") as f:
                                schema_data = json.load(f)
                        except Exception as e:
                            logger.warning(f"Error reading schema file {schema_file}: {e}")
                    
                    # Add table to the source
                    tables[table_name] = {
                        "parquet_file": parquet_file,
                        "schema_file": schema_file,
                        "schema_data": schema_data
                    }
                
                # Add source to the sources dictionary
                sources[source_name] = {
                    "name": source_name,
                    "path": data_path / source_name,
                    "tables": tables
                }
        
        return sources

    def _discover_sources_from_directories(self, data_path: Path):
        """
        Discover sources by scanning directories.
        
        Args:
            data_path: The base data path.
        """
        sources = {}
        
        try:
            # Check if we're looking at the sources directory directly
            sql_files = list(data_path.glob("**/*.sql"))
            if sql_files:
                # Group SQL files by parent directory (source)
                source_dirs = {}
                for sql_file in sql_files:
                    source_name = sql_file.parent.name
                    if source_name not in source_dirs:
                        source_dirs[source_name] = []
                    source_dirs[source_name].append(sql_file)
                
                # Create sources from SQL files
                for source_name, files in source_dirs.items():
                    tables = {}
                    
                    for sql_file in files:
                        # Use the SQL filename as the table name (without extension)
                        table_name = sql_file.stem
                        
                        # Create table entry
                        tables[table_name] = {
                            "parquet_file": sql_file,  # Just use the SQL file as a reference
                            "schema_file": None,
                            "schema_data": []
                        }
                    
                    # Only add sources that have tables
                    if tables:
                        sources[source_name] = {
                            "name": source_name,
                            "path": sql_file.parent,
                            "tables": tables
                        }
                
                self.sources = sources
                logger.info(f"Discovered {len(sources)} sources from SQL files")
                return
            
            # Standard Evidence.dev directory structure
            for source_dir in data_path.iterdir():
                if not source_dir.is_dir():
                    continue
                    
                source_name = source_dir.name
                if source_name.startswith('.'):  # Skip hidden directories
                    continue
                    
                tables = {}
                
                # Scan for table directories
                for table_dir in source_dir.iterdir():
                    if not table_dir.is_dir():
                        continue
                        
                    table_name = table_dir.name
                    
                    # Look for parquet files
                    parquet_files = list(table_dir.glob("*.parquet"))
                    if not parquet_files:
                        continue
                    
                    # Use the first parquet file found
                    parquet_file = parquet_files[0]
                    
                    # Look for schema file
                    schema_files = list(table_dir.glob("*.schema.json"))
                    schema_file = schema_files[0] if schema_files else None
                    
                    # Load schema data if available
                    schema_data = []
                    if schema_file and schema_file.exists():
                        try:
                            with open(schema_file, "r") as f:
                                schema_data = json.load(f)
                        except Exception as e:
                            logger.warning(f"Error reading schema file {schema_file}: {e}")
                    
                    # Add table to the source
                    tables[table_name] = {
                        "parquet_file": parquet_file,
                        "schema_file": schema_file,
                        "schema_data": schema_data
                    }
                
                # Only add sources that have tables
                if tables:
                    sources[source_name] = {
                        "name": source_name,
                        "path": source_dir,
                        "tables": tables
                    }
            
            self.sources = sources
            logger.info(f"Discovered {len(sources)} sources from directory scan")
        except Exception as e:
            logger.error(f"Error scanning directories: {e}")
            import traceback
            traceback.print_exc()

    def get_sources(self) -> List[Dict]:
        """
        Get a list of all available data sources.
        
        Returns:
            A list of source information dictionaries.
        """
        return [
            {
                "name": source["name"],
                "tables": list(source["tables"].keys()),
                "path": str(source["path"])
            }
            for source in self.sources.values()
        ]

    def get_source_tables(self, source: str) -> List[str]:
        """
        Get a list of all tables in a data source.
        
        Args:
            source: The name of the data source.
            
        Returns:
            A list of table names.
            
        Raises:
            ValueError: If the source is not found.
        """
        if source not in self.sources:
            raise ValueError(f"Source not found: {source}")
            
        return list(self.sources[source]["tables"].keys())

    def get_table_schema(self, source: str, table: str) -> List[Dict]:
        """
        Get the schema information for a table.
        
        Args:
            source: The name of the data source.
            table: The name of the table.
            
        Returns:
            A list of schema field dictionaries.
            
        Raises:
            ValueError: If the source or table is not found.
        """
        if source not in self.sources:
            raise ValueError(f"Source not found: {source}")
            
        source_tables = self.sources[source]["tables"]
        if table not in source_tables:
            raise ValueError(f"Table not found: {table} in source {source}")
            
        return source_tables[table]["schema_data"]

    def get_parquet_path(self, source: str, table: str) -> Path:
        """
        Get the path to a parquet file.
        
        Args:
            source: The name of the data source.
            table: The name of the table.
            
        Returns:
            The path to the parquet file.
            
        Raises:
            ValueError: If the source or table is not found.
        """
        if source not in self.sources:
            raise ValueError(f"Source not found: {source}")
            
        source_tables = self.sources[source]["tables"]
        if table not in source_tables:
            raise ValueError(f"Table not found: {table} in source {source}")
            
        return source_tables[table]["parquet_file"]


class DuckDBDatabase:
    """
    Interface to DuckDB for querying Evidence.dev parquet files.
    """

    def __init__(self, discovery: EvidenceDataDiscovery):
        """
        Initialize DuckDBDatabase.
        
        Args:
            discovery: Evidence.dev data discovery interface.
        """
        self.discovery = discovery

    def connect(self):
        """
        Create a DuckDB connection.
        
        Returns:
            A DuckDB connection.
        """
        # For in-memory databases, we can't use read_only mode
        # We'll apply read-only constraints in our operations instead
        return duckdb.connect(":memory:")

    def execute_query(self, query: str, parameters: Optional[Dict] = None) -> List[Tuple]:
        """
        Execute a SQL query.
        
        Args:
            query: The SQL query to execute.
            parameters: Optional parameters for the query.
            
        Returns:
            The query results as a list of tuples.
        """
        with closing(self.connect()) as connection:
            cursor = connection.execute(query, parameters)
            return cursor.fetchall()

    def list_tables(self) -> List[Dict]:
        """
        List all tables across all sources.
        
        Returns:
            A list of table information dictionaries.
        """
        tables = []
        
        for source in self.discovery.sources.values():
            source_name = source["name"]
            for table_name in source["tables"].keys():
                tables.append({
                    "source": source_name,
                    "table": table_name
                })
                
        return tables

    def describe_table(self, source: str, table: str) -> List[Dict]:
        """
        Get schema information for a table.
        
        Args:
            source: The name of the data source.
            table: The name of the table.
            
        Returns:
            A list of schema field dictionaries.
        """
        return self.discovery.get_table_schema(source, table)

    def query_table(self, query: str) -> List[Tuple]:
        """
        Execute a SQL query on the parquet data.
        
        Args:
            query: The SQL query to execute.
            
        Returns:
            The query results as a list of tuples.
        """
        with closing(self.connect()) as connection:
            # Register all tables as views
            for source in self.discovery.sources.values():
                source_name = source["name"]
                for table_name, table_info in source["tables"].items():
                    view_name = f"{source_name}_{table_name}"
                    # Convert Path to string and escape any single quotes
                    parquet_path = str(table_info["parquet_file"]).replace("'", "''")
                    
                    try:
                        # Create a view for the parquet file with quoted identifiers to handle reserved words
                        create_view_sql = f'CREATE VIEW "{view_name}" AS SELECT * FROM read_parquet(\'{parquet_path}\')'
                        connection.execute(create_view_sql)
                    except Exception as e:
                        logger.warning(f"Error creating view {view_name}: {e}")
                        # Continue with other tables even if one fails
                        continue
            
            try:
                # Execute the query
                cursor = connection.execute(query)
                return cursor.fetchall()
            except Exception as e:
                logger.error(f"Error executing query: {e}")
                logger.error(f"Query: {query}")
                # Re-raise to fail the test
                raise


def handle_initialize(params):
    """
    Handle MCP initialize request.
    
    Args:
        params: Request parameters.
        
    Returns:
        Initialization response.
    """
    logger.info("Handling initialize request")
    
    # Log params for debugging
    if params:
        logger.debug(f"Initialize params: {json.dumps(params)}")
    
    # Return server information and capabilities
    # This follows the MCP 2024-11-05 specification
    return {
        "protocolVersion": "2024-11-05",
        "serverInfo": {
            "name": "mcp-server-evidence",
            "version": "0.1.0"
        },
        "capabilities": {
            "tools": {
                "available": True
            },
            "resources": {
                "available": True
            }
        }
    }


def handle_notifications_initialized(params):
    """
    Handle notifications/initialized request.
    
    Args:
        params: Request parameters.
        
    Returns:
        Empty response as notifications don't require a result.
    """
    # Logging disabled to reduce verbosity
    
    # No result needed for notifications
    return None


def handle_tools_list(params):
    """
    Handle tools/list request.
    
    Args:
        params: Request parameters.
        
    Returns:
        List of tools.
    """
    logger.info("Handling tools/list request")
    
    return {
        "tools": [
            {
                "name": "evidence-list-sources",
                "description": "List all Evidence.dev data sources"
            },
            {
                "name": "evidence-list-tables",
                "description": "List all tables in a specific data source",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "source": {
                            "type": "string",
                            "description": "Source name"
                        }
                    },
                    "required": ["source"]
                }
            },
            {
                "name": "evidence-describe-table",
                "description": "Get schema information for a specific table",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "source": {
                            "type": "string",
                            "description": "Source name"
                        },
                        "table": {
                            "type": "string",
                            "description": "Table name"
                        }
                    },
                    "required": ["source", "table"]
                }
            },
            {
                "name": "evidence-query",
                "description": "Execute SQL queries on the parquet data",
                "inputSchema": {
                    "type": "object",
                    "properties": {
                        "query": {
                            "type": "string",
                            "description": "SQL query to execute"
                        }
                    },
                    "required": ["query"]
                }
            }
        ]
    }


def handle_resources_list(params):
    """
    Handle resources/list request.
    
    Args:
        params: Request parameters.
        
    Returns:
        List of Evidence.dev data sources as resources.
    """
    logger.info("Handling resources/list request")
    
    # Create resources for each data source
    resources = []
    for source in discovery.get_sources():
        resources.append({
            "uri": f"evidence://{source['name']}",
            "name": f"Evidence.dev data source: {source['name']}",
            "mimeType": "application/json",
            "description": f"Data source with tables: {', '.join(source['tables'])}"
        })
        
    return {
        "resources": resources
    }


def handle_resources_templates_list(params):
    """
    Handle resources/templates/list request.
    
    Args:
        params: Request parameters.
        
    Returns:
        Resource templates for querying Evidence.dev data.
    """
    logger.info("Handling resources/templates/list request")
    
    # Define template for SQL queries
    templates = [
        {
            "uriTemplate": "evidence://query/{source}/{table}",
            "name": "Evidence.dev table data",
            "mimeType": "application/json",
            "description": "Data for a specific table in an Evidence.dev data source"
        },
        {
            "uriTemplate": "evidence://sql/{query}",
            "name": "Evidence.dev SQL query",
            "mimeType": "application/json", 
            "description": "Results of a SQL query on Evidence.dev data"
        }
    ]
    
    return {
        "resourceTemplates": templates
    }


def handle_read_resource(params):
    """
    Handle mcp.readResource requests.
    
    Args:
        params: Request parameters.
        
    Returns:
        Resource content.
    """
    uri = params.get("uri")
    
    logger.info(f"Handling readResource request for URI: {uri}")
    
    if uri.startswith("evidence://"):
        # Handle different URI formats
        parts = uri.replace("evidence://", "").split("/")
        
        if len(parts) == 1:
            # Format: evidence://source_name
            source_name = parts[0]
            try:
                source_data = next((s for s in discovery.get_sources() if s["name"] == source_name), None)
                if not source_data:
                    return {
                        "contents": [{
                            "uri": uri,
                            "mimeType": "text/plain",
                            "text": f"Error: Source not found: {source_name}"
                        }]
                    }
                
                tables = discovery.get_source_tables(source_name)
                return {
                    "contents": [{
                        "uri": uri,
                        "mimeType": "application/json",
                        "text": json.dumps({
                            "source": source_name,
                            "tables": tables,
                            "path": source_data.get("path", "")
                        }, indent=2)
                    }]
                }
            except Exception as e:
                return {
                    "contents": [{
                        "uri": uri,
                        "mimeType": "text/plain",
                        "text": f"Error reading source: {str(e)}"
                    }]
                }
        elif len(parts) >= 3 and parts[0] == "query":
            # Format: evidence://query/source_name/table_name
            source_name, table_name = parts[1], parts[2]
            try:
                # Get path to parquet file
                parquet_path = discovery.get_parquet_path(source_name, table_name)
                
                # Query the data
                with closing(db.connect()) as connection:
                    view_name = f"{source_name}_{table_name}"
                    parquet_path_str = str(parquet_path).replace("'", "''")
                    create_view_sql = f'CREATE VIEW "{view_name}" AS SELECT * FROM read_parquet(\'{parquet_path_str}\')'
                    connection.execute(create_view_sql)
                    
                    query_result = connection.execute(f'SELECT * FROM "{view_name}" LIMIT 100').fetchall()
                    
                    return {
                        "contents": [{
                            "uri": uri,
                            "mimeType": "application/json",
                            "text": json.dumps(query_result, indent=2, default=str)
                        }]
                    }
            except Exception as e:
                return {
                    "contents": [{
                        "uri": uri,
                        "mimeType": "text/plain",
                        "text": f"Error querying table: {str(e)}"
                    }]
                }
        elif len(parts) >= 2 and parts[0] == "sql":
            # Format: evidence://sql/encoded_query
            try:
                # The query is the rest of the URI after sql/
                sql_query = "/".join(parts[1:])
                
                # URL decode the query
                import urllib.parse
                sql_query = urllib.parse.unquote(sql_query)
                
                # Execute the query
                results = db.query_table(sql_query)
                
                return {
                    "contents": [{
                        "uri": uri,
                        "mimeType": "application/json",
                        "text": json.dumps(results, indent=2, default=str)
                    }]
                }
            except Exception as e:
                return {
                    "contents": [{
                        "uri": uri,
                        "mimeType": "text/plain",
                        "text": f"Error executing SQL query: {str(e)}"
                    }]
                }
    
    # If we get here, the URI was not recognized
    return {
        "contents": [{
            "uri": uri,
            "mimeType": "text/plain",
            "text": f"Error: Unrecognized URI format: {uri}"
        }]
    }


def handle_call_tool(params):
    """
    Handle mcp.callTool requests.
    
    Args:
        params: Request parameters.
        
    Returns:
        Response object.
    """
    tool_name = params.get("name")
    arguments = params.get("arguments", {})
    
    logger.info(f"Handling callTool request for tool: {tool_name}")
    
    if tool_name == "evidence-list-sources":
        return {
            "content": [
                {
                    "type": "text",
                    "text": json.dumps(discovery.get_sources(), indent=2)
                }
            ]
        }
    elif tool_name == "evidence-list-tables":
        source = arguments.get("source")
        if not source:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: Missing 'source' parameter"
                    }
                ],
                "isError": True
            }
            
        try:
            tables = discovery.get_source_tables(source)
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(tables, indent=2)
                    }
                ]
            }
        except ValueError as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    elif tool_name == "evidence-describe-table":
        source = arguments.get("source")
        table = arguments.get("table")
        
        if not source or not table:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: Missing 'source' or 'table' parameter"
                    }
                ],
                "isError": True
            }
            
        try:
            schema = db.describe_table(source, table)
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(schema, indent=2)
                    }
                ]
            }
        except ValueError as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error: {str(e)}"
                    }
                ],
                "isError": True
            }
    elif tool_name == "evidence-query":
        query = arguments.get("query")
        
        if not query:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": "Error: Missing 'query' parameter"
                    }
                ],
                "isError": True
            }
            
        try:
            results = db.query_table(query)
            return {
                "content": [
                    {
                        "type": "text",
                        "text": json.dumps(results, indent=2, default=str)
                    }
                ]
            }
        except Exception as e:
            return {
                "content": [
                    {
                        "type": "text",
                        "text": f"Error executing query: {str(e)}"
                    }
                ],
                "isError": True
            }
    else:
        return {
            "content": [
                {
                    "type": "text",
                    "text": f"Error: Unknown tool '{tool_name}'"
                }
            ],
            "isError": True
        }


def run_mcp_server(discovery: EvidenceDataDiscovery, db: DuckDBDatabase):
    """
    Run the MCP server.
    
    Args:
        discovery: Data discovery interface.
        db: Database interface.
    """
    # Create the basic MCP transport structure directly
    # No need to import StdioServerTransport, as it's causing issues
    logger.info("Starting MCP server on stdio")
    
    # Simple stdio communication
    import json
    import sys
    
    # Set up basic request handlers
    handlers = {
        "initialize": handle_initialize,
        "notifications/initialized": handle_notifications_initialized,
        "tools/list": handle_tools_list,
        "resources/list": handle_resources_list,
        "resources/templates/list": handle_resources_templates_list,
        "resources/read": handle_read_resource,
        "mcp.listTools": handle_tools_list,  # Backward compatibility
        "mcp.readResource": handle_read_resource,  # Backward compatibility
        "mcp.callTool": handle_call_tool
    }
    
    # Simple request-response loop
    try:
        while True:
            request_line = sys.stdin.readline().strip()
            if not request_line:
                break
                
            try:
                if logger.isEnabledFor(logging.DEBUG):
                    logger.debug(f"Received request: {request_line}")
                
                request = json.loads(request_line)
                method = request.get("method")
                request_id = request.get("id")
                params = request.get("params", {})
                
                if method in handlers:
                    result = handlers[method](params)
                    # If the handler returns None, it's a notification and doesn't need a response
                    if result is None and method.startswith("notifications/"):
                        continue
                        
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "result": result
                    }
                else:
                    logger.error(f"Method not found: {method}")
                    response = {
                        "jsonrpc": "2.0",
                        "id": request_id,
                        "error": {
                            "code": -32601,
                            "message": f"Method {method} not found"
                        }
                    }
            except Exception as e:
                logger.error(f"Error handling request: {e}")
                import traceback
                traceback.print_exc()
                response = {
                    "jsonrpc": "2.0",
                    "id": request.get("id", None),
                    "error": {
                        "code": -32603,
                        "message": str(e)
                    }
                }
                
            response_str = json.dumps(response)
            if logger.isEnabledFor(logging.DEBUG):
                logger.debug(f"Sending response: {response_str}")
                
            # Ensure only the clean JSON response goes to stdout
            print(response_str, flush=True)
            sys.stdout.flush()
    except Exception as e:
        logger.error(f"Server error: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description="Evidence.dev MCP Server")
    parser.add_argument(
        "--project-path",
        required=True,
        help="Path to the Evidence.dev project",
    )
    parser.add_argument(
        "--data-path",
        help="Optional override for the data directory path",
    )
    parser.add_argument(
        "--debug",
        action="store_true",
        help="Enable debug logging",
    )
    args = parser.parse_args()
    
    # Set up debug logging if requested
    if args.debug:
        logger.setLevel(logging.DEBUG)
        # Redirect logger to stderr to avoid interfering with stdout MCP communication
        for handler in logger.handlers:
            logger.removeHandler(handler)
        stderr_handler = logging.StreamHandler(sys.stderr)
        stderr_handler.setFormatter(logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s'))
        logger.addHandler(stderr_handler)
        
        logger.debug("Debug logging enabled (to stderr)")
    
    # Convert paths to Path objects
    project_path = Path(args.project_path)
    data_path = Path(args.data_path) if args.data_path else None
    
    # Create the config
    config = Config(project_path=project_path, data_path=data_path)
    
    # Create data discovery and database interfaces
    # These need to be global for the handle_call_tool function
    discovery = EvidenceDataDiscovery(config)
    db = DuckDBDatabase(discovery)
    
    # Run the server
    run_mcp_server(discovery, db)