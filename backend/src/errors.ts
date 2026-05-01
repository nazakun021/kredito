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

export function asyncRoute<R = Request>(
  handler: (req: R, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: any, res: any, next: NextFunction) => {
    void handler(req as R, res, next).catch(next);
  };
}

function mapSorobanError(message: string) {
  const normalized = message.toLowerCase();
  const mappings: Array<[string, string]> = [
    ['#1', 'System is already configured'],
    ['alreadyinitialized', 'System is already configured'],
    ['#2', 'System is not yet configured'],
    ['notinitialized', 'System is not yet configured'],
    ['#3', 'Invalid fee configuration'],
    ['#4', 'Invalid loan term'],
    ['invalidloanterm', 'Invalid loan term'],
    ['#5', 'Amount must be greater than zero'],
    ['invalidamount', 'Amount must be greater than zero'],
    ['#6', 'Pool capacity exceeded'],
    ['poolbalanceoverflow', 'Pool capacity exceeded'],
    ['#7', 'You already have an active loan'],
    ['activeloanexists', 'You already have an active loan'],
    ['#8', 'No credit score found — generate a score first'],
    ['nocredittier', 'No credit score found — generate a score first'],
    ['#9', 'Amount exceeds your current tier limit'],
    ['borrowlimitexceeded', 'Amount exceeds your current tier limit'],
    ['#10', 'Insufficient pool liquidity'],
    ['insufficientpoolliquidity', 'Insufficient pool liquidity'],
    ['#11', 'Calculation error'],
    ['feeoverflow', 'Calculation error'],
    ['#12', 'Calculation error'],
    ['dueledgeroverflow', 'Calculation error'],
    ['#13', 'No active loan found'],
    ['loannotfound', 'No active loan found'],
    ['#14', 'Loan already repaid'],
    ['loanalreadyrepaid', 'Loan already repaid'],
    ['#15', 'This loan has been defaulted and cannot be repaid'],
    ['loandefaulted', 'This loan has been defaulted and cannot be repaid'],
    ['#16', 'This loan is overdue'],
    ['loanoverdue', 'This loan is overdue'],
    ['#17', 'Calculation error'],
    ['repaymentoverflow', 'Calculation error'],
    ['#18', 'Loan is not yet overdue'],
    ['loannotoverdue', 'Loan is not yet overdue'],
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
    .status(500)
    .json({ error: friendly ?? 'Something went wrong. Contract may be temporarily unavailable.' });
}
