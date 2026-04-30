export interface DbUser {
  id: number;
  stellar_pub: string;
  stellar_enc_secret: string | null;
  is_external: number;
}

export interface UserWalletRow {
  id: number;
  stellar_pub: string;
}

export interface ActiveLoanRow {
  id: number;
  user_id: number;
  stellar_pub: string;
}
