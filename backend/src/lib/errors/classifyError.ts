// backend/src/lib/errors/classifyError.ts

export type ErrorAction = 'IGNORE' | 'RETRY' | 'FAIL';

export function isContractError(err: any, code: string): boolean {
  const message = err instanceof Error ? err.message : String(err);
  // Support both raw XDR strings and friendly names if they happen to be in the message
  return message.includes(code) || message.toLowerCase().includes(code.toLowerCase());
}

export function isRpcError(err: any): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const rpcMarkers = [
    'request failed',
    'ECONNREFUSED',
    'ETIMEDOUT',
    'socket hang up',
    '500 Internal Server Error',
    '502 Bad Gateway',
    '503 Service Unavailable',
    '504 Gateway Timeout',
    'rate limit',
  ];
  return rpcMarkers.some((marker) => message.includes(marker) || message.toLowerCase().includes(marker.toLowerCase()));
}

export function classifyError(err: any): ErrorAction {
  // Expected race conditions / idempotency markers
  if (
    isContractError(err, 'LoanDefaulted') ||
    isContractError(err, 'LoanAlreadyDefaulted') ||
    isContractError(err, 'LoanNotOverdue') ||
    isContractError(err, 'LoanAlreadyRepaid') ||
    isContractError(err, 'LoanNotFound')
  ) {
    return 'IGNORE';
  }

  // Transient network/RPC issues
  if (isRpcError(err) || isContractError(err, 'TX_TIMEOUT')) {
    return 'RETRY';
  }

  return 'FAIL';
}
