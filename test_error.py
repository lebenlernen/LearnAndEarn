#!/usr/bin/env python3
try:
    print("Testing Python...")
    import sys
    print(f"Python version: {sys.version}")
    print(f"Python path: {sys.executable}")
    
    print("\nTrying to import modules...")
    import fastapi
    print("✓ FastAPI imported")
    
    import spacy
    print("✓ SpaCy imported")
    
    import youtube_transcript_api
    print("✓ youtube_transcript_api imported")
    
    import webvtt
    print("✓ webvtt imported")
    
    import yt_dlp
    print("✓ yt_dlp imported")
    
except Exception as e:
    print(f"Error: {e}")
    import traceback
    traceback.print_exc()