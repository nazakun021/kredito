# Setup Guide: Kredito

Follow these instructions to set up the Kredito project locally for development.

## 1. Prerequisites

Ensure you have the following installed on your machine:

- **Node.js**: v20.0.0 or higher
- **pnpm**: v10.0.0 or higher (`npm install -g pnpm`)
- **Rust**: Latest stable version ([Install Rust](https://www.rust-lang.org/tools/install))
- **Stellar CLI**: For interacting with the Soroban network ([Install Stellar CLI](https://developers.stellar.org/docs/build/smart-contracts/getting-started/setup#install-the-stellar-cli))
  - Ensure you add the WASM target: `rustup target add wasm32-unknown-unknown`

---

## 2. Smart Contracts Setup

1. **Navigate to the contracts directory**:
   ```bash
   cd contracts
   ```

2. **Build the contracts**:
   This compiles the Rust code into WASM binaries.
   ```bash
   stellar contract build
   ```

3. **Deploy to Testnet (Optional)**:
   If you wish to deploy your own instances of the contracts:
   - Configure a Stellar identity: `stellar keys generate --global issuer --network testnet`
   - Run the deployment script:
     ```bash
     ./deploy.sh
     ```
   *Note: The project is pre-configured to use existing Testnet addresses found in the main README.md.*

---

## 3. Backend Setup

1. **Navigate to the backend directory**:
   ```bash
   cd backend
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file and fill in the values:
   ```bash
   cp .env.example .env
   ```
   **Required Variables**:
   - `JWT_SECRET`: Any random string for session tokens.
   - `ENCRYPTION_KEY`: A 32-byte hex string (used to encrypt user keys in SQLite).
   - `RESEND_API_KEY`: Get one from [Resend](https://resend.com) for Email OTP.
   - `ISSUER_SECRET_KEY`: A Stellar Secret Key (starting with 'S') to fund fee-bumps.
   - `PHPC_ID`, `REGISTRY_ID`, `LENDING_POOL_ID`: The contract addresses (see README.md).

4. **Start the Backend**:
   ```bash
   pnpm dev
   ```
   The server will start at `http://localhost:3001`. The SQLite database (`database.sqlite`) will be created automatically on first run.

---

## 4. Frontend Setup

1. **Navigate to the frontend directory**:
   ```bash
   cd frontend
   ```

2. **Install dependencies**:
   ```bash
   pnpm install
   ```

3. **Configure Environment Variables**:
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   Ensure `NEXT_PUBLIC_API_URL` points to your backend (default: `http://localhost:3001`).

4. **Start the Frontend**:
   ```bash
   pnpm dev
   ```
   The application will be available at `http://localhost:3000`.

---

## 5. Verification

1. Open `http://localhost:3000` in your browser.
2. Try signing in with an email. 
3. Check the backend logs to ensure the OTP was "sent" (or check your Resend dashboard).
4. Verify that the `backend/database.sqlite` file has been created.
