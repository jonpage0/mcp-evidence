/**
 * Utility functions for SQL query processing
 */
/**
 * Extract column names from a SELECT * FROM cte_name query with CTEs
 *
 * This function specifically handles the pattern where a query:
 * 1. Has a WITH clause with one or more CTEs
 * 2. Ends with SELECT * FROM cte_name
 *
 * @param query The SQL query to parse
 * @returns Array of column names if they can be extracted, or null if parsing fails
 */
export declare function extractColumnsFromSelectStarCte(query: string): string[] | null;
/**
 * Extracts column names from a SQL SELECT query
 *
 * @param query The SQL query to parse
 * @returns An array of column names if they can be extracted, or null if parsing fails
 */
export declare function extractColumnNames(query: string): string[] | null;
/**
 * Create a SQL query with explicit column aliases
 *
 * This function adds AS clauses to each column in a SELECT statement
 * to ensure proper column naming in the result
 *
 * @param query The SQL query to process
 * @returns A new query with explicit column aliases
 */
export declare function addExplicitColumnAliases(query: string): string;
