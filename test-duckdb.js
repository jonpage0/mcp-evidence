#!/usr/bin/env node

// Simple script to test DuckDB integration
import * as duckdb from '@duckdb/node-api';

async function testDuckDB() {
  console.log('DuckDB API:', Object.keys(duckdb));
  
  try {
    console.log('Creating DuckDB instance...');
    const db = await duckdb.DuckDBInstance.create(':memory:');
    console.log('DuckDB instance created successfully');
    
    console.log('Connecting to DuckDB...');
    const connection = await db.connect();
    console.log('Connected to DuckDB successfully');
    
    console.log('Running a simple query...');
    const result = await connection.run('SELECT 42 AS answer');
    console.log('Query executed successfully');
    
    console.log('Result:', result);
    console.log('Result methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(result)));
    
    // Try different methods to get the data
    if (typeof result.fetchAllRows === 'function') {
      console.log('Using fetchAllRows():', result.fetchAllRows());
    } else if (typeof result.toArray === 'function') {
      console.log('Using toArray():', result.toArray());
    } else {
      console.log('Raw result:', JSON.stringify(result, null, 2));
    }
    
    console.log('Test completed successfully');
  } catch (error) {
    console.error('Error testing DuckDB:', error);
  }
}

testDuckDB().catch(console.error);