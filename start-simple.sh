#!/bin/bash

# Simple start script for LearnAndEarn - Node.js only
# Use this if you don't need SpaCy features

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Starting LearnAndEarn (Simple Mode)${NC}"

# Check if port 3000 is in use
if lsof -Pi :3000 -sTCP:LISTEN -t >/dev/null ; then
    echo -e "${YELLOW}Port 3000 is already in use${NC}"
    echo "Killing existing process..."
    kill -9 $(lsof -ti:3000)
    sleep 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${GREEN}Installing dependencies...${NC}"
    npm install
fi

# Start the application
echo -e "${GREEN}Starting Node.js server on http://localhost:3000${NC}"
npm start