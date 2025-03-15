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
