#!/usr/bin/env python
"""
Minimal Evidence.dev MCP Server for testing.
"""
import argparse
import logging
from typing import List

from mcp.server.fastmcp import FastMCP

# Configure logging to stderr
logging.basicConfig(
    level=logging.DEBUG,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler()]
)
logger = logging.getLogger("evidence-mcp-minimal")

# Parse command line arguments (to match what's in the MCP settings file)
parser = argparse.ArgumentParser(description="Minimal Evidence MCP Server")
parser.add_argument(
    "--project-path",
    help="Path to the project (ignored in this minimal example)",
)
parser.add_argument(
    "--data-path",
    help="Path to the data directory (ignored in this minimal example)",
)
parser.add_argument("--debug", action="store_true", help="Enable debug logging")
args = parser.parse_args()

# Create the FastMCP server with a simple name
mcp = FastMCP("Evidence")

@mcp.tool()
def hello_world() -> str:
    """Say hello to the world"""
    return "Hello, World!"

@mcp.tool()
def list_tables(source: str) -> List[str]:
    """List all tables in a specific data source"""
    return ["fake_table_1", "fake_table_2"]

@mcp.resource("evidence://test")
def get_test_info() -> str:
    """Get test information"""
    return "This is a test resource."

if __name__ == "__main__":
    # Run the server
    mcp.run()