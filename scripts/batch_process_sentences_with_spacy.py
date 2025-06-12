#!/usr/bin/env python3
"""
Batch process all existing sentences with SpaCy to populate token analysis
This enables proper Lückentexte exercises for verbs, nouns, etc.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import requests
import sys
import time
from datetime import datetime

# Database configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 3143,
    'database': 'jetzt',
    'user': 'odoo',
    'password': 'odoo'
}

# SpaCy API URL
SPACY_API_URL = 'http://localhost:8001'

def create_tokens_table(cursor):
    """Create the sentence tokens table if it doesn't exist"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS our_video_sentence_tokens (
            id SERIAL PRIMARY KEY,
            sentence_id INTEGER NOT NULL,
            token_index INTEGER NOT NULL,
            text VARCHAR(255) NOT NULL,
            text_lower VARCHAR(255),
            lemma VARCHAR(255),
            pos VARCHAR(50),
            tag VARCHAR(50),
            dep VARCHAR(50),
            is_stop BOOLEAN DEFAULT FALSE,
            is_punct BOOLEAN DEFAULT FALSE,
            is_space BOOLEAN DEFAULT FALSE,
            
            CONSTRAINT fk_sentence 
                FOREIGN KEY(sentence_id) 
                REFERENCES our_video_sentences(id) 
                ON DELETE CASCADE,
            
            CONSTRAINT unique_sentence_token 
                UNIQUE(sentence_id, token_index)
        );
        
        CREATE INDEX IF NOT EXISTS idx_sentence_tokens_sentence_id ON our_video_sentence_tokens(sentence_id);
        CREATE INDEX IF NOT EXISTS idx_sentence_tokens_pos ON our_video_sentence_tokens(pos);
        CREATE INDEX IF NOT EXISTS idx_sentence_tokens_lemma ON our_video_sentence_tokens(lemma);
    """)
    print("✓ Tokens table ready")

def process_sentence_with_spacy(sentence_text):
    """Send sentence to SpaCy API for analysis"""
    try:
        response = requests.post(
            f"{SPACY_API_URL}/process_sentence",
            json={"text": sentence_text},
            timeout=10
        )
        
        if response.status_code == 200:
            return response.json().get('tokens', [])
        else:
            print(f"SpaCy API error: {response.status_code}")
            return None
    except Exception as e:
        print(f"Error calling SpaCy API: {e}")
        return None

def main():
    print("=== SpaCy Sentence Batch Processor ===")
    print(f"Started at: {datetime.now()}")
    
    # Connect to database
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        print("✓ Connected to database")
    except Exception as e:
        print(f"✗ Database connection failed: {e}")
        sys.exit(1)
    
    # Create tokens table if needed
    create_tokens_table(cursor)
    conn.commit()
    
    # Check SpaCy API availability
    try:
        response = requests.get(f"{SPACY_API_URL}/")
        if response.status_code != 200:
            raise Exception("SpaCy API not responding")
        print("✓ SpaCy API is running")
    except Exception as e:
        print(f"✗ SpaCy API not available: {e}")
        print("Please start SpaCy API server: ./start_spacy_youtube.sh")
        sys.exit(1)
    
    # Get total count of sentences
    cursor.execute("SELECT COUNT(*) as total FROM our_video_sentences")
    total_sentences = cursor.fetchone()['total']
    print(f"\nTotal sentences to process: {total_sentences}")
    
    # Check how many are already processed
    cursor.execute("""
        SELECT COUNT(DISTINCT sentence_id) as processed 
        FROM our_video_sentence_tokens
    """)
    already_processed = cursor.fetchone()['processed']
    print(f"Already processed: {already_processed}")
    print(f"To process: {total_sentences - already_processed}")
    
    if total_sentences == already_processed:
        print("\n✓ All sentences already processed!")
        return
    
    # Process sentences in batches
    batch_size = 100
    processed = 0
    errors = 0
    
    print(f"\nProcessing in batches of {batch_size}...")
    
    while True:
        # Get unprocessed sentences
        cursor.execute("""
            SELECT s.id, s.sentence, v.title as video_title
            FROM our_video_sentences s
            JOIN our_videos v ON s.video_id = v.video_id
            WHERE s.id NOT IN (
                SELECT DISTINCT sentence_id FROM our_video_sentence_tokens
            )
            ORDER BY s.id
            LIMIT %s
        """, (batch_size,))
        
        sentences = cursor.fetchall()
        if not sentences:
            break
        
        for sentence in sentences:
            try:
                # Show progress
                processed += 1
                if processed % 10 == 0:
                    print(f"Progress: {already_processed + processed}/{total_sentences} " +
                          f"({(already_processed + processed) * 100 / total_sentences:.1f}%)")
                
                # Process with SpaCy
                tokens = process_sentence_with_spacy(sentence['sentence'])
                
                if tokens:
                    # Store tokens
                    for token in tokens:
                        cursor.execute("""
                            INSERT INTO our_video_sentence_tokens 
                            (sentence_id, token_index, text, text_lower, lemma, 
                             pos, tag, dep, is_stop, is_punct, is_space)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                            ON CONFLICT (sentence_id, token_index) DO NOTHING
                        """, (
                            sentence['id'],
                            token.get('index', 0),
                            token.get('text', ''),
                            token.get('text', '').lower(),
                            token.get('lemma', ''),
                            token.get('pos', ''),
                            token.get('tag', ''),
                            token.get('dep', ''),
                            token.get('is_stop', False),
                            token.get('is_punct', False),
                            token.get('is_space', False)
                        ))
                    
                    # Commit after each sentence
                    conn.commit()
                else:
                    errors += 1
                    print(f"✗ Failed to process sentence {sentence['id']}: {sentence['sentence'][:50]}...")
                
            except Exception as e:
                errors += 1
                print(f"✗ Error processing sentence {sentence['id']}: {e}")
                conn.rollback()
        
        # Small delay to not overwhelm the API
        time.sleep(0.1)
    
    # Final statistics
    print("\n=== Processing Complete ===")
    print(f"Total processed: {processed}")
    print(f"Errors: {errors}")
    print(f"Success rate: {(processed - errors) * 100 / processed if processed > 0 else 0:.1f}%")
    
    # Show sample results
    print("\n=== Sample Results ===")
    cursor.execute("""
        SELECT s.sentence, COUNT(t.id) as token_count,
               COUNT(CASE WHEN t.pos = 'VERB' THEN 1 END) as verbs,
               COUNT(CASE WHEN t.pos = 'NOUN' THEN 1 END) as nouns,
               COUNT(CASE WHEN t.pos IN ('DET', 'ART') THEN 1 END) as articles
        FROM our_video_sentences s
        JOIN our_video_sentence_tokens t ON s.id = t.sentence_id
        GROUP BY s.id, s.sentence
        ORDER BY s.id DESC
        LIMIT 5
    """)
    
    for row in cursor.fetchall():
        print(f"\nSentence: {row['sentence'][:80]}...")
        print(f"  Tokens: {row['token_count']}, Verbs: {row['verbs']}, "
              f"Nouns: {row['nouns']}, Articles: {row['articles']}")
    
    cursor.close()
    conn.close()
    print(f"\nFinished at: {datetime.now()}")

if __name__ == "__main__":
    main()