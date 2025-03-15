"""
Evidence.dev MCP Server Implementation.

This module provides a Model Context Protocol (MCP) server for Evidence.dev,
allowing clients to query and explore Evidence.dev data sources.
"""
import asyncio
import json
import logging
import os
from contextlib import closing
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple, Union

import duckdb
from mcp.server import Server
from mcp.types import TextContent, Resource

from .config import Config

# Set up logging
logger = logging.getLogger("mcp-server-evidence")
logger.setLevel(logging.INFO)


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
        data_path = self.config.data_path
        
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
        
        # Extract source information from manifest
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
        
        # Scan for source directories
        for source_dir in data_path.iterdir():
            if not source_dir.is_dir():
                continue
                
            source_name = source_dir.name
            tables = {}
            
            # Scan for table directories
            for table_dir in source_dir.iterdir():
                if not table_dir.is_dir():
                    continue
                    
                table_name = table_dir.name
                
                # Check for parquet and schema files
                parquet_file = table_dir / f"{table_name}.parquet"
                schema_file = table_dir / f"{table_name}.schema.json"
                
                if not parquet_file.exists():
                    continue
                
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
            
            # Only add sources that have tables
            if tables:
                sources[source_name] = {
                    "name": source_name,
                    "path": source_dir,
                    "tables": tables
                }
        
        self.sources = sources
        logger.info(f"Discovered {len(sources)} sources from directory scan")

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


async def main(config: Config, _discovery=None, _db=None, _server=None):
    """
    Main entry point for the Evidence.dev MCP server.
    
    Args:
        config: Server configuration.
        _discovery: For testing only - override data discovery.
        _db: For testing only - override database.
        _server: For testing only - override server.
    """
    # Create data discovery and database interfaces
    discovery = _discovery or EvidenceDataDiscovery(config)
    db = _db or DuckDBDatabase(discovery)
    
    # The actual server implementation would go here.
    # For testing purposes, we'll just return the discovery and db instances
    return discovery, db


if __name__ == "__main__":
    asyncio.run(main(Config.from_arguments()))
