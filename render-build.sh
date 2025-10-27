#!/usr/bin/env bash
set -e

echo "Building frontend..."
cd frontend
npm install
npm run build
cd ..

echo "Installing backend dependencies..."
npm install

echo "Build complete!"