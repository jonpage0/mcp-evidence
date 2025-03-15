/**
 * Utility functions for SQL query processing
 */
/**
 * Extracts column names from a SQL SELECT query
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
 * This function adds AS clauses to each column in a SELECT statement
 * to ensure proper column naming in the result
 *
 * @param query The SQL query to process
 * @returns A new query with explicit column aliases
 */
export function addExplicitColumnAliases(query) {
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