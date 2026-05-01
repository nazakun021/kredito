import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/";
const apiOrigin = new URL(apiUrl).origin;

// P2-8: Read the RPC URL from env and add it to the CSP
const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || "https://soroban-testnet.stellar.org";
const rpcOrigin = new URL(rpcUrl).origin;

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=()" },
          {
            key: "Content-Security-Policy",
            value:
              `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' ${apiOrigin} ${rpcOrigin} https://*.stellar.org https://stellar.expert https://friendbot.stellar.org`,
          },
        ],
      },
    ];
  },
};

export default nextConfig;
