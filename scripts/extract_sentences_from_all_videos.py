#!/usr/bin/env python3
"""
Extract sentences from all videos that have pure_subtitle content
This enables Lückentexte exercises for all videos with subtitles
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import re
import sys
from datetime import datetime

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 3143,
    'database': 'jetzt',
    'user': 'odoo',
    'password': 'odoo'
}

def split_into_sentences(text):
    """Split text into sentences using punctuation marks"""
    if not text:
        return []
    
    # Clean up the text
    text = text.strip()
    
    # Split by sentence-ending punctuation
    # This regex looks for periods, exclamation marks, or question marks 
    # followed by a space and capital letter, or at the end of text
    sentences = re.split(r'(?<=[.!?])\s+(?=[A-ZÄÖÜ])|(?<=[.!?])$', text)
    
    # Clean up sentences
    cleaned_sentences = []
    for sent in sentences:
        sent = sent.strip()
        # Only keep sentences with at least 3 words
        if sent and len(sent.split()) >= 3:
            cleaned_sentences.append(sent)
    
    return cleaned_sentences

def main():
    print("=== Video Sentence Extractor ===")
    print(f"Started at: {datetime.now()}")
    
    # Connect to database
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        print("✓ Connected to database")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        sys.exit(1)
    
    # Get count of videos with subtitles but no sentences
    cursor.execute("""
        SELECT COUNT(*) as count
        FROM our_videos v
        WHERE v.pure_subtitle IS NOT NULL 
        AND LENGTH(v.pure_subtitle) > 100
        AND v.video_id NOT IN (
            SELECT DISTINCT video_id FROM our_video_sentences
        )
    """)
    videos_to_process = cursor.fetchone()['count']
    print(f"\nVideos with subtitles but no sentences: {videos_to_process}")
    
    if videos_to_process == 0:
        print("✓ All videos with subtitles already have sentences extracted!")
        return
    
    # Process videos in batches
    batch_size = 10
    processed = 0
    total_sentences_created = 0
    errors = 0
    
    while True:
        # Get videos without sentences
        cursor.execute("""
            SELECT id, video_id, title, pure_subtitle
            FROM our_videos v
            WHERE v.pure_subtitle IS NOT NULL 
            AND LENGTH(v.pure_subtitle) > 100
            AND v.video_id NOT IN (
                SELECT DISTINCT video_id FROM our_video_sentences
            )
            ORDER BY v.id
            LIMIT %s
        """, (batch_size,))
        
        videos = cursor.fetchall()
        if not videos:
            break
        
        for video in videos:
            try:
                processed += 1
                print(f"\nProcessing video {processed}/{videos_to_process}: {video['title'][:60]}...")
                
                # Extract sentences from pure_subtitle
                if not video['pure_subtitle']:
                    print(f"  ⚠ No subtitle content found")
                    continue
                    
                sentences = split_into_sentences(video['pure_subtitle'])
                
                if sentences:
                    # Insert sentences
                    for idx, sentence in enumerate(sentences):
                        cursor.execute("""
                            INSERT INTO our_video_sentences 
                            (video_id, sentence, sentence_index, word_count, source)
                            VALUES (%s, %s, %s, %s, %s)
                        """, (
                            video['video_id'],
                            sentence,
                            idx,
                            len(sentence.split()),
                            'subtitle'
                        ))
                    
                    total_sentences_created += len(sentences)
                    print(f"  ✓ Created {len(sentences)} sentences")
                    
                    # Commit after each video
                    conn.commit()
                else:
                    print(f"  ⚠ No sentences extracted (subtitle too short or unclear)")
                    
            except Exception as e:
                errors += 1
                print(f"  ✗ Error: {e}")
                conn.rollback()
    
    # Final statistics
    print("\n=== Extraction Complete ===")
    print(f"Videos processed: {processed}")
    print(f"Total sentences created: {total_sentences_created}")
    print(f"Average sentences per video: {total_sentences_created / processed if processed > 0 else 0:.1f}")
    print(f"Errors: {errors}")
    
    # Show sample results
    print("\n=== Sample Results ===")
    cursor.execute("""
        SELECT v.title, COUNT(s.id) as sentence_count, 
               MIN(s.sentence) as first_sentence
        FROM our_videos v
        JOIN our_video_sentences s ON v.video_id = s.video_id
        WHERE s.source = 'subtitle'
        GROUP BY v.id, v.title
        ORDER BY v.id DESC
        LIMIT 5
    """)
    
    for row in cursor.fetchall():
        print(f"\n{row['title'][:60]}...")
        print(f"  Sentences: {row['sentence_count']}")
        print(f"  First: {row['first_sentence'][:80]}...")
    
    cursor.close()
    conn.close()
    print(f"\nFinished at: {datetime.now()}")
    
    print("\n⚡ Next step: Run batch_process_sentences_with_spacy.py to analyze these new sentences!")

if __name__ == "__main__":
    main()