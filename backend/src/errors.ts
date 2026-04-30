// backend/src/errors.ts

import type { NextFunction, Request, Response } from 'express';

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
  }
}

export function badRequest(message: string) {
  return new AppError(message, 400);
}

export function unauthorized(message = 'Unauthorized') {
  return new AppError(message, 401);
}

export function notFound(message: string) {
  return new AppError(message, 404);
}

export function asyncRoute(
  handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    void handler(req, res, next).catch(next);
  };
}

function mapSorobanError(message: string) {
  const normalized = message.toLowerCase();
  const mappings: Array<[string, string]> = [
    ['#7', 'Active loan already exists'],
    ['activeloanexists', 'Active loan already exists'],
    ['#8', 'Requirement not met (Insufficient balance or No credit tier)'],
    ['nocredittier', 'No qualifying credit tier'],
    ['#9', 'Amount exceeds tier limit'],
    ['borrowlimitexceeded', 'Amount exceeds tier limit'],
    ['#10', 'Insufficient pool liquidity'],
    ['insufficientpoolliquidity', 'Insufficient pool liquidity'],
    ['#13', 'No active loan found'],
    ['loannotfound', 'No active loan found'],
    ['#14', 'Loan already repaid'],
    ['loanalreadyrepaid', 'Loan already repaid'],
    ['#15', 'Loan already defaulted'],
    ['loandefaulted', 'Loan already defaulted'],
    ['#16', 'Loan is overdue and must be marked defaulted'],
    ['loanoverdue', 'Loan is overdue and must be marked defaulted'],
    ['#18', 'Loan is not overdue yet'],
    ['loannotoverdue', 'Loan is not overdue yet'],
    ['#8', 'Requirement not met (Insufficient balance or No credit tier)'],
    ['insufficientbalance', 'Insufficient PHPC balance for repayment'],
    ['insufficientallowance', 'Repayment approval did not settle correctly'],
    ['timeout', 'Stellar confirmation timed out. Try again.'],
  ];

  for (const [needle, friendly] of mappings) {
    if (normalized.includes(needle)) {
      return friendly;
    }
  }

  if (normalized.includes('account not found')) {
    return 'Wallet activation is still settling on Stellar. Please retry in a moment.';
  }

  return null;
}

export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction) {
  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ error: error.message });
  }

  const message = error instanceof Error ? error.message : 'Unexpected error';
  const friendly = mapSorobanError(message);

  console.error(error);
  return res
    .status(400)
    .json({ error: friendly ?? 'Something went wrong. Contract may be temporarily unavailable.' });
}
