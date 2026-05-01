#!/bin/bash

# Kredito Setup Script
# Copies .env.example files and installs dependencies.

set -e

echo "🚀 Setting up Kredito monorepo..."

# Check pnpm
if ! command -v pnpm &>/dev/null; then
  echo "❌ pnpm not found. Install it: npm i -g pnpm@10.32.1"
  exit 1
fi

REQUIRED_PNPM="10.32.1"
INSTALLED_PNPM=$(pnpm --version)
if [ "$INSTALLED_PNPM" != "$REQUIRED_PNPM" ]; then
  echo "⚠️  pnpm $INSTALLED_PNPM found, expected $REQUIRED_PNPM"
  echo "   Run: npm i -g pnpm@$REQUIRED_PNPM"
fi

# Backend Setup
echo "📦 Setting up Backend..."
if [ ! -f backend/.env ]; then
  cp backend/.env.example backend/.env
  echo "✅ Created backend/.env (please edit with your secrets)"
else
  echo "ℹ️ backend/.env already exists"
fi

cd backend
pnpm install
cd ..

# Frontend Setup
echo "📦 Setting up Frontend..."
if [ ! -f frontend/.env ]; then
  if [ -f frontend/.env.example ]; then
    cp frontend/.env.example frontend/.env
    echo "✅ Created frontend/.env"
  else
    echo "⚠️ frontend/.env.example not found"
  fi
else
  echo "ℹ️ frontend/.env already exists"
fi

cd frontend
pnpm install
cd ..

echo "✨ Setup complete! You can now run 'pnpm dev' in both backend/ and frontend/ directories."
