#!/usr/bin/env python3
"""
Enhanced SpaCy API Server with YouTube functionality
Now includes automatic sentence tokenization during video import
"""

# Import everything from the extended server
import sys
import os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from spacy_api_server_youtube import *

# Override the add_youtube_video endpoint to include sentence processing
@app.post("/youtube/add_enhanced")
async def add_youtube_video_enhanced(request: YouTubeAddRequest):
    """Add YouTube video to database with transcript AND process sentences with SpaCy"""
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
        
        # Get video info and transcript (same as original)
        video_url = f'https://www.youtube.com/watch?v={video_id}'
        response = requests.get(video_url, timeout=10)
        html = response.text
        
        # Extract metadata
        title_match = re.search(r'<meta name="title" content="([^"]+)"', html)
        if not title_match:
            title_match = re.search(r'<title>([^<]+)</title>', html)
        title = title_match.group(1) if title_match else 'Unknown Title'
        title = title.replace(' - YouTube', '').strip()
        
        channel_match = re.search(r'"author":"([^"]+)"', html)
        channel = channel_match.group(1) if channel_match else 'Unknown Channel'
        
        duration_match = re.search(r'"lengthSeconds":"(\d+)"', html)
        duration = int(duration_match.group(1)) if duration_match else None
        
        # Get transcript (same logic as original)
        full_transcript = ''
        sentences = []
        transcript_data = None
        
        # (Transcript fetching code same as original...)
        # Get transcript with YouTubeTranscriptApi or yt-dlp fallback
        try:
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            found_transcript = None
            
            for transcript in transcript_list:
                if transcript.language_code == language or transcript.language_code.startswith(language):
                    found_transcript = transcript
                    break
            
            if found_transcript:
                transcript_data = YouTubeTranscriptApi.get_transcript(
                    video_id,
                    languages=[found_transcript.language_code],
                    preserve_formatting=True
                )
                
        except Exception as e:
            # Try yt-dlp fallback
            transcript_data = fetch_transcript_with_ytdlp(video_id, language)
            if not transcript_data:
                raise HTTPException(status_code=400, detail="Could not get transcript")
        
        # Process transcript into sentences
        full_transcript = ' '.join([t['text'] for t in transcript_data])
        
        # Process sentences with timing
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
        
        # NOW INSERT SENTENCES AND PROCESS WITH SPACY
        print(f"Processing {len(sentences)} sentences with SpaCy...")
        
        for idx, sent_data in enumerate(sentences):
            # Insert sentence
            cursor.execute("""
                INSERT INTO our_video_sentences (
                    video_id, sentence, sentence_index, 
                    start_time, duration, word_count, source
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                video_id,
                sent_data['text'],
                idx,
                sent_data['start'],
                sent_data['duration'],
                len(sent_data['text'].split()),
                'transcript'
            ))
            
            sentence_id = cursor.fetchone()['id']
            
            # Process with SpaCy
            doc = nlp(sent_data['text'])
            
            # Store tokens
            for token in doc:
                if not token.is_space:  # Skip pure space tokens
                    cursor.execute("""
                        INSERT INTO our_video_sentence_tokens (
                            sentence_id, token_index, text, text_lower, 
                            lemma, pos, tag, dep, is_stop, is_punct
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """, (
                        sentence_id,
                        token.i,
                        token.text,
                        token.text.lower(),
                        token.lemma_,
                        token.pos_,
                        token.tag_,
                        token.dep_,
                        token.is_stop,
                        token.is_punct
                    ))
        
        # Also process vocabulary (original logic)
        word_freq = Counter()
        word_data = {}
        
        doc_full = nlp(full_transcript)
        for token in doc_full:
            if not token.is_punct and not token.is_space:
                word_lower = token.text.lower()
                word_freq[word_lower] += 1
                
                if word_lower not in word_data:
                    word_data[word_lower] = {
                        'original': token.text,
                        'lemma': token.lemma_,
                        'pos': token.pos_,
                        'tag': token.tag_,
                        'is_stop': token.is_stop,
                        'has_vector': token.has_vector,
                        'vector_norm': float(token.vector_norm) if token.has_vector else 0.0
                    }
        
        # Store vocabulary
        for word, freq in word_freq.items():
            data = word_data[word]
            cursor.execute("""
                INSERT INTO our_videos_base_words 
                (video_id, original_word, lemma, pos, tag, is_stop_word, has_vector, vector_norm, frequency, language_target)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (video_id, original_word) 
                DO UPDATE SET frequency = EXCLUDED.frequency
            """, (
                video_id,
                data['original'],
                data['lemma'],
                data['pos'],
                data['tag'],
                data['is_stop'],
                data['has_vector'],
                data['vector_norm'],
                freq,
                language
            ))
        
        conn.commit()
        
        # Get statistics
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT t.pos) as pos_types,
                COUNT(CASE WHEN t.pos = 'VERB' THEN 1 END) as verb_count,
                COUNT(CASE WHEN t.pos = 'NOUN' THEN 1 END) as noun_count,
                COUNT(CASE WHEN t.pos IN ('DET', 'ART') THEN 1 END) as article_count
            FROM our_video_sentence_tokens t
            JOIN our_video_sentences s ON t.sentence_id = s.id
            WHERE s.video_id = %s
        """, (video_id,))
        
        stats = cursor.fetchone()
        
        return {
            "success": True,
            "videoId": new_video_id,
            "message": "Video successfully added with SpaCy analysis",
            "statistics": {
                "sentenceCount": len(sentences),
                "wordCount": sum(word_freq.values()),
                "uniqueWords": len(word_data),
                "verbTokens": stats['verb_count'],
                "nounTokens": stats['noun_count'],
                "articleTokens": stats['article_count']
            }
        }
        
    except HTTPException:
        if conn:
            conn.rollback()
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if conn:
            conn.close()

# Endpoint to check sentence token coverage
@app.get("/sentences/token-coverage")
async def check_token_coverage():
    """Check how many sentences have been processed with SpaCy"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Total sentences
        cursor.execute("SELECT COUNT(*) as total FROM our_video_sentences")
        total = cursor.fetchone()['total']
        
        # Processed sentences
        cursor.execute("""
            SELECT COUNT(DISTINCT sentence_id) as processed 
            FROM our_video_sentence_tokens
        """)
        processed = cursor.fetchone()['processed']
        
        # Sample of unprocessed
        cursor.execute("""
            SELECT s.id, s.sentence, v.title
            FROM our_video_sentences s
            JOIN our_videos v ON s.video_id = v.video_id
            WHERE s.id NOT IN (
                SELECT DISTINCT sentence_id FROM our_video_sentence_tokens
            )
            LIMIT 5
        """)
        unprocessed_sample = cursor.fetchall()
        
        return {
            "total_sentences": total,
            "processed_sentences": processed,
            "coverage_percentage": round(processed * 100 / total if total > 0 else 0, 2),
            "unprocessed_count": total - processed,
            "unprocessed_sample": unprocessed_sample
        }
        
    finally:
        cursor.close()
        conn.close()

if __name__ == "__main__":
    import uvicorn
    print("Starting Enhanced SpaCy API Server with automatic sentence processing...")
    uvicorn.run(app, host="0.0.0.0", port=8001)