# Kredito Frontend

This is a Next.js dashboard for the Kredito micro-lending demo.

## Overview

The frontend is designed to be a high-trust, low-friction interface for the on-chain "Credit Passport". It focuses on making complex blockchain state (metrics, scores, tiers) legible and actionable for the user.

- **Stack:** Next.js (App Router), TypeScript, Tailwind CSS.
- **State:** Zustand for persistent auth sessions.
- **Data:** TanStack Query for real-time API and contract state.
- **Icons:** Lucide React.

## Getting Started

1.  **Install dependencies:**
    ```bash
    pnpm install
    ```

2.  **Configure environment:**
    The frontend communicates with the Kredito backend. Ensure your backend is running at `http://localhost:3001` or update the API URL.

3.  **Run the development server:**
    ```bash
    pnpm dev
    ```

4.  **Open the dashboard:**
    Navigate to [http://localhost:3000](http://localhost:3000).

## Main Documentation

For the full project architecture, setup guide, and technical specification, please refer to the root [README.md](../README.md) and the [docs/](../docs/) directory.
