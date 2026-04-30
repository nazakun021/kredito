import { describe, expect, it } from 'vitest';
import { calculateScore, scoreToTier, tierFeeBps } from './engine';

describe('Scoring Engine', () => {
  it('should calculate score correctly', () => {
    const metrics = {
      txCount: 10,
      repaymentCount: 2,
      avgBalance: 500,
      defaultCount: 0,
    };
    expect(calculateScore(metrics)).toBe(65);
  });

  it('should convert score to tier', () => {
    expect(scoreToTier(130)).toBe(3);
    expect(scoreToTier(90)).toBe(2);
    expect(scoreToTier(50)).toBe(1);
    expect(scoreToTier(20)).toBe(0);
  });

  it('should return correct fee bps for tiers', () => {
    expect(tierFeeBps(3)).toBe(150);
    expect(tierFeeBps(2)).toBe(300);
    expect(tierFeeBps(1)).toBe(500);
    expect(tierFeeBps(0)).toBe(500);
  });
});
