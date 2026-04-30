// frontend/lib/tiers.ts

export function tierGradient(tier: number): string {
  switch (tier) {
    case 3: // Gold
      return 'linear-gradient(135deg, #F59E0B 0%, #FBBF24 100%)';
    case 2: // Silver
      return 'linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)';
    case 1: // Bronze
      return 'linear-gradient(135deg, #D97706 0%, #F59E0B 100%)';
    default:
      return 'linear-gradient(135deg, #475569 0%, #64748B 100%)';
  }
}

export function tierLabel(tier: number): string {
  switch (tier) {
    case 3: return 'Gold';
    case 2: return 'Silver';
    case 1: return 'Bronze';
    default: return 'Unrated';
  }
}

export function tierContextPhrase(score: number): string {
  if (score >= 120) return 'Excellent';
  if (score >= 80) return 'Good standing';
  if (score >= 40) return 'On track';
  return 'Building credit';
}

export function getTierFromLabel(label: string): number {
  switch (label) {
    case 'Gold': return 3;
    case 'Silver': return 2;
    case 'Bronze': return 1;
    default: return 0;
  }
}
