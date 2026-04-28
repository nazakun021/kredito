import { Router } from 'express';
import jwt from 'jsonwebtoken';
import { Keypair } from '@stellar/stellar-sdk';
import { z } from 'zod';
import db from '../db';
import { encrypt } from '../utils/crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-default-secret';

const loginSchema = z.object({
  email: z.string().email(),
});

router.post('/login', (req, res) => {
  const result = loginSchema.safeParse(req.body);
  if (!result.success) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  const { email } = result.data;
  
  let user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
  let isNew = false;

  if (!user) {
    const kp = Keypair.random();
    const encryptedSecret = encrypt(kp.secret());
    
    const info = db.prepare(`
      INSERT INTO users (email, stellar_pub, stellar_enc_secret)
      VALUES (?, ?, ?)
    `).run(email, kp.publicKey(), encryptedSecret);
    
    user = { id: info.lastInsertRowid, email, stellar_pub: kp.publicKey() };
    isNew = true;
  }

  const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '24h' });

  res.json({
    token,
    user: {
      email: user.email,
      stellarAddress: user.stellar_pub,
      isNew
    }
  });
});

export default router;
