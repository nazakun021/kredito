import { Router } from 'express';
import { Asset, Operation, StrKey, TransactionBuilder } from '@stellar/stellar-sdk';
import axios from 'axios';
import { authMiddleware, AuthRequest } from '../middleware/auth';
import { asyncRoute, badRequest } from '../errors';
import { horizonServer, networkPassphrase } from '../stellar/client';
import { toStroops } from '../scoring/engine';

const router = Router();

let cachedPhpPrice = 0;
let lastFetchTime = 0;
const CACHE_TTL = 60 * 1000;

async function getXlmPhpPrice() {
  const now = Date.now();
  if (now - lastFetchTime < CACHE_TTL && cachedPhpPrice > 0) {
    return cachedPhpPrice;
  }

  try {
    const response = await axios.get(
      'https://api.coingecko.com/api/v3/simple/price?ids=stellar&vs_currencies=php',
    );
    cachedPhpPrice = response.data.stellar.php;
    lastFetchTime = now;
    return cachedPhpPrice;
  } catch {
    return cachedPhpPrice || 7.0; // Fallback to a reasonable value (~7 PHP/XLM) if it fails
  }
}

router.get(
  '/balance',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const [account, phpPrice] = await Promise.all([
      horizonServer.loadAccount(wallet),
      getXlmPhpPrice(),
    ]);

    const nativeBalance = account.balances.find((b) => b.asset_type === 'native');
    const balanceXlm = nativeBalance?.balance || '0.0000000';

    res.json({
      xlmBalance: balanceXlm,
      xlmBalanceStroops: toStroops(Number(balanceXlm)).toString(),
      phpPrice,
      phpEquivalent: (Number(balanceXlm) * phpPrice).toFixed(2),
    });
  }),
);

router.get(
  '/transactions',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const wallet = req.wallet;
    const payments = await horizonServer
      .payments()
      .forAccount(wallet)
      .limit(20)
      .order('desc')
      .call();

    const formatted = payments.records.map((p: any) => ({
      id: p.id,
      type: p.type,
      from: p.from,
      to: p.to,
      amount: p.amount,
      asset: p.asset_type === 'native' ? 'XLM' : p.asset_code,
      timestamp: p.created_at,
      transactionHash: p.transaction_hash,
      isOutbound: p.from === wallet,
    }));

    res.json(formatted);
  }),
);

router.post(
  '/send',
  authMiddleware,
  asyncRoute(async (req: AuthRequest, res) => {
    const { destination, amount } = req.body;
    if (!destination || !amount) {
      throw badRequest('Destination and amount are required');
    }

    if (!StrKey.isValidEd25519PublicKey(destination)) {
      throw badRequest('Invalid destination address');
    }

    const wallet = req.wallet;
    const sourceAccount = await horizonServer.loadAccount(wallet);

    const tx = new TransactionBuilder(sourceAccount, {
      fee: '1000', // Stroops
      networkPassphrase,
    })
      .addOperation(
        Operation.payment({
          destination,
          asset: Asset.native(),
          amount: amount.toString(),
        }),
      )
      .setTimeout(60)
      .build();

    res.json({
      requiresSignature: true,
      unsignedXdr: tx.toXDR(),
    });
  }),
);

export default router;
