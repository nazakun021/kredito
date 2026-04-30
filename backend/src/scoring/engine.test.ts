import { describe, expect, it } from 'vitest';
import { buildScorePayload, calculateScore, scoreToTier, tierFeeBps, toPhpAmount } from './engine';

describe('Scoring Engine', () => {
  it('should calculate score correctly', () => {
    const metrics = {
      txCount: 10,
      repaymentCount: 2,
      xlmBalance: 500,
      defaultCount: 0,
    };
    expect(calculateScore(metrics)).toBe(65);
  });

  it('should calculate score with defaultCount > 0 returning score minus penalty', () => {
    const metrics = {
      txCount: 10,
      repaymentCount: 2,
      xlmBalance: 500,
      defaultCount: 1, // -25 penalty
    };
    expect(calculateScore(metrics)).toBe(40);
  });

  it('should calculate score never returning negative (max(0, score))', () => {
    const metrics = {
      txCount: 0,
      repaymentCount: 0,
      xlmBalance: 0,
      defaultCount: 5,
    };
    expect(calculateScore(metrics)).toBe(0);
  });

  it('should test scoreToTier boundary values: 39 -> 0, 40 -> 1, 80 -> 2, 120 -> 3', () => {
    expect(scoreToTier(39)).toBe(0);
    expect(scoreToTier(40)).toBe(1);
    expect(scoreToTier(79)).toBe(1);
    expect(scoreToTier(80)).toBe(2);
    expect(scoreToTier(119)).toBe(2);
    expect(scoreToTier(120)).toBe(3);
  });

  it('should test tierFeeBps for all 4 tier values', () => {
    expect(tierFeeBps(3)).toBe(150);
    expect(tierFeeBps(2)).toBe(300);
    expect(tierFeeBps(1)).toBe(500);
    expect(tierFeeBps(0)).toBe(500);
  });

  it('should test buildScorePayload confirms borrowLimit is formatted correctly from tierLimit', () => {
    const payload = buildScorePayload('G123', {
      score: 95,
      tier: 2,
      tierLimit: 200_000_000_000n, // 20,000 PHPC (7 decimals)
      metrics: { txCount: 20, repaymentCount: 4, xlmBalance: 350, defaultCount: 0 },
      source: 'generated',
    });

    expect(payload.borrowLimit).toBe('20000.00');
    expect(payload.feeBps).toBe(300);
    expect(payload.score).toBe(95);
  });

  it('formats exact whole PHP values with 2 decimals', () => {
    expect(toPhpAmount(10_000_000n)).toBe('1.00');
    expect(toPhpAmount(5_000_000_000n)).toBe('500.00');
  });

  it('formats zero and sub-cent amounts safely for display', () => {
    expect(toPhpAmount(0n)).toBe('0.00');
    expect(toPhpAmount(1n)).toBe('0.00');
  });

  it('preserves meaningful precision beyond 2 decimals when needed', () => {
    expect(toPhpAmount(1_0000050n)).toBe('1.000005');
  });
});
