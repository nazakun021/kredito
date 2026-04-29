/**
 * Extract a user-facing error message from any thrown value.
 *
 * Priority:
 *   1. Backend API error in response.data.error (Axios)
 *   2. Plain Error.message (JS / Freighter rejection)
 *   3. Provided fallback string
 */
export function getErrorMessage(err: unknown, fallback: string): string {
  // Axios response error
  if (
    typeof err === 'object' &&
    err !== null &&
    'response' in err &&
    typeof (err as { response?: { data?: { error?: string } } }).response?.data?.error === 'string'
  ) {
    return (err as { response: { data: { error: string } } }).response.data.error;
  }

  // Plain JS Error (e.g. Freighter user rejection, network mismatch)
  if (err instanceof Error && err.message) {
    return err.message;
  }

  return fallback;
}
