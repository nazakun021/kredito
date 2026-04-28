import { horizonServer, rpcServer, contractIds } from '../stellar/client';
import { xdr, Address, scValToNative } from '@stellar/stellar-sdk';
import db from '../db';

export interface ScoreBreakdown {
  // Layer 1
  emailVerified: { score: number, max: number, label: string };
  incomeDeclaration: { score: number, max: number, label: string };
  cashFlowRatio: { score: number, max: number, label: string };
  businessPermit: { score: number, max: number, label: string };
  brgyCertificate: { score: number, max: number, label: string };
  coopMembership: { score: number, max: number, label: string };
  // Layer 2
  accountAge: { score: number, max: number, label: string };
  txVolume: { score: number, max: number, label: string };
  repaymentHistory: { score: number, max: number, label: string };
}

export async function fetchAccountAge(address: string): Promise<number> {
  try {
    const account = await horizonServer.accounts().accountId(address).call();
    const createdAt = new Date(account.created_at);
    const diffDays = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays;
  } catch (error) {
    return 0; // Account not found
  }
}

export async function fetchTxCount(address: string): Promise<number> {
  try {
    const txs = await horizonServer.transactions().forAccount(address).limit(200).call();
    return txs.records.length;
  } catch (error) {
    return 0;
  }
}

export async function fetchRepaymentHistory(address: string): Promise<{ onTime: number, defaults: number }> {
  try {
    const latestLedger = await rpcServer.getLatestLedger();
    const startLedger = Math.max(0, latestLedger.sequence - 100000); // Look back ~5.7 days at 5s/ledger

    const events = await rpcServer.getEvents({
      startLedger: startLedger,
      filters: [
        {
          type: 'contract',
          contractIds: [contractIds.lendingPool],
          topics: [
            ['*', Address.fromString(address).toScVal()]
          ]
        }
      ]
    });

    let onTime = 0;
    let defaults = 0;

    for (const event of events.events) {
      const topic = event.topic[0];
      const topicStr = scValToNative(topic);
      
      if (topicStr === 'loan_repaid') {
        onTime++;
      } else if (topicStr === 'loan_defaulted') {
        defaults++;
      }
    }

    return { onTime, defaults };
  } catch (error) {
    console.error('Error fetching repayment history:', error);
    return { onTime: 0, defaults: 0 };
  }
}

export function computeBootstrapScore(data: any): { score: number, breakdown: any } {
  let score = 0;
  const breakdown: any = {};

  // Email Verification (0-15 pts)
  const emailScore = data.emailVerified ? 15 : 0;
  score += emailScore;
  breakdown.emailVerified = { score: emailScore, max: 15, label: data.emailVerified ? 'Email address confirmed' : 'Email not verified' };

  // Declared Financial Profile (0-20 pts)
  let incomeScore = 0;
  if (data.monthlyIncomeBand === '>20k' || data.monthlyIncomeBand === '10k-20k') {
    incomeScore = 10;
  } else if (data.monthlyIncomeBand === '5k-10k') {
    incomeScore = 5;
  }
  score += incomeScore;
  breakdown.incomeDeclaration = { score: incomeScore, max: 10, label: incomeScore > 0 ? 'Income declared' : 'Low/No income declared' };

  // Employment status
  let empScore = 0;
  if (data.employmentType === 'self_employed') {
    empScore = 5;
  } else if (data.employmentType === 'employed') {
    empScore = 3;
  }
  score += empScore;
  // Merging into incomeDeclaration max for simplicity or keep separate
  
  // Cash flow ratio (mocked from band comparison)
  const cashFlowScore = (data.monthlyIncomeBand === '>20k' && data.monthlyExpenseBand === '<5k') ? 5 : 0;
  score += cashFlowScore;
  breakdown.cashFlowRatio = { score: cashFlowScore, max: 5, label: cashFlowScore > 0 ? 'Positive cash flow declared' : 'Regular cash flow' };

  // Community Attestation (0-15 pts)
  const permitScore = data.hasBusinessPermit ? 5 : 0;
  const brgyScore = data.hasBrgyCertificate ? 5 : 0;
  const coopScore = data.hasCoopMembership ? 5 : 0;
  
  score += permitScore + brgyScore + coopScore;
  breakdown.businessPermit = { score: permitScore, max: 5, label: data.hasBusinessPermit ? 'Registered business' : 'No permit' };
  breakdown.brgyCertificate = { score: brgyScore, max: 5, label: data.hasBrgyCertificate ? 'Community-verified' : 'No cert' };
  breakdown.coopMembership = { score: coopScore, max: 5, label: data.hasCoopMembership ? 'Cooperative member' : 'Not a member' };

  return { score, breakdown };
}

export async function computeFullScore(userId: number, address: string) {
  // Layer 1: Bootstrap
  const bootstrapData = db.prepare('SELECT * FROM bootstrap_assessments WHERE user_id = ?').get(userId) as any;
  const user = db.prepare('SELECT email_verified FROM users WHERE id = ?').get(userId) as any;
  
  const bootstrap = computeBootstrapScore({ ...bootstrapData, emailVerified: user.email_verified });

  // Layer 2: On-Chain
  const age = await fetchAccountAge(address);
  const txs = await fetchTxCount(address);
  const history = await fetchRepaymentHistory(address);

  let stellarScore = 0;
  const stellarBreakdown: any = {};

  // Age (0-10)
  const ageScore = age > 90 ? 10 : (age > 30 ? 7 : (age > 7 ? 3 : 0));
  stellarScore += ageScore;
  stellarBreakdown.accountAge = { score: ageScore, max: 10, label: `Account is ${age} days old` };

  // Txs (0-15)
  const txScore = txs > 50 ? 15 : (txs > 20 ? 10 : (txs > 5 ? 5 : 0));
  stellarScore += txScore;
  stellarBreakdown.txVolume = { score: txScore, max: 15, label: `${txs} transactions on record` };

  // Repayment (0-25)
  let repayScore = history.onTime * 15;
  repayScore = Math.min(repayScore, 25);
  if (history.defaults > 0) repayScore -= 20;
  repayScore = Math.max(repayScore, 0);
  stellarScore += repayScore;
  stellarBreakdown.repaymentHistory = { score: repayScore, max: 25, label: history.onTime > 0 ? `${history.onTime} loans repaid` : 'No history' };

  const totalScore = Math.min(100, bootstrap.score + stellarScore);
  
  let tier = 0;
  if (totalScore >= 70) tier = 2;
  else if (totalScore >= 40) tier = 1;

  return {
    totalScore,
    tier,
    bootstrapScore: bootstrap.score,
    stellarScore,
    breakdown: { ...bootstrap.breakdown, ...stellarBreakdown }
  };
}
