export function parseLedgerRange(error: unknown) {
  const message =
    typeof error === 'object' && error !== null && 'message' in error
      ? String((error as { message?: unknown }).message ?? '')
      : '';
  const match = message.match(/ledger range:\s*(\d+)\s*-\s*(\d+)/i);
  if (!match) {
    return null;
  }

  return {
    min: Number(match[1]),
    max: Number(match[2]),
  };
}
