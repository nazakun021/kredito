#!/bin/bash

# Kredito Setup Script
# Copies .env.example files and installs dependencies.

set -e

echo "🚀 Setting up Kredito monorepo..."

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
