#!/bin/bash

# Install LearnAndEarn services on macOS using launchd

echo "Installing LearnAndEarn services..."

# Create logs directory if it doesn't exist
mkdir -p logs

# Copy plist files to LaunchAgents
cp launchd/com.learnandearn.node.plist ~/Library/LaunchAgents/
cp launchd/com.learnandearn.spacy.plist ~/Library/LaunchAgents/

# Load the services
launchctl load ~/Library/LaunchAgents/com.learnandearn.node.plist
launchctl load ~/Library/LaunchAgents/com.learnandearn.spacy.plist

echo "Services installed and started!"
echo ""
echo "To check status:"
echo "  launchctl list | grep learnandearn"
echo ""
echo "To stop services:"
echo "  launchctl unload ~/Library/LaunchAgents/com.learnandearn.node.plist"
echo "  launchctl unload ~/Library/LaunchAgents/com.learnandearn.spacy.plist"
echo ""
echo "To remove services:"
echo "  launchctl unload ~/Library/LaunchAgents/com.learnandearn.node.plist"
echo "  launchctl unload ~/Library/LaunchAgents/com.learnandearn.spacy.plist"
echo "  rm ~/Library/LaunchAgents/com.learnandearn.*.plist"
echo ""
echo "Logs are in: $(pwd)/logs/"