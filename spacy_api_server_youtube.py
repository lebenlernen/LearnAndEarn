#!/usr/bin/env python3
"""
Extended SpaCy API Server with YouTube functionality
"""

# Import everything from the original server
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Import original functionality
from spacy_api_server import *

# Additional imports for YouTube
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
import requests
import re
from typing import Optional
import subprocess
import json
import tempfile
import os
import webvtt

# YouTube-related models
class YouTubePreviewRequest(BaseModel):
    video_id: str
    url: Optional[str] = None

class YouTubeAddRequest(BaseModel):
    video_id: str
    language: str = 'de'

# Helper function to fetch transcript using yt-dlp
def fetch_transcript_with_ytdlp(video_id, language='de'):
    """Fallback method using yt-dlp when youtube-transcript-api fails"""
    with tempfile.TemporaryDirectory() as tmpdir:
        try:
            # Run yt-dlp to download subtitles
            cmd = [
                'yt-dlp',
                '--write-auto-sub',
                '--sub-lang', language,
                '--skip-download',
                '--output', os.path.join(tmpdir, '%(title)s.%(ext)s'),
                f'https://www.youtube.com/watch?v={video_id}'
            ]
            
            result = subprocess.run(cmd, capture_output=True, text=True, cwd=tmpdir)
            
            if result.returncode != 0:
                print(f"yt-dlp error: {result.stderr}")
                return None
            
            # Find the VTT file
            vtt_files = [f for f in os.listdir(tmpdir) if f.endswith('.vtt')]
            if not vtt_files:
                print("No VTT file found")
                return None
            
            vtt_path = os.path.join(tmpdir, vtt_files[0])
            
            # Parse VTT file
            entries = []
            vtt = webvtt.read(vtt_path)
            
            for caption in vtt:
                # Clean text
                text = re.sub(r'<[^>]+>', '', caption.text)
                text = re.sub(r'\s+', ' ', text).strip()
                
                if text and text != ' ':
                    entries.append({
                        'text': text,
                        'start': caption.start_in_seconds,
                        'duration': caption.end_in_seconds - caption.start_in_seconds
                    })
            
            return entries
            
        except Exception as e:
            print(f"yt-dlp processing error: {e}")
            return None

