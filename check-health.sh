#!/bin/bash

# Health check script for LearnAndEarn servers

echo "LearnAndEarn Health Check"
echo "========================"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check Node.js server
echo -n "Node.js Server (port 3000): "
if curl -s http://localhost:3000/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not responding${NC}"
fi

# Check SpaCy server
echo -n "SpaCy API Server (port 8001): "
if curl -s http://localhost:8001/health > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not responding${NC}"
fi

# Check PostgreSQL
echo -n "PostgreSQL Database (port 3143): "
if pg_isready -h localhost -p 3143 > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Running${NC}"
else
    echo -e "${RED}❌ Not responding${NC}"
fi

echo ""

# Check LaunchD services if installed
if launchctl list | grep -q learnandearn; then
    echo "LaunchD Services Status:"
    echo "------------------------"
    launchctl list | grep learnandearn
else
    echo "LaunchD services not installed. Run ./install-services.sh to install."
fi

echo ""
echo "For detailed logs, check:"
echo "  Node.js: logs/node.log"
echo "  SpaCy: logs/spacy.log"