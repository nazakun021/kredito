// backend/src/scoring/engine.test.ts
import { describe, it, expect } from 'vitest';
import { calculateScore } from './engine';

// Test vectors derived from the Rust contract (contracts/credit_registry/src/lib.rs)
const fixtures = [
  {
    metrics: {
      txCount: 50,
      repaymentCount: 3,
      xlmBalance: 500,
      defaultCount: 0,
    },
    expected: 155, // (50*2) + (3*10) + (min(500/100, 10)*5) - (0*25) = 100 + 30 + 25 - 0 = 155
  },
  {
    metrics: {
      txCount: 10,
      repaymentCount: 0,
      xlmBalance: 50,
      defaultCount: 1,
    },
    expected: 0, // (10*2) + (0*10) + (min(50/100, 10)*5) - (1*25) = 20 + 0 + 0 - 25 = -5 -> 0
  },
  {
    metrics: {
      txCount: 20,
      repaymentCount: 2,
      xlmBalance: 200,
      defaultCount: 0,
    },
    expected: 70, // (20*2) + (2*10) + (min(200/100, 10)*5) - (0*25) = 40 + 20 + 10 - 0 = 70
  },
  {
    metrics: {
      txCount: 100,
      repaymentCount: 5,
      xlmBalance: 2000, // Balance factor caps at 10
      defaultCount: 0,
    },
    expected: 300, // (100*2) + (5*10) + (10*5) - 0 = 200 + 50 + 50 = 300
  },
];

describe('calculateScore parity', () => {
  it.each(fixtures)('matches Rust contract for $metrics', ({ metrics, expected }) => {
    expect(calculateScore(metrics)).toBe(expected);
  });
});
