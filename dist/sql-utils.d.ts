/**
 * Utility functions for SQL query processing
 */
/**
 * Extract column names from a SELECT * FROM cte_name query with Common Table Expressions (CTEs)
 *
 * This function specifically handles the pattern where a query:
 * 1. Has a WITH clause with one or more CTEs
 * 2. Ends with SELECT * FROM cte_name
 *
 * This is particularly useful for complex analytical queries that build intermediate
 * result sets with meaningful column names that should be preserved in the final output.
 *
 * @param query The SQL query to parse
 * @returns Array of column names if they can be extracted, or null if parsing fails
 */
export declare function extractColumnsFromSelectStarCte(query: string): string[] | null;
/**
 * Extracts column names from a SQL SELECT query
 *
 * This utility function analyzes the SELECT clause of a SQL query to determine
 * the column names that will appear in the result. It handles:
 * - Explicit column aliases using AS
 * - Implicit column aliases (the last part of a column expression)
 * - Function calls and expressions
 *
 * Used in conjunction with the DuckDB Neo API's columnNames() method to ensure
 * proper column naming in query results.
 *
 * @param query The SQL query to parse
 * @returns An array of column names if they can be extracted, or null if parsing fails
 */
export declare function extractColumnNames(query: string): string[] | null;
/**
 * Create a SQL query with explicit column aliases
 *
 * This function enhances SQL queries by adding explicit AS clauses to each column
 * in a SELECT statement. It handles two main cases:
 *
 * 1. WITH...SELECT * FROM cte pattern: Replaces the asterisk (*) with explicit
 *    column references and aliases based on the CTE definition
 *
 * 2. Regular SELECT queries: Adds AS clauses to columns without explicit aliases
 *
 * This advanced SQL transformation ensures that DuckDB can properly name columns
 * in the query result, particularly for complex queries with CTEs, functions,
 * and computed columns.
 *
 * @param query The SQL query to process
 * @returns A new query with explicit column aliases
 */
export declare function addExplicitColumnAliases(query: string): string;
