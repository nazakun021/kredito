// frontend/lib/queryKeys.ts

export const QUERY_KEYS = {
  score: (wallet: string) => ['score', wallet] as const,
  pool: ['pool'] as const,
  loanStatus: (wallet: string) => ['loan-status', wallet] as const,
} as const;

export type QueryKeys = typeof QUERY_KEYS;