# Add YouTube endpoints
@app.post("/youtube/preview")
async def preview_youtube_video(request: YouTubePreviewRequest):
    """Preview YouTube video and get transcript options"""
    try:
        video_id = request.video_id
        
        # Get basic video info from YouTube page
        video_url = f'https://www.youtube.com/watch?v={video_id}'
        
        try:
            response = requests.get(video_url, timeout=10)
            html = response.text
            
            # Extract title
            title_match = re.search(r'<meta name="title" content="([^"]+)"', html)
            if not title_match:
                title_match = re.search(r'<title>([^<]+)</title>', html)
            title = title_match.group(1) if title_match else 'Unknown Title'
            title = title.replace(' - YouTube', '').strip()
            
            # Extract channel name
            channel_match = re.search(r'"author":"([^"]+)"', html)
            channel = channel_match.group(1) if channel_match else 'Unknown Channel'
            
            # Extract duration (in seconds)
            duration_match = re.search(r'"lengthSeconds":"(\d+)"', html)
            if duration_match:
                duration_seconds = int(duration_match.group(1))
                duration = f'{duration_seconds // 60}:{duration_seconds % 60:02d}'
            else:
                duration = 'Unknown'
                
            # Extract description
            desc_match = re.search(r'<meta name="description" content="([^"]+)"', html)
            description = desc_match.group(1)[:500] if desc_match else ''
            
        except Exception as e:
            print(f"Error fetching video info: {e}")
            title = 'Unknown Title'
            channel = 'Unknown Channel'
            duration = 'Unknown'
            description = ''
        
        video_info = {
            'videoId': video_id,
            'title': title,
            'channel': channel,
            'duration': duration,
            'description': description
        }
        
        # Get available transcripts
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            transcripts = []
            
            for transcript in transcript_list:
                transcripts.append({
                    'language': transcript.language,
                    'language_code': transcript.language_code,
                    'is_generated': transcript.is_generated,
                    'is_translatable': transcript.is_translatable
                })
            
            # Try to get German transcript first, then any available
            transcript_text = ''
            try:
                # Try German first
                transcript_data = YouTubeTranscriptApi.get_transcript(video_id, languages=['de'])
                transcript_text = ' '.join([t['text'] for t in transcript_data])
            except:
                # Get any available transcript
                try:
                    transcript_data = YouTubeTranscriptApi.get_transcript(video_id)
                    transcript_text = ' '.join([t['text'] for t in transcript_data])
                except:
                    pass
            
            video_info['transcripts'] = transcripts
            video_info['transcript'] = transcript_text[:500] + '...' if len(transcript_text) > 500 else transcript_text
            
        except (TranscriptsDisabled, NoTranscriptFound):
            video_info['transcripts'] = []
            video_info['transcript'] = None
        
        # Check if video already exists in database
        conn = get_db_connection()
        cursor = conn.cursor()
        try:
            cursor.execute("SELECT id FROM our_videos WHERE video_id = %s", (video_id,))
            video_exists = cursor.fetchone() is not None
            video_info['videoExists'] = video_exists
        finally:
            cursor.close()
            conn.close()
        
        return video_info
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/youtube/add")
async def add_youtube_video(request: YouTubeAddRequest):
    """Add YouTube video to database with transcript"""
    conn = None
    try:
        video_id = request.video_id
        language = request.language
        
        # Get database connection
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if video already exists
        cursor.execute("SELECT id FROM our_videos WHERE video_id = %s", (video_id,))
        if cursor.fetchone():
            raise HTTPException(status_code=409, detail="Video already exists")
        
        # Get video info from YouTube
        video_url = f'https://www.youtube.com/watch?v={video_id}'
        response = requests.get(video_url, timeout=10)
        html = response.text
        
        # Extract title
        title_match = re.search(r'<meta name="title" content="([^"]+)"', html)
        if not title_match:
            title_match = re.search(r'<title>([^<]+)</title>', html)
        title = title_match.group(1) if title_match else 'Unknown Title'
        title = title.replace(' - YouTube', '').strip()
        
        # Extract channel
        channel_match = re.search(r'"author":"([^"]+)"', html)
        channel = channel_match.group(1) if channel_match else 'Unknown Channel'
        
        # Extract duration
        duration_match = re.search(r'"lengthSeconds":"(\d+)"', html)
        duration = int(duration_match.group(1)) if duration_match else None
        
        # Get transcript with better error handling
        full_transcript = ''
        sentences = []
        transcript_data = None
        
        try:
            # First, list all available transcripts to see what's available
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            
            # Try to find a transcript that matches our language preference
            found_transcript = None
            
            # First try exact match
            for transcript in transcript_list:
                if transcript.language_code == language:
                    found_transcript = transcript
                    break
            
            # If no exact match, try language prefix match (e.g., 'de' matches 'de-DE')
            if not found_transcript:
                for transcript in transcript_list:
                    if transcript.language_code.startswith(language):
                        found_transcript = transcript
                        language = transcript.language_code  # Update to actual code
                        break
            
            # If still no match, try to find any German transcript
            if not found_transcript and language == 'de':
                for transcript in transcript_list:
                    if transcript.language_code.startswith('de'):
                        found_transcript = transcript
                        language = transcript.language_code
                        break
            
            # If still no match, get the first available transcript
            if not found_transcript:
                for transcript in transcript_list:
                    found_transcript = transcript
                    language = transcript.language_code
                    break
            
            if found_transcript:
                try:
                    print(f"Attempting to fetch transcript for {found_transcript.language_code}...")
                    # Use preserve_formatting=True as suggested
                    transcript_data = YouTubeTranscriptApi.get_transcript(
                        video_id,
                        languages=[found_transcript.language_code],
                        preserve_formatting=True
                    )
                    print(f"Successfully fetched {len(transcript_data)} transcript entries")
                except Exception as fetch_error:
                    # Handle XML parsing errors and other fetch issues
                    error_msg = str(fetch_error).lower()
                    print(f"Transcript fetch error: {fetch_error}")
                    if 'no element found' in error_msg or 'xml' in error_msg:
                        # This is a known issue with YouTube's auto-generated transcripts
                        # Try yt-dlp as fallback
                        print(f"YouTube XML error for video {video_id}, attempting yt-dlp fallback...")
                        try:
                            transcript_data = fetch_transcript_with_ytdlp(video_id, language)
                            if transcript_data:
                                print(f"Successfully fetched {len(transcript_data)} entries with yt-dlp")
                            else:
                                raise Exception("yt-dlp returned no data")
                        except Exception as ytdlp_error:
                            print(f"yt-dlp also failed: {ytdlp_error}")
                            raise HTTPException(
                                status_code=400, 
                                detail=f"YouTube returned invalid transcript data for video {video_id}. Both youtube-transcript-api and yt-dlp failed. Please try a different video."
                            )
                    else:
                        raise HTTPException(status_code=400, detail=f"Could not fetch transcript: {str(fetch_error)}")
            else:
                raise HTTPException(status_code=400, detail=f"No transcripts available for video {video_id}")
                
        except HTTPException:
            raise  # Re-raise HTTPExceptions as-is
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Could not get transcript: {str(e)}")
        
        # Process transcript data
        full_transcript = ' '.join([t['text'] for t in transcript_data])
        
        # Process sentences
        current_sentence = ''
        current_start = 0
        last_entry = None
        
        for entry in transcript_data:
            text = entry['text'].strip()
            if not current_sentence:
                current_start = entry['start']
            
            current_sentence += ' ' + text
            last_entry = entry
            
            # Check for sentence end
            if any(text.endswith(p) for p in ['.', '!', '?', '...']) or len(current_sentence) > 150:
                sentences.append({
                    'text': current_sentence.strip(),
                    'start': current_start,
                    'duration': entry['start'] + entry.get('duration', 0) - current_start
                })
                current_sentence = ''
        
        # Add any remaining text
        if current_sentence and last_entry:
            sentences.append({
                'text': current_sentence.strip(),
                'start': current_start,
                'duration': last_entry['start'] + last_entry.get('duration', 0) - current_start
            })
        
        # Insert video into database
        cursor.execute("""
            INSERT INTO our_videos (
                video_id, title, pure_subtitle, 
                language_target, channel, duration,
                sub_manual
            ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            video_id,
            title,
            full_transcript,
            language,
            channel,
            duration,
            2  # Manual subtitles
        ))
        
        new_video_id = cursor.fetchone()['id']
        
        # Skip inserting sentences for now - table structure needs to be fixed
        # TODO: Create proper our_video_sentences table with timing columns
        
        conn.commit()
        
        return {
            "success": True,
            "videoId": new_video_id,
            "message": "Video successfully added",
            "sentenceCount": len(sentences)
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

# Run the extended server
if __name__ == "__main__":
    import uvicorn
    print("Starting SpaCy API Server with YouTube functionality...")
    uvicorn.run(app, host="0.0.0.0", port=8001)