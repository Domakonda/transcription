import { createHash } from 'crypto';

/**
 * Generate MD5 hash from a string
 * Used for creating unique identifiers from call IDs
 */
export function generateHash(input: string): string {
  return createHash('md5').update(input).digest('hex');
}

/**
 * Generate a unique hash from call ID for DynamoDB partition key
 */
export function generateCallIdHash(callId: string): string {
  return generateHash(callId);
}
