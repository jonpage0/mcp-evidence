import asyncio
import sys
import logging

# Use a relative import instead of an absolute one
from .config import Config  

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)

# Try importing DuckDB to ensure it's available
try:
    import duckdb
except ImportError:
    print("Error: DuckDB package not found. Please install it with:")
    print("pip install duckdb>=1.1.3")
    sys.exit(1)

from . import server


def main():
    """Main entry point for the Evidence.dev MCP server."""
    try:
        config = Config.from_arguments()
        asyncio.run(server.main(config))
    except ValueError as e:
        print(f"Error: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)


# Expose important items at package level
__all__ = ["main", "server", "Config"]
