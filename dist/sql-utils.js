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
export function extractColumnsFromSelectStarCte(query) {
    try {
        // Normalize the query for easier parsing
        const normalizedQuery = query
            .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
            .replace(/\/\*.*?\*\//g, '') // Remove /* ... */ comments
            .replace(/--.*?$/gm, '') // Remove -- comments
            .trim();
        // Check if the query ends with SELECT * FROM cte_name
        const selectStarMatch = /SELECT\s+\*\s+FROM\s+([a-zA-Z0-9_]+)\s*;?\s*$/i.exec(normalizedQuery);
        if (!selectStarMatch?.[1]) {
            return null; // Not a SELECT * FROM cte_name pattern
        }
        const cteNameToFind = selectStarMatch[1];
        // Find the CTE definition
        const cteDefRegex = new RegExp(`${cteNameToFind}\\s+AS\\s*\\(\\s*SELECT\\s+([^;]+?)\\s+FROM`, 'i');
        const cteDefMatch = cteDefRegex.exec(normalizedQuery);
        if (!cteDefMatch?.[1]) {
            return null; // Couldn't find the CTE definition
        }
        // Extract column names from the CTE's SELECT clause
        const selectClause = cteDefMatch[1].trim();
        // Split the select clause by commas, respecting parentheses
        const parts = [];
        let currentPart = '';
        let parenthesesCount = 0;
        for (let i = 0; i < selectClause.length; i++) {
            const char = selectClause[i];
            if (char === '(') {
                parenthesesCount++;
                currentPart += char;
            }
            else if (char === ')') {
                parenthesesCount--;
                currentPart += char;
            }
            else if (char === ',' && parenthesesCount === 0) {
                parts.push(currentPart.trim());
                currentPart = '';
            }
            else {
                currentPart += char;
            }
        }
        // Add the last part
        if (currentPart.trim()) {
            parts.push(currentPart.trim());
        }
        // Extract column names from each part
        return parts.map(part => {
            // Check for explicit AS alias
            const asMatch = /\s+AS\s+[\"\']?([a-zA-Z0-9_]+)[\"\']?$/i.exec(part);
            if (asMatch?.[1]) {
                return asMatch[1];
            }
            // Check for implicit alias (last part after space or dot)
            const implicitMatch = /[.\s]([a-zA-Z0-9_]+)$/i.exec(part);
            if (implicitMatch?.[1]) {
                return implicitMatch[1];
            }
            // If it's a function call, use the whole function as name
            if (part.includes('(') && part.includes(')')) {
                return part.trim();
            }
            // Fallback: use the whole part
            return part.trim();
        });
    }
    catch (e) {
        console.warn('Error extracting columns from SELECT * with CTE:', e);
        return null;
    }
}
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
export function extractColumnNames(query) {
    try {
        // Normalize the query to make parsing easier
        const normalizedQuery = query
            .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
            .replace(/\/\*.*?\*\//g, '') // Remove /* ... */ comments
            .replace(/--.*?$/gm, '') // Remove -- comments
            .trim();
        // Get the part between SELECT and FROM (case insensitive)
        const selectMatch = /SELECT\s+(.*?)\s+FROM/i.exec(normalizedQuery);
        if (!selectMatch || !selectMatch[1]) {
            return null;
        }
        const selectClause = selectMatch[1].trim();
        // If there's a * with no AS, we can't determine column names
        if (selectClause === '*') {
            return null;
        }
        // Split by commas, but respect parentheses (for functions like COUNT, SUM)
        const parts = [];
        let currentPart = '';
        let parenthesesCount = 0;
        for (let i = 0; i < selectClause.length; i++) {
            const char = selectClause[i];
            if (char === '(') {
                parenthesesCount++;
                currentPart += char;
            }
            else if (char === ')') {
                parenthesesCount--;
                currentPart += char;
            }
            else if (char === ',' && parenthesesCount === 0) {
                parts.push(currentPart.trim());
                currentPart = '';
            }
            else {
                currentPart += char;
            }
        }
        // Add the last part
        if (currentPart.trim()) {
            parts.push(currentPart.trim());
        }
        // Extract column names from each part
        return parts.map(part => {
            // Check for explicit AS alias
            const asMatch = /\s+AS\s+[\"\']?([a-zA-Z0-9_]+)[\"\']?$/i.exec(part);
            if (asMatch?.[1]) {
                return asMatch[1];
            }
            // Check for implicit alias (last part after space or dot)
            const implicitMatch = /[.\s]([a-zA-Z0-9_]+)$/i.exec(part);
            if (implicitMatch?.[1]) {
                return implicitMatch[1];
            }
            // If it's a function call, use the whole function as name
            if (part.includes('(') && part.includes(')')) {
                return part.trim();
            }
            // Fallback: use the whole part
            return part.trim();
        });
    }
    catch (e) {
        console.warn('Error parsing SQL for column names:', e);
        return null;
    }
}
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
export function addExplicitColumnAliases(query) {
    // First, check if this is a WITH...SELECT * FROM cte pattern
    const withColumns = extractColumnsFromSelectStarCte(query);
    if (withColumns) {
        // For WITH...SELECT * FROM cte, we need to replace the * with explicit columns
        const selectStarMatch = /SELECT\s+\*\s+FROM\s+([a-zA-Z0-9_]+)\s*;?\s*$/i.exec(query);
        if (selectStarMatch) {
            // Build a new SELECT clause with explicit column names
            const columnsPart = withColumns.map(col => `${selectStarMatch[1]}.${col} AS "${col}"`).join(', ');
            const newSelectClause = `SELECT ${columnsPart} FROM ${selectStarMatch[1]}`;
            // Replace the original SELECT * FROM cte with our new clause
            const newQuery = query.substring(0, selectStarMatch.index) + newSelectClause;
            return newQuery;
        }
    }
    // If not a special case, proceed with normal column alias addition
    const columnNames = extractColumnNames(query);
    if (!columnNames) {
        return query; // Return original if parsing fails
    }
    try {
        // Find the SELECT clause
        const selectMatch = /SELECT\s+(.*?)\s+FROM/i.exec(query);
        if (!selectMatch || !selectMatch[1]) {
            return query;
        }
        const selectClause = selectMatch[1].trim();
        // Split into column expressions
        const parts = [];
        let currentPart = '';
        let parenthesesCount = 0;
        for (let i = 0; i < selectClause.length; i++) {
            const char = selectClause[i];
            if (char === '(') {
                parenthesesCount++;
                currentPart += char;
            }
            else if (char === ')') {
                parenthesesCount--;
                currentPart += char;
            }
            else if (char === ',' && parenthesesCount === 0) {
                parts.push(currentPart.trim());
                currentPart = '';
            }
            else {
                currentPart += char;
            }
        }
        // Add the last part
        if (currentPart.trim()) {
            parts.push(currentPart.trim());
        }
        // Add explicit AS clauses if not already present
        // Regular column list
        const newParts = parts.map((part, index) => {
            if (index >= columnNames.length) {
                return part; // More parts than names, return as-is
            }
            // Skip if it already has an explicit AS
            if (/\s+AS\s+/i.test(part)) {
                return part;
            }
            return `${part} AS "${columnNames[index]}"`;
        });
        // Reconstruct the query
        const newSelectClause = newParts.join(', ');
        return query.replace(selectClause, newSelectClause);
    }
    catch (e) {
        console.warn('Error adding column aliases:', e);
        return query; // Return original if processing fails
    }
}
//# sourceMappingURL=sql-utils.js.map