#!/bin/bash
set -e

echo "Installing root dependencies..."
npm install

echo "Building Expo web app..."
npx expo export --platform web

echo "Installing server dependencies..."
cd server
npm install

echo "Building server..."
npm run build

echo "Build complete!"
