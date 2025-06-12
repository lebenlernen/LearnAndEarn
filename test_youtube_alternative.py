#!/usr/bin/env python3
"""Alternative YouTube transcript fetching with retry and fallback"""

import time
import json
from youtube_transcript_api import YouTubeTranscriptApi

def fetch_transcript_with_retry(video_id, language='de', max_retries=3):
    """Fetch transcript with retry logic and fallbacks"""
    
    for attempt in range(max_retries):
        try:
            print(f"Attempt {attempt + 1} of {max_retries}...")
            
            # Method 1: Direct fetch with language
            try:
                transcript = YouTubeTranscriptApi.get_transcript(video_id, languages=[language])
                print(f"✓ Success with direct fetch! Got {len(transcript)} entries")
                return transcript
            except:
                pass
            
            # Method 2: List and fetch manually
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            for t in transcript_list:
                if t.language_code.startswith(language):
                    try:
                        # Add a small delay before fetching
                        time.sleep(1)
                        transcript = t.fetch()
                        print(f"✓ Success with manual fetch! Got {len(transcript)} entries")
                        return transcript
                    except Exception as e:
                        print(f"  Failed to fetch {t.language_code}: {str(e)}")
                        continue
            
            # Method 3: Get any available transcript
            for t in transcript_list:
                try:
                    time.sleep(1)
                    transcript = t.fetch()
                    print(f"✓ Success with fallback! Got {len(transcript)} entries in {t.language_code}")
                    return transcript
                except:
                    continue
                    
        except Exception as e:
            print(f"  Attempt {attempt + 1} failed: {str(e)}")
            if attempt < max_retries - 1:
                print(f"  Waiting {2 ** attempt} seconds before retry...")
                time.sleep(2 ** attempt)
    
    return None

# Test with the problematic video
video_id = "MpEc0VAWnqA"
print(f"Testing video: {video_id}")
print("-" * 50)

transcript = fetch_transcript_with_retry(video_id)

if transcript:
    print("\nTranscript sample:")
    for i, entry in enumerate(transcript[:5]):
        print(f"{i+1}. [{entry['start']:.2f}s] {entry['text']}")
else:
    print("\n✗ Failed to fetch transcript after all attempts")
    
# Try a different video that's known to work
print("\n" + "=" * 50)
print("Testing with a different video (known to work)...")
print("-" * 50)

# This is a popular German educational video that should have good transcripts
test_video_id = "4-YSGfuNGfU"  # Example: Kurzgesagt video
transcript2 = fetch_transcript_with_retry(test_video_id)

if transcript2:
    print("\nTranscript sample:")
    for i, entry in enumerate(transcript2[:5]):
        print(f"{i+1}. [{entry['start']:.2f}s] {entry['text']}")