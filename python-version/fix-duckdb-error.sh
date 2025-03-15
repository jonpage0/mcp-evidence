#!/bin/bash
# Script to set up a virtual environment for the Evidence.dev MCP server
# This will fix the "ModuleNotFoundError: No module named 'duckdb'" error

# Set the base directory
BASE_DIR="/Users/jonpage/Code/mcp/mcp-evidence"
cd "$BASE_DIR"

# Create a virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv venv
fi

# Activate the virtual environment
source venv/bin/activate

# Install required packages
echo "Installing required Python packages..."
pip install --upgrade pip
pip install duckdb>=1.1.3
pip install mcp>=1.0.0
pip install pyarrow>=14.0.1

# Creating a test script to verify duckdb works
cat > test_duckdb.py << 'EOF'
try:
    import duckdb
    print("DuckDB imported successfully!")
    print(f"DuckDB version: {duckdb.__version__}")
    
    # Try a simple query
    con = duckdb.connect(':memory:')
    result = con.execute("SELECT 'Hello, Evidence.dev!' AS message").fetchall()
    print(f"Query result: {result[0][0]}")
    
except ImportError as e:
    print(f"Error importing DuckDB: {e}")
except Exception as e:
    print(f"Error testing DuckDB: {e}")
EOF

# Run the test script
echo "Testing DuckDB installation..."
python test_duckdb.py

# Get the full path to the Python executable in the virtual environment
PYTHON_PATH=$(which python)
echo "Python path in virtual environment: $PYTHON_PATH"

# Print instructions for updating the MCP settings file
echo ""
echo "============================================================="
echo "To fix the ModuleNotFoundError, update your MCP settings file:"
echo "============================================================="
echo "1. Open ~/Library/Application Support/Cursor/User/globalStorage/rooveterinaryinc.roo-cline/settings/cline_mcp_settings.json"
echo "2. Update the 'evidence' server configuration to use this Python executable path:"
echo ""
echo "{\"command\": \"$PYTHON_PATH\","
echo " \"args\": [\"$BASE_DIR/src/mcp_server_duckdb/server.py\", \"--project-path\", \"/Users/jonpage/Code/evidence.maniac.dev\"],"
echo " \"env\": {},"
echo " \"disabled\": false,"
echo " \"alwaysAllow\": []}"
echo ""
echo "3. Save the file and restart Cursor/VSCode"
echo "============================================================="
echo ""
echo "This will ensure that the MCP server uses the Python environment with DuckDB installed."

# Deactivate the virtual environment
deactivate