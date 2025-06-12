#!/usr/bin/env python3
"""Test YouTube transcript fetching"""

from youtube_transcript_api import YouTubeTranscriptApi

video_id = "MpEc0VAWnqA"

try:
    # List all available transcripts
    transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
    
    print(f"Available transcripts for video {video_id}:")
    for transcript in transcript_list:
        print(f"- Language: {transcript.language} (code: {transcript.language_code})")
        print(f"  Generated: {transcript.is_generated}, Translatable: {transcript.is_translatable}")
    
    # Try to fetch transcript
    print("\nAttempting to fetch transcript...")
    
    # Method 1: Get any available transcript
    try:
        transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
        print(f"✓ Method 1 worked: Got {len(transcript_data)} entries")
    except Exception as e:
        print(f"✗ Method 1 failed: {e}")
    
    # Method 2: Get German transcript
    try:
        transcript_data = YouTubeTranscriptApi.get_transcript(video_id, languages=['de'])
        print(f"✓ Method 2 worked: Got {len(transcript_data)} entries with 'de'")
    except Exception as e:
        print(f"✗ Method 2 failed with 'de': {e}")
    
    # Method 3: Try different German codes
    for lang_code in ['de', 'de-DE', 'de-AT', 'de-CH']:
        try:
            transcript_data = YouTubeTranscriptApi.get_transcript(video_id, languages=[lang_code])
            print(f"✓ Method 3 worked: Got transcript with '{lang_code}'")
            break
        except:
            continue
    else:
        print("✗ Method 3 failed: No German variant worked")
    
    # Method 4: Get first available transcript manually
    for transcript in transcript_list:
        try:
            transcript_data = transcript.fetch()
            print(f"✓ Method 4 worked: Got transcript in {transcript.language_code}")
            print(f"  First 200 chars: {' '.join([t['text'] for t in transcript_data[:5]])}")
            break
        except Exception as e:
            print(f"✗ Failed to fetch {transcript.language_code}: {e}")
            
except Exception as e:
    print(f"Error: {e}")