/**
 * Validation utilities for input data
 */

/**
 * Validate S3 URI format
 */
export function validateS3Uri(uri: string): boolean {
  const s3UriPattern = /^s3:\/\/[a-z0-9][\.\-a-z0-9]{1,61}[a-z0-9](\/.*)?$/;
  return s3UriPattern.test(uri);
}

/**
 * Validate call ID format
 */
export function validateCallId(callId: string): boolean {
  return Boolean(callId) && callId.length > 0 && callId.length <= 255;
}

/**
 * Parse S3 URI into bucket and key
 */
export function parseS3Uri(uri: string): { bucket: string; key: string } | null {
  const match = uri.match(/^s3:\/\/([^\/]+)\/(.+)$/);
  if (!match) {
    return null;
  }
  return {
    bucket: match[1],
    key: match[2],
  };
}

/**
 * Extract call ID from S3 key path
 * Expected format: "transcription-outputs/CALL_ID/..."
 */
export function extractCallIdFromS3Key(key: string): string | null {
  const parts = key.split('/');
  if (parts.length < 2) {
    return null;
  }
  // Assuming format: prefix/callId/...
  return parts[1] || null;
}
