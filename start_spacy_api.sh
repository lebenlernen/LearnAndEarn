#!/bin/bash

# Start script for SpaCy API Server

echo "Starting SpaCy API Server for LearnAndEarn..."

# Check if virtual environment exists
if [ ! -d "spacy_venv" ]; then
    echo "Creating Python virtual environment..."
    python3 -m venv spacy_venv
fi

# Activate virtual environment
source spacy_venv/bin/activate

# Install requirements if needed
echo "Installing/checking requirements..."
pip install -r requirements_spacy.txt

# Download SpaCy model if not already installed
echo "Checking SpaCy German model..."
python -c "import spacy; spacy.load('de_core_news_md')" 2>/dev/null || {
    echo "Downloading German language model (medium)..."
    python -m spacy download de_core_news_md
}

# Start the API server
echo "Starting API server on http://localhost:8001"
python spacy_api_server.py