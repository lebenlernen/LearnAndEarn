#!/bin/bash

# SpaCy Installation für Apple Silicon (M1/M2/M3/M4) Mac
# Optimiert für 16GB RAM

echo "Installing SpaCy for Apple Silicon Mac..."

# Python virtual environment erstellen (falls noch nicht vorhanden)
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Virtual environment aktivieren
source venv/bin/activate

# Pip aktualisieren
pip install --upgrade pip setuptools wheel

# SpaCy mit Apple Silicon Optimierung installieren
pip install -U spacy[apple]

# Das mittlere deutsche Modell herunterladen
python -m spacy download de_core_news_md

# Optional: Zusätzliche Optimierungen für M4
export BLIS_ARCH=generic  # Für bessere Performance auf Apple Silicon

echo "Installation complete!"
echo "To use the model in Python:"
echo "import spacy"
echo "nlp = spacy.load('de_core_news_md')" 