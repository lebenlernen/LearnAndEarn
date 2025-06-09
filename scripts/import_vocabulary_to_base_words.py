#!/usr/bin/env python3
"""
Import SpaCy-processed vocabulary from JSON files into our_videos_base_words table
"""

import json
import psycopg2
from psycopg2.extras import execute_batch
import os
from dotenv import load_dotenv
import glob
from collections import Counter

# Load environment variables
load_dotenv()

def connect_db():
    """Connect to PostgreSQL database"""
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', 3143),
        database=os.getenv('DB_NAME', 'jetzt'),
        user=os.getenv('DB_USER', 'odoo'),
        password=os.getenv('DB_PASSWORD')
    )

def create_table_if_not_exists(conn):
    """Ensure the table exists"""
    with open('scripts/create_base_words_table.sql', 'r') as f:
        sql = f.read()
    
    cur = conn.cursor()
    try:
        cur.execute(sql)
        conn.commit()
        print("✓ Table our_videos_base_words is ready")
    except Exception as e:
        print(f"Error creating table: {e}")
        conn.rollback()
    finally:
        cur.close()

def import_vocabulary_file(conn, json_file):
    """Import vocabulary from a single JSON file"""
    print(f"\nProcessing: {json_file}")
    
    with open(json_file, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    video_id = data['video_id']
    title = data['title']
    vocabulary = data['vocabulary']
    
    print(f"Video: {title[:50]}...")
    print(f"Words to import: {len(vocabulary)}")
    
    # Count word frequencies
    word_freq = Counter()
    for word in vocabulary:
        word_freq[word['original']] += 1
    
    # Prepare data for batch insert
    insert_data = []
    seen_words = set()  # Track unique words
    
    for word in vocabulary:
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
            word_freq[original]  # Use counted frequency
        ))
    
    # Insert into database
    cur = conn.cursor()
    try:
        # First, delete existing entries for this video
        cur.execute("DELETE FROM our_videos_base_words WHERE video_id = %s", (video_id,))
        
        # Batch insert new data
        insert_query = """
            INSERT INTO our_videos_base_words 
            (video_id, original_word, lemma, pos, tag, is_stop_word, has_vector, vector_norm, frequency)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        execute_batch(cur, insert_query, insert_data, page_size=100)
        
        conn.commit()
        print(f"✓ Imported {len(insert_data)} unique words")
        
    except Exception as e:
        print(f"Error importing data: {e}")
        conn.rollback()
    finally:
        cur.close()

def show_statistics(conn):
    """Show statistics after import"""
    cur = conn.cursor()
    
    # Total statistics
    cur.execute("""
        SELECT 
            COUNT(DISTINCT video_id) as video_count,
            COUNT(DISTINCT lemma) as unique_lemmas,
            COUNT(*) as total_entries,
            SUM(frequency) as total_words
        FROM our_videos_base_words
    """)
    stats = cur.fetchone()
    
    print("\n" + "="*60)
    print("📊 Import Statistics:")
    print(f"   • Videos processed: {stats[0]}")
    print(f"   • Unique lemmas: {stats[1]:,}")
    print(f"   • Total entries: {stats[2]:,}")
    print(f"   • Total word occurrences: {stats[3]:,}")
    
    # Most common lemmas
    cur.execute("""
        SELECT lemma, pos, COUNT(DISTINCT video_id) as video_count, SUM(frequency) as total_freq
        FROM our_videos_base_words
        WHERE is_stop_word = false
        GROUP BY lemma, pos
        ORDER BY video_count DESC, total_freq DESC
        LIMIT 10
    """)
    
    print("\n📝 Most Common Content Words:")
    for lemma, pos, video_count, total_freq in cur.fetchall():
        print(f"   • {lemma} ({pos}): in {video_count} videos, {total_freq} occurrences")
    
    cur.close()

def main():
    """Main import function"""
    print("🚀 Vocabulary Import Tool")
    print("========================")
    
    # Connect to database
    conn = connect_db()
    
    # Ensure table exists
    create_table_if_not_exists(conn)
    
    # Find all vocabulary JSON files
    json_files = glob.glob('vocabulary_examples/video_*.json')
    
    if not json_files:
        print("No vocabulary JSON files found in vocabulary_examples/")
        return
    
    print(f"\nFound {len(json_files)} files to import")
    
    # Import each file
    for json_file in sorted(json_files):
        import_vocabulary_file(conn, json_file)
    
    # Show statistics
    show_statistics(conn)
    
    # Close connection
    conn.close()
    
    print("\n✅ Import completed!")

if __name__ == "__main__":
    main() 