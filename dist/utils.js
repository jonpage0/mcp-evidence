/**
 * Utility functions for the MCP-Evidence server
 */
/**
 * Custom replacer function for JSON.stringify to handle BigInt values
 * This solves the "Do not know how to serialize a BigInt" error
 *
 * @param key The current key being processed
 * @param value The value to convert
 * @returns The processed value safe for JSON serialization
 */
export function bigIntReplacer(key, value) {
    // Handle BigInt values
    if (typeof value === 'bigint') {
        return value.toString();
    }
    // Handle DuckDB decimal values with BigInt
    if (value &&
        typeof value === 'object' &&
        value.constructor &&
        'constructor' in value &&
        'name' in value.constructor &&
        value.constructor.name === 'DuckDBDecimalValue' &&
        'value' in value &&
        typeof value.value === 'bigint') {
        // If it has scale, apply it to represent a decimal
        if ('scale' in value && typeof value.scale === 'number') {
            const bigIntValue = value.value;
            const scale = value.scale;
            // Convert to string with correct decimal places
            const stringValue = bigIntValue.toString();
            if (scale === 0) {
                return stringValue;
            }
            if (stringValue.length <= scale) {
                // Handle small numbers that need leading zeros
                return `0.${'0'.repeat(scale - stringValue.length)}${stringValue}`;
            }
            // Insert decimal point at the right position
            const insertPos = stringValue.length - scale;
            return `${stringValue.substring(0, insertPos)}.${stringValue.substring(insertPos)}`;
        }
        // Fallback: just return the value as string
        return value.value.toString();
    }
    return value;
}
/**
 * Safe JSON stringify that handles BigInt values
 *
 * @param value The value to stringify
 * @param space Number of spaces for indentation
 * @returns A JSON string with BigInt values properly handled
 */
export function safeJsonStringify(value, space = 2) {
    return JSON.stringify(value, bigIntReplacer, space);
}
//# sourceMappingURL=utils.js.map