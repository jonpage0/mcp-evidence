#!/usr/bin/env python
"""
Evidence.dev MCP Server using the official MCP SDK.
This server provides tools and resources for interacting with Evidence.dev data sources.
"""
import argparse
import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
from contextlib import asynccontextmanager, closing
import asyncio
from dataclasses import dataclass

import duckdb
from mcp.server.fastmcp import FastMCP, Context

# Configure logging to stderr
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("evidence-mcp-server")

class Config:
    """Configuration for the Evidence.dev MCP server."""
    def __init__(self, project_path: Path, data_path: Optional[Path] = None, debug: bool = False):
        self.project_path = project_path
        self.data_path = data_path
        self.debug = debug
        
        if debug:
            logger.setLevel(logging.DEBUG)
            logger.debug("Debug logging enabled")
    
    def get_data_path(self) -> Path:
        """Get the path to the data directory."""
        # If a data_path is explicitly set, use that
        if self.data_path and self.data_path.exists():
            return self.data_path
        
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
            f"Evidence.dev data directory not found. "
            f"Please run 'pnpm run sources' in your Evidence.dev project first, "
            f"or explicitly provide a data directory with --data-path."
        )

class EvidenceDataDiscovery:
    """Discovers Evidence.dev data sources and parquet files."""
    def __init__(self, config: Config):
        self.config = config
        self.sources = {}
        
        logger.info("Starting Evidence.dev MCP Server")
        self._discover_sources()
    
    def _discover_sources(self):
        """Discover all Evidence.dev data sources."""
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
    
    def _parse_manifest(self, manifest_data: Dict, data_path: Path) -> Dict:
        """Parse the manifest.json file to discover sources and tables."""
        sources = {}
        
        # Check if it's a renderedFiles format
        if "renderedFiles" in manifest_data:
            # Process renderedFiles format
            for source_name, file_paths in manifest_data["renderedFiles"].items():
                tables = {}
                
                for file_path in file_paths:
                    # Extract table name from file path
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
        """Discover sources by scanning directories."""
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
    
    def get_sources(self) -> List[Dict]:
        """Get a list of all available data sources."""
        return [
            {
                "name": source["name"],
                "tables": list(source["tables"].keys()),
                "path": str(source["path"])
            }
            for source in self.sources.values()
        ]
    
    def get_source_tables(self, source: str) -> List[str]:
        """Get a list of all tables in a data source."""
        if source not in self.sources:
            raise ValueError(f"Source not found: {source}")
        
        return list(self.sources[source]["tables"].keys())
    
    def get_table_schema(self, source: str, table: str) -> List[Dict]:
        """Get the schema information for a table."""
        if source not in self.sources:
            raise ValueError(f"Source not found: {source}")
        
        source_tables = self.sources[source]["tables"]
        if table not in source_tables:
            raise ValueError(f"Table not found: {table} in source {source}")
        
        return source_tables[table]["schema_data"]
    
    def get_parquet_path(self, source: str, table: str) -> Path:
        """Get the path to a parquet file."""
        if source not in self.sources:
            raise ValueError(f"Source not found: {source}")
        
        source_tables = self.sources[source]["tables"]
        if table not in source_tables:
            raise ValueError(f"Table not found: {table} in source {source}")
        
        return source_tables[table]["parquet_file"]

class DuckDBDatabase:
    """Interface to DuckDB for querying Evidence.dev parquet files."""
    def __init__(self, discovery: EvidenceDataDiscovery):
        self.discovery = discovery
    
    def connect(self):
        """Create a DuckDB connection."""
        return duckdb.connect(":memory:")
    
    def list_tables(self) -> List[Dict]:
        """List all tables across all sources."""
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
        """Get schema information for a table."""
        return self.discovery.get_table_schema(source, table)
    
    def query_table(self, query: str) -> List[Dict]:
        """Execute a SQL query on the parquet data."""
        with closing(self.connect()) as connection:
            # Register all tables as views
            for source in self.discovery.sources.values():
                source_name = source["name"]
                for table_name, table_info in source["tables"].items():
                    view_name = f"{source_name}_{table_name}"
                    # Convert Path to string and escape any single quotes
                    parquet_path = str(table_info["parquet_file"]).replace("'", "''")
                    
                    try:
                        # Create a view for the parquet file with quoted identifiers
                        create_view_sql = f'CREATE VIEW "{view_name}" AS SELECT * FROM read_parquet(\'{parquet_path}\')'
                        connection.execute(create_view_sql)
                    except Exception as e:
                        logger.warning(f"Error creating view {view_name}: {e}")
                        continue
            
            try:
                # Execute the query
                cursor = connection.execute(query)
                if cursor and cursor.description:
                    results = cursor.fetchall()
                    # Convert to list of dictionaries for JSON serialization
                    column_names = [col[0] for col in cursor.description]
                    return [dict(zip(column_names, row)) for row in results]
                return []
            except Exception as e:
                logger.error(f"Error executing query: {e}")
                raise

@dataclass
class AppState:
    """Application state shared between all handlers."""
    discovery: EvidenceDataDiscovery
    db: DuckDBDatabase

# Parse command line arguments
parser = argparse.ArgumentParser(description="Evidence.dev MCP Server")
parser.add_argument(
    "--project-path",
    default=".",
    help="Path to the Evidence.dev project (default: current directory)",
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

# Convert paths to Path objects
project_path = Path(args.project_path)
data_path = Path(args.data_path) if args.data_path else None

# Create the config
config = Config(
    project_path=project_path,
    data_path=data_path,
    debug=args.debug
)

# Initialize discovery and database interfaces
discovery = EvidenceDataDiscovery(config)
db = DuckDBDatabase(discovery)

# Create the app state
app_state = AppState(discovery=discovery, db=db)

# Create the FastMCP server
mcp = FastMCP(
    "Evidence.dev MCP Server",
    dependencies=["duckdb>=1.1.3", "pyarrow>=14.0.1"]
)

@mcp.tool()
def list_sources() -> List[Dict]:
    """List all Evidence.dev data sources"""
    return app_state.discovery.get_sources()

@mcp.tool()
def list_tables(source: str) -> List[str]:
    """List all tables in a specific data source"""
    try:
        return app_state.discovery.get_source_tables(source)
    except ValueError as e:
        raise ValueError(str(e))

@mcp.tool()
def describe_table(source: str, table: str) -> List[Dict]:
    """Get schema information for a specific table"""
    try:
        return app_state.db.describe_table(source, table)
    except ValueError as e:
        raise ValueError(str(e))

@mcp.tool()
def run_query(query: str) -> List[Dict]:
    """Execute SQL queries on the Evidence.dev data
    
    Tables are available in the format: source_tablename
    For example: SELECT * FROM maniac_neon_users LIMIT 10
    """
    try:
        return app_state.db.query_table(query)
    except Exception as e:
        raise ValueError(f"Error executing query: {str(e)}")

@mcp.resource("evidence://{source}")
def get_source_info(source: str) -> str:
    """Get information about a specific Evidence.dev data source"""
    try:
        sources = app_state.discovery.get_sources()
        source_info = next((s for s in sources if s["name"] == source), None)
        if not source_info:
            return f"Source not found: {source}"
        
        tables = app_state.discovery.get_source_tables(source)
        return json.dumps({
            "name": source,
            "tables": tables,
            "path": source_info["path"]
        }, indent=2)
    except Exception as e:
        return f"Error getting source info: {str(e)}"

@mcp.resource("evidence://{source}/{table}")
def get_table_data(source: str, table: str) -> str:
    """Get data from a specific Evidence.dev table (limited to 100 rows)"""
    try:
        query = f'SELECT * FROM "{source}_{table}" LIMIT 100'
        results = app_state.db.query_table(query)
        return json.dumps(results, indent=2, default=str)
    except Exception as e:
        return f"Error getting table data: {str(e)}"

if __name__ == "__main__":
    # Run the server
    mcp.run()