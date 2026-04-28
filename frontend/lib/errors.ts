/**
 * Extract error messages from Axios error responses.
 * Shared across all pages to avoid duplication.
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
  ) {
    return (err as { response?: { data?: { error?: string } } }).response?.data?.error as string;
  }
  return fallback;
}
