#!/usr/bin/env python
"""
Wrapper script for the Evidence.dev MCP server.
This script properly imports the server module and runs it,
avoiding relative import errors.
"""
import os
import sys
import argparse
from pathlib import Path

# Add the parent directory to the Python path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

# Now we can import the modules without relative import errors
from src.mcp_server_duckdb.config import Config
from src.mcp_server_duckdb.server import main

if __name__ == "__main__":
    # Parse command-line arguments
    parser = argparse.ArgumentParser(description="Evidence.dev MCP Server")
    parser.add_argument(
        "--project-path",
        required=True,
        help="Path to the Evidence.dev project",
    )
    args = parser.parse_args()
    
    # Convert the project_path string to a Path object
    # This is crucial as the Config class expects a Path object
    project_path = Path(args.project_path)
    
    # Verify the path exists
    if not project_path.exists():
        print(f"Error: Project path does not exist: {project_path}")
        sys.exit(1)
    
    # Create the config object with a Path object
    config = Config(project_path=project_path)
    
    try:
        # Run the server
        import asyncio
        asyncio.run(main(config))
    except TypeError as e:
        print(f"Type Error: {e}")
        print(f"Project path type: {type(project_path)}")
        print(f"Project path value: {project_path}")
        sys.exit(1)
    except Exception as e:
        print(f"Error running server: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)