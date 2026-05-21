// backend/src/scoring/engine.test.ts
import { describe, it, expect } from 'vitest';
import { calculateScore } from './engine';

// Test vectors derived from the updated Rust contract
// New formula: score = (tx_count × 1) + (repayment_count × 15) + (min(xlmBalance*2/100, 10) × 5) - (default_count × 30)
const fixtures = [
  {
    metrics: {
      txCount: 50,
      repaymentCount: 3,
      xlmBalance: 500,
      defaultCount: 0,
    },
    expected: 145, // (50*1) + (3*15) + (min(500*2/100, 10)*5) - (0*30) = 50 + 45 + 50 - 0 = 145
  },
  {
    metrics: {
      txCount: 10,
      repaymentCount: 0,
      xlmBalance: 50,
      defaultCount: 1,
    },
    expected: 0, // (10*1) + (0*15) + (min(50*2/100, 10)*5) - (1*30) = 10 + 0 + 5 - 30 = -15 → clamped to 0
  },
  {
    metrics: {
      txCount: 20,
      repaymentCount: 2,
      xlmBalance: 200,
      defaultCount: 0,
    },
    expected: 70, // (20*1) + (2*15) + (min(200*2/100, 10)*5) - (0*30) = 20 + 30 + 20 - 0 = 70
  },
  {
    metrics: {
      txCount: 100,
      repaymentCount: 5,
      xlmBalance: 2000, // Balance factor caps at 10
      defaultCount: 0,
    },
    expected: 225, // (100*1) + (5*15) + (10*5) - 0 = 100 + 75 + 50 = 225
  },
];

describe('calculateScore parity', () => {
  it.each(fixtures)('matches Rust contract for $metrics', ({ metrics, expected }) => {
    expect(calculateScore(metrics)).toBe(expected);
  });
});
