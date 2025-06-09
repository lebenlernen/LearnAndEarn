#!/usr/bin/env python3
"""
Process vocabulary for ALL videos in the database using SpaCy
This script runs through all videos with word lists and imports them into our_videos_base_words
"""

import spacy
import psycopg2
from psycopg2.extras import RealDictCursor, execute_batch
import os
from dotenv import load_dotenv
from collections import Counter
import time
import sys

# Load environment variables
load_dotenv()

# Load SpaCy model
print("Loading SpaCy model...")
start_time = time.time()
nlp = spacy.load("de_core_news_lg")
print(f"✓ Model loaded in {time.time() - start_time:.2f} seconds\n")

def connect_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', 3143),
        database=os.getenv('DB_NAME', 'jetzt'),
        user=os.getenv('DB_USER', 'odoo'),
        password=os.getenv('DB_PASSWORD')
    )

def process_word_list(word_string):
    """Process comma-separated word list with SpaCy"""
    if not word_string:
        return []
    
    # Split by comma and clean
    words = [w.strip() for w in word_string.split(',') if w.strip()]
    
    processed_words = []
    
    for word in words:
        # Process with SpaCy
        doc = nlp(word)
        
        for token in doc:
            if not token.is_punct and not token.is_space:
                word_info = {
                    'original': token.text,
                    'lemma': token.lemma_,
                    'pos': token.pos_,
                    'tag': token.tag_,
                    'is_stop': token.is_stop,
                    'has_vector': token.has_vector,
                    'vector_norm': float(token.vector_norm) if token.has_vector else 0.0
                }
                processed_words.append(word_info)
    
    return processed_words

def process_video(conn, video_id, words, title):
    """Process and import vocabulary for a single video"""
    try:
        # Process words with SpaCy
        processed = process_word_list(words)
        
        if not processed:
            return False
        
        # Count word frequencies
        word_freq = Counter()
        for word in processed:
            word_freq[word['original']] += 1
        
        # Prepare data for batch insert
        insert_data = []
        seen_words = set()
        
        for word in processed:
            original = word['original']
            
            # Skip if we've already processed this word
            if original in seen_words:
                continue
            seen_words.add(original)
            
            insert_data.append((
                video_id,
                original,
                word['lemma'],
                word['pos'],
                word['tag'],
                word['is_stop'],
                word['has_vector'],
                word['vector_norm'],
                word_freq[original]
            ))
        
        # Insert into database
        cur = conn.cursor()
        try:
            # Delete existing entries for this video
            cur.execute("DELETE FROM our_videos_base_words WHERE video_id = %s", (video_id,))
            
            # Batch insert new data
            insert_query = """
                INSERT INTO our_videos_base_words 
                (video_id, original_word, lemma, pos, tag, is_stop_word, has_vector, vector_norm, frequency)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            execute_batch(cur, insert_query, insert_data, page_size=100)
            
            conn.commit()
            return len(insert_data)
            
        except Exception as e:
            print(f"   ❌ Error inserting data: {e}")
            conn.rollback()
            return False
        finally:
            cur.close()
            
    except Exception as e:
        print(f"   ❌ Error processing video: {e}")
        return False

def main():
    """Main function to process all videos"""
    print("🚀 Processing ALL Videos Vocabulary")
    print("===================================")
    
    conn = connect_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Count total videos with word lists
        cur.execute("""
            SELECT COUNT(*) as total
            FROM our_word_list wl
            JOIN our_videos v ON v.video_id = wl.video_id
            WHERE wl.words IS NOT NULL AND wl.words != ''
        """)
        total_videos = cur.fetchone()['total']
        
        print(f"Found {total_videos} videos with vocabulary to process\n")
        
        # Get all videos with word lists
        cur.execute("""
            SELECT wl.video_id, wl.words, v.title
            FROM our_word_list wl
            JOIN our_videos v ON v.video_id = wl.video_id
            WHERE wl.words IS NOT NULL AND wl.words != ''
            ORDER BY v.id
        """)
        
        videos = cur.fetchall()
        
        # Process statistics
        processed_count = 0
        error_count = 0
        total_words = 0
        start_time = time.time()
        
        # Process each video
        for i, video in enumerate(videos, 1):
            video_id = video['video_id']
            words = video['words']
            title = video['title'] or "No title"
            title = title[:50] + "..." if len(title) > 50 else title
            
            # Progress indicator
            progress = (i / total_videos) * 100
            sys.stdout.write(f"\r[{i}/{total_videos}] {progress:.1f}% - Processing: {title}")
            sys.stdout.flush()
            
            # Process the video
            word_count = process_video(conn, video_id, words, title)
            
            if word_count:
                processed_count += 1
                total_words += word_count
            else:
                error_count += 1
        
        # Clear the progress line
        sys.stdout.write("\r" + " " * 100 + "\r")
        sys.stdout.flush()
        
        # Calculate statistics
        elapsed_time = time.time() - start_time
        
        print("\n" + "="*60)
        print("📊 Processing Complete!")
        print(f"   • Total videos: {total_videos}")
        print(f"   • Successfully processed: {processed_count}")
        print(f"   • Errors: {error_count}")
        print(f"   • Total words imported: {total_words:,}")
        print(f"   • Time elapsed: {elapsed_time:.1f} seconds")
        print(f"   • Average: {elapsed_time/total_videos:.2f} seconds per video")
        
        # Show database statistics
        cur.execute("""
            SELECT 
                COUNT(DISTINCT video_id) as video_count,
                COUNT(DISTINCT lemma) as unique_lemmas,
                COUNT(*) as total_entries,
                SUM(frequency) as total_occurrences
            FROM our_videos_base_words
        """)
        stats = cur.fetchone()
        
        print("\n📈 Database Statistics:")
        print(f"   • Videos with vocabulary: {stats['video_count']}")
        print(f"   • Unique lemmas: {stats['unique_lemmas']:,}")
        print(f"   • Total entries: {stats['total_entries']:,}")
        print(f"   • Total word occurrences: {stats['total_occurrences']:,}")
        
    except Exception as e:
        print(f"\n❌ Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()
    
    print("\n✅ All videos processed!")

if __name__ == "__main__":
    main() 