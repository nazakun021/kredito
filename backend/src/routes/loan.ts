import { Router } from 'express';
import { Keypair, nativeToScVal, Address } from '@stellar/stellar-sdk';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import db from '../db';
import { decrypt } from '../utils/crypto';
import { buildAndSubmitFeeBump } from '../stellar/feebump';
import { queryContract } from '../stellar/query';
import { contractIds, rpcServer } from '../stellar/client';

const router = Router();

router.post('/borrow', authMiddleware, async (req: AuthRequest, res) => {
  const { amount } = req.body; // in PHPC units
  if (!amount || amount <= 0) {
    return res.status(400).json({ error: 'Invalid amount' });
  }

  const user = db.prepare('SELECT stellar_pub, stellar_enc_secret FROM users WHERE id = ?').get(req.userId) as any;
  const userSecret = decrypt(user.stellar_enc_secret);
  const userKeypair = Keypair.fromSecret(userSecret);

  try {
    const stroops = BigInt(Math.floor(amount * 10_000_000));
    const txHash = await buildAndSubmitFeeBump(
      userKeypair,
      contractIds.lendingPool,
      'borrow',
      [
        Address.fromString(user.stellar_pub).toScVal(),
        nativeToScVal(stroops, { type: 'i128' }),
      ]
    );

    // Update DB cache
    db.prepare('INSERT INTO active_loans (user_id, stellar_pub) VALUES (?, ?)').run(req.userId, user.stellar_pub);

    res.json({
      txHash,
      amount: amount.toFixed(2),
      fee: (amount * 0.05).toFixed(2),
      totalOwed: (amount * 1.05).toFixed(2),
      dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/repay', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare('SELECT stellar_pub, stellar_enc_secret FROM users WHERE id = ?').get(req.userId) as any;
  const userSecret = decrypt(user.stellar_enc_secret);
  const userKeypair = Keypair.fromSecret(userSecret);

  try {
    // 1. Get loan details to know total_owed
    const loan = await queryContract(
      contractIds.lendingPool,
      'get_loan',
      [Address.fromString(user.stellar_pub).toScVal()]
    );

    if (!loan) {
      return res.status(400).json({ error: 'No active loan found' });
    }

    if (loan.repaid) {
      return res.status(400).json({ error: 'Loan already repaid' });
    }

    const totalOwedStroops = loan.principal + loan.fee;

    // 2. Approve PHPC transfer
    await buildAndSubmitFeeBump(
      userKeypair,
      contractIds.phpcToken,
      'approve',
      [
        Address.fromString(user.stellar_pub).toScVal(),
        Address.fromString(contractIds.lendingPool).toScVal(),
        nativeToScVal(totalOwedStroops, { type: 'i128' }),
        nativeToScVal(1000000, { type: 'u32' }), // expiration
      ]
    );

    // 3. Repay
    const txHash = await buildAndSubmitFeeBump(
      userKeypair,
      contractIds.lendingPool,
      'repay',
      [Address.fromString(user.stellar_pub).toScVal()]
    );

    // Update DB cache
    db.prepare('DELETE FROM active_loans WHERE user_id = ?').run(req.userId);

    res.json({
      txHash,
      amountRepaid: (Number(totalOwedStroops) / 10_000_000).toFixed(2),
      explorerUrl: `https://stellar.expert/explorer/testnet/tx/${txHash}`
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/status', authMiddleware, async (req: AuthRequest, res) => {
  const user = db.prepare('SELECT stellar_pub FROM users WHERE id = ?').get(req.userId) as any;
  
  try {
    const loan = await queryContract(
      contractIds.lendingPool,
      'get_loan',
      [Address.fromString(user.stellar_pub).toScVal()]
    );

    if (!loan) {
      return res.json({ hasActiveLoan: false, loan: null });
    }

    const latestLedger = await rpcServer.getLatestLedger();
    const currentLedger = latestLedger.sequence;

    let status = 'active';
    if (loan.repaid) status = 'repaid';
    else if (loan.defaulted) status = 'defaulted';
    else if (currentLedger > loan.due_ledger) status = 'overdue';

    res.json({
      hasActiveLoan: !loan.repaid && !loan.defaulted,
      loan: {
        principal: (Number(loan.principal) / 10_000_000).toFixed(2),
        fee: (Number(loan.fee) / 10_000_000).toFixed(2),
        totalOwed: ((Number(loan.principal) + Number(loan.fee)) / 10_000_000).toFixed(2),
        dueLedger: loan.due_ledger,
        currentLedger: currentLedger,
        status: status
      }
    });
  } catch (error) {
    res.json({ hasActiveLoan: false, loan: null });
  }
});

export default router;

