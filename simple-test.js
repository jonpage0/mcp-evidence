import * as duckdb from '@duckdb/node-api';

async function runSimpleTest() {
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
        amount DECIMAL(10,2)
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
    
    // Run a simple query and log the result
    console.log('Running query...');
    const result = await connection.run('SELECT * FROM test_orders');
    console.log('Query executed successfully');
    
    // Inspect the result object
    console.log('Result object type:', typeof result);
    console.log('Result object:', result);
    console.log('Result constructor name:', result.constructor.name);
    console.log('Result methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(result)));
    console.log('Result properties:', Object.keys(result));
    // Let's look closer at the methods that should be available
    console.log('\nInspecting rowCount and chunkCount methods:');
    console.log('rowCount type:', typeof result.rowCount);
    console.log('chunkCount type:', typeof result.chunkCount);
    
    // Maybe they're getters instead of methods?
    try {
      console.log('Trying rowCount as a getter:', result.rowCount);
      console.log('Trying chunkCount as a getter:', result.chunkCount);
    } catch (e) {
      console.log('Error accessing as getters:', e.message);
    }
    
    // Try to access the raw result property
    console.log('\nInspecting the result.result property:');
    if (result.result) {
      console.log('result.result type:', typeof result.result);
      
      // Try to call toString on the external object
      try {
        console.log('result.result.toString():', result.result.toString());
      } catch (e) {
        console.log('Error calling toString():', e.message);
      }
      
      // Try to access properties on the external object
      try {
        console.log('result.result properties:', Object.keys(result.result));
      } catch (e) {
        console.log('Error getting properties:', e.message);
      }
    }
    
    // Try using getChunk, which should be available
    console.log('\nTrying getChunk method:');
    try {
      if (typeof result.getChunk === 'function') {
        const chunk = result.getChunk(0);
        console.log('Got chunk:', chunk);
        console.log('Chunk type:', typeof chunk);
        console.log('Chunk constructor:', chunk.constructor.name);
        console.log('Chunk methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(chunk)));
        console.log('Chunk properties:', Object.keys(chunk));
        
        // If we can access the chunk, try to get data from it
        if (typeof chunk.size === 'function') {
          console.log('Chunk size:', chunk.size());
        } else if (chunk.size !== undefined) {
          console.log('Chunk size (property):', chunk.size);
        }
        
        if (typeof chunk.getChildAt === 'function') {
          try {
            console.log('First column:', chunk.getChildAt(0));
          } catch (e) {
            console.log('Error calling getChildAt:', e.message);
          }
        }
      } else {
        console.log('getChunk is not a function, type:', typeof result.getChunk);
      }
    } catch (e) {
      console.log('Error using getChunk:', e.message);
    }
    
    // Try each of the methods that might be available
    console.log('\nTrying different approaches to access data:');
    try {
      // Approach 1: Check for toArray
      if (typeof result.toArray === 'function') {
        console.log('Using toArray():', result.toArray());
      } else {
        console.log('toArray() is not available');
      }
      
      // Approach 2: Check for fetchAllRows
      if (typeof result.fetchAllRows === 'function') {
        console.log('Using fetchAllRows():', result.fetchAllRows());
      } else {
        console.log('fetchAllRows() is not available');
      }
      
      // Approach 3: Check for rowCount and chunkCount
      if (typeof result.rowCount === 'function') {
        console.log('Row count:', result.rowCount());
      } else {
        console.log('rowCount() is not available');
      }
      
      if (typeof result.chunkCount === 'function') {
        console.log('Chunk count:', result.chunkCount());
      } else {
        console.log('chunkCount() is not available');
      }
      
      // Approach 4: Try to access as 
      if (result.length !== undefined) {
        console.log('Result has length:', result.length);
        console.log('First row:', result[0]);
      } else {
        console.log('Result does not have a length property');
      }
      
      // Approach 5: Try to access result.result if it exists
      if (result.result) {
        console.log('Result has a result property:', result.result);
        if (typeof result.result.toArray === 'function') {
          console.log('Using result.result.toArray():', result.result.toArray());
        }
      } else {
        console.log('Result does not have a result property');
      }
      
      // Approach 6: Try to iterate over the result if it's iterable
      if (Symbol.iterator in Object(result)) {
        console.log('Result is iterable, iterating:');
        const rows = [];
        for (const row of result) {
          rows.push(row);
        }
        console.log('Iterated rows:', rows);
      } else {
        console.log('Result is not iterable');
      }
    
    } catch (e) {
      console.error('Error while trying to access result data:', e);
    }
  } catch (error) {
    console.error('Error in test:', error);
  }
}

// Run the test
runSimpleTest().catch(console.error);