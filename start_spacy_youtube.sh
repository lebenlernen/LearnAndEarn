#!/bin/bash
# Start the SpaCy YouTube API server

cd /Users/thomassee/Docker/containers/LearnAndEarn

# Kill any existing instance
pkill -f spacy_api_server_youtube.py

# Start the server
echo "Starting SpaCy YouTube API server on port 8001..."
nohup python3 spacy_api_server_youtube.py > spacy_api.log 2>&1 &

# Wait a moment and check if it started
sleep 2
if pgrep -f spacy_api_server_youtube.py > /dev/null; then
    echo "✓ SpaCy YouTube server started successfully"
    echo "Server logs: tail -f spacy_api.log"
else
    echo "✗ Failed to start SpaCy YouTube server"
    echo "Check logs: cat spacy_api.log"
    exit 1
fi