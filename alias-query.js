import { extractColumnNames, addExplicitColumnAliases } from './dist/sql-utils.js';

// Test function for column name extraction
function testQuery(query) {
  console.log('\nOriginal Query:');
  console.log(query);
  
  console.log('\nExtracted Column Names:');
  const columnNames = extractColumnNames(query);
  console.log(columnNames);
  
  console.log('\nQuery with Explicit Aliases:');
  const explicitQuery = addExplicitColumnAliases(query);
  console.log(explicitQuery);
}

// Test with a variety of queries
console.log('===== SQL COLUMN NAME EXTRACTION TEST =====');

// Simple query
testQuery('SELECT id, name, age FROM users');

// Query with table alias
testQuery('SELECT u.id, u.name, u.age FROM users u');

// Query with AS aliases
testQuery('SELECT id AS user_id, name AS full_name FROM users');

// Query with function calls
testQuery('SELECT COUNT(*) as user_count, AVG(age) as avg_age FROM users');

// Complex query with joins
testQuery(`
  SELECT 
    u.id, 
    u.full_name, 
    u.created_at, 
    COUNT(o.id) as order_count 
  FROM 
    maniac_neon_2024_users u 
  LEFT JOIN 
    maniac_neon_2024_orders o 
  ON 
    u.id = o.clerk_user_id 
  GROUP BY 
    u.id, u.full_name, u.created_at 
  ORDER BY 
    order_count DESC 
  LIMIT 5
`);