/**
 * Polyfill for BigInt serialization in JSON.stringify
 *
 * This file extends BigInt.prototype to add a toJSON method,
 * which solves the "Do not know how to serialize a BigInt" error.
 */
/**
 * Custom replacer function for JSON.stringify to handle
 * DuckDB-specific decimal values with BigInt
 *
 * @param key The current key being processed
 * @param value The value to convert
 * @returns The processed value safe for JSON serialization
 */
export declare function duckDBDecimalReplacer(key: string, value: unknown): unknown;
export declare function safeStringify(value: unknown, space?: number): string;
