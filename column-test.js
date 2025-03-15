#!/usr/bin/env node

import * as duckdb from '@duckdb/node-api';

/**
 * Test script to specifically explore the DuckDB API for column names
 */
async function testColumnNames() {
  try {
    console.log('Creating DuckDB instance...');
    const db = await duckdb.DuckDBInstance.create(':memory:');
    console.log('DuckDB instance created successfully');
    
    console.log('Connecting to DuckDB...');
    const connection = await db.connect();
    console.log('Connected to DuckDB successfully');

    // Create a test table with explicit column names
    console.log('Creating test table...');
    await connection.run(`
      CREATE TABLE test_orders (
        order_id INTEGER PRIMARY KEY,
        customer_name VARCHAR,
        order_amount DECIMAL(10,2)
      )
    `);
    
    // Insert some test data
    console.log('Inserting test data...');
    await connection.run(`
      INSERT INTO test_orders VALUES
        (1, 'Alice Smith', 129.99),
        (2, 'Bob Johnson', 79.95),
        (3, 'Carol Williams', 249.50)
    `);
    
    // Run a simple query with column aliases
    console.log('Running query with column aliases...');
    const result = await connection.run(`
      SELECT 
        order_id AS id, 
        customer_name AS name, 
        order_amount AS amount 
      FROM test_orders
    `);
    
    console.log('Query executed successfully');
    console.log('Result object type:', typeof result);
    console.log('Result constructor name:', result.constructor.name);
    
    // Get result metadata
    console.log('\nResult metadata:');
    console.log('Row count:', result.rowCount);
    console.log('Chunk count:', result.chunkCount);
    
    // Process chunks to get column information
    console.log('\nProcessing chunks to extract column information:');
    
    for (let c = 0; c < result.chunkCount; c++) {
      console.log(`\nChunk ${c}:`);
      const chunk = result.getChunk(c);
      
      console.log('Chunk object:', chunk);
      console.log('Chunk constructor:', chunk.constructor.name);
      console.log('Chunk row count:', chunk.rowCount);
      
      // Try different methods to get column names
      try {
        console.log('\nTrying different methods to get column names:');
        
        // Method 1: Try to get column names directly
        if (typeof chunk.getColumnNames === 'function') {
          console.log('Using getColumnNames():', chunk.getColumnNames());
        } else {
          console.log('getColumnNames() not available');
        }
        
        // Method 2: Check if columns have names
        console.log('\nExploring chunk properties:');
        console.log('Chunk properties:', Object.keys(chunk));
        
        // Method 3: Inspect the vectors array
        if (Array.isArray(chunk.vectors) && chunk.vectors.length > 0) {
          console.log('\nExploring chunk.vectors:');
          console.log('Vectors array length:', chunk.vectors.length);
          console.log('First vector properties:', Object.keys(chunk.vectors[0]));
          
          // Check if vectors have names
          if (chunk.vectors[0].name) {
            console.log('Vector names:');
            chunk.vectors.forEach((v, i) => console.log(`  Vector ${i}:`, v.name));
          }
        }
        
        // Method 4: Try using getColumns method
        if (typeof chunk.getColumns === 'function') {
          console.log('\nUsing getColumns():');
          const columns = chunk.getColumns();
          console.log('Columns array length:', columns.length);
          
          // Inspect each column
          columns.forEach((col, i) => {
            console.log(`Column ${i}:`, col);
            console.log(`Column ${i} properties:`, Object.keys(col));
            
            // Check if column has name property
            if (col.name) {
              console.log(`Column ${i} name:`, col.name);
            }
          });
        }
        
        // Method 5: Try using column metadata
        if (chunk.metadata || chunk.schema) {
          console.log('\nChecking for metadata or schema:');
          console.log('Metadata:', chunk.metadata);
          console.log('Schema:', chunk.schema);
        }
        
        // Method 6: Check if we can access column names via prototype
        console.log('\nChecking prototype methods:');
        console.log('Chunk prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chunk)));
        
        // Try to use the visitColumns method which might have column information
        if (typeof chunk.visitColumns === 'function') {
          console.log('\nTrying visitColumns:');
          const columnNames = [];
          chunk.visitColumns((colIdx, colName, colData) => {
            console.log(`Column ${colIdx}:`, colName);
            columnNames.push(colName);
          });
          
          if (columnNames.length > 0) {
            console.log('Column names from visitColumns:', columnNames);
          }
        }
        
        // Try to get column info using SQL metadata
        console.log('\nTrying a different approach with SQL metadata:');
        connection.run(`SELECT * FROM pragma_table_info('test_orders')`)
          .then(metaResult => {
            console.log('Table metadata result:', metaResult);
            // Try to extract column names from metadata result
          })
          .catch(err => {
            console.log('Error getting table metadata:', err);
          });
        
      } catch (e) {
        console.error('Error exploring column names:', e);
      }
      
      // Try to access row data to see the structure
      try {
        console.log('\nExtracting first row to see structure:');
        if (typeof chunk.getRowValues === 'function') {
          const firstRow = chunk.getRowValues(0);
          console.log('First row:', firstRow);
        } else if (typeof chunk.getRows === 'function') {
          const rows = chunk.getRows();
          console.log('First row from getRows():', rows[0]);
        }
      } catch (e) {
        console.error('Error getting row data:', e);
      }
    }
    
    console.log('\nTest completed');
    
  } catch (error) {
    console.error('Test error:', error);
  }
}

testColumnNames().catch(console.error);