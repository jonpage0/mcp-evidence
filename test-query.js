#!/usr/bin/env node

import * as duckdb from '@duckdb/node-api';
import * as fs from 'node:fs';
import * as path from 'node:path';

// Simple test script to verify DuckDB integration
async function testQuery() {
  try {
    console.log('Creating DuckDB instance...');
    const db = await duckdb.DuckDBInstance.create(':memory:');
    console.log('DuckDB instance created successfully');
    
    console.log('Connecting to DuckDB...');
    const connection = await db.connect();
    console.log('Connected to DuckDB successfully');

    // Create a simple test table
    console.log('Creating test table...');
    await connection.run(`
      CREATE TABLE test_orders (
        id INTEGER,
        customer_name VARCHAR,
        order_date DATE,
        amount DECIMAL(10,2)
      )
    `);
    console.log('Test table created successfully');

    // Insert some test data
    console.log('Inserting test data...');
    await connection.run(`
      INSERT INTO test_orders VALUES
        (1, 'Alice Smith', '2025-01-15', 129.99),
        (2, 'Bob Johnson', '2025-02-03', 79.95),
        (3, 'Carol Williams', '2025-02-21', 249.50),
        (4, 'Dave Brown', '2025-03-05', 19.99),
        (5, 'Eve Davis', '2025-03-17', 399.99)
    `);
    console.log('Test data inserted successfully');

    // Run a simple query
    console.log('Running query...');
    const result = await connection.run(`
      SELECT COUNT(*) as order_count, 
             SUM(amount) as total_amount, 
             AVG(amount) as avg_amount 
      FROM test_orders
    `);
    
    // Process results
    console.log('Query executed successfully');
    console.log('Result object:', result);
    console.log('Result methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(result)));
    
    // Process results using the DuckDB API
    console.log('\nProcessing results using different approaches:');
    
    // Get row and chunk count
    if (typeof result.rowCount === 'function') {
      console.log(`Row count: ${result.rowCount()}`);
    }
    
    if (typeof result.chunkCount === 'function') {
      const chunkCount = result.chunkCount();
      console.log(`Chunk count: ${chunkCount}`);
      
      // Process each chunk
      for (let c = 0; c < chunkCount; c++) {
        const chunk = result.getChunk(c);
        console.log(`Chunk ${c}:`, chunk);
        
        console.log('Chunk methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chunk)));

        // Try to access the data directly
        try {
          console.log('Accessing chunk data directly...');
          console.log('Chunk properties:', Object.keys(chunk));
          
          // Try accessing any methods or properties on the chunk
          if (typeof chunk.size === 'function') {
            console.log('Chunk size:', chunk.size());
          }
        } catch (e) {
          console.log('Error accessing chunk data:', e.message);
        }
      }
    }

    // Try a JSON stringification approach
    try {
      console.log('\nAccessing data through JSON conversion:');
      
      // Create a custom toJSON method for our result
      result.toJSON = () => {
        const keys = ['order_count', 'total_amount', 'avg_amount'];
        const resultObj = {};
          try {
            const vector = chunk.getVector(idx);
            resultObj[key] = vector.getValue(0);
          } catch (e) {
            console.log(`Error getting ${key}:`, e.message);
          }
        return resultObj;
      };
      
      // Try using toJSON
      
      console.log('JSON.stringify result:');
      try {
        console.log(JSON.stringify(result, (key, value) => {
          if (value && typeof value === 'object' && value.constructor && value.constructor.name === 'External') {
            return '[External DuckDB Object]';
          }
          return value;
        }, 2));
      } catch (e) {
        console.log('Error stringifying result:', e.message);
      }
      // Try using a different approach - using inspect
      const util = await import('node:util');
      console.log('\nResult inspect:');
      console.log(util.inspect(result, { depth: 3, colors: true }));
      
      // Direct chunk
      if (result.chunkCount() > 0) {
        const chunk = result.getChunk(0);
        console.log('\nChunk inspect:');
        console.log(util.inspect(chunk, { depth: 3, colors: true }));
      }
    } catch (e) {
      console.log('JSON conversion error:', e.message);
    }
    
  } catch (error) {
    console.error('Error in test query:', error);
  }
}

testQuery().catch(console.error);