/**
 * Polyfill for BigInt serialization in JSON.stringify
 *
 * This file extends BigInt.prototype to add a toJSON method,
 * which solves the "Do not know how to serialize a BigInt" error.
 */
// First check if BigInt already has a toJSON method
if (typeof BigInt !== 'undefined' && !('toJSON' in BigInt.prototype)) {
    // Add a toJSON method to BigInt.prototype
    // This will be called automatically by JSON.stringify
    BigInt.prototype.toJSON = function () {
        return this.toString();
    };
}
// Handle DuckDB decimal values that might contain BigInt values
// We can't modify their prototype directly, so we'll handle them in our replacer function
/**
 * Custom replacer function for JSON.stringify to handle
 * DuckDB-specific decimal values with BigInt
 *
 * @param key The current key being processed
 * @param value The value to convert
 * @returns The processed value safe for JSON serialization
 */
export function duckDBDecimalReplacer(key, value) {
    // Handle DuckDB decimal values with BigInt
    if (value &&
        typeof value === 'object' &&
        'constructor' in value &&
        value.constructor &&
        'name' in value.constructor &&
        value.constructor.name === 'DuckDBDecimalValue' &&
        'value' in value &&
        'scale' in value) {
        const decimalValue = value;
        // Convert the decimal value to a number or string while preserving scale
        if (decimalValue.scale > 0) {
            // Handle decimal values
            const bigintValue = decimalValue.value;
            const scale = decimalValue.scale;
            // For small enough values, we can convert to a number safely
            if (bigintValue < BigInt(Number.MAX_SAFE_INTEGER) &&
                bigintValue > BigInt(Number.MIN_SAFE_INTEGER)) {
                // Convert to a number with correct decimal places
                return Number(bigintValue) / (10 ** scale);
            }
            // For larger values, format as a string with a decimal point
            const stringValue = bigintValue.toString();
            if (stringValue.length <= scale) {
                // Small number needs leading zeros
                return `0.${'0'.repeat(scale - stringValue.length)}${stringValue}`;
            }
            // Insert decimal point
            const insertPos = stringValue.length - scale;
            return `${stringValue.substring(0, insertPos)}.${stringValue.substring(insertPos)}`;
        }
        // For non-decimal values, just return the bigint value as a string
        return decimalValue.value.toString();
    }
    return value;
}
// Export a custom JSON.stringify function that handles both BigInt and DuckDB decimal values
export function safeStringify(value, space) {
    return JSON.stringify(value, duckDBDecimalReplacer, space);
}
//# sourceMappingURL=bigint-polyfill.js.map