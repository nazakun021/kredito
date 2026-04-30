// frontend/lib/queryKeys.ts

export const QUERY_KEYS = {
  score: (wallet: string) => ['score', wallet],
  pool: ['pool'],
  loanStatus: ['loan-status'],
} as const;
