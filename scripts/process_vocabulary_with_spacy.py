#!/usr/bin/env python3
"""
Process vocabulary from LearnAndEarn videos using SpaCy NLP
Extracts and analyzes German vocabulary with linguistic features
"""

import spacy
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import json
from collections import Counter
import time

# Load environment variables
load_dotenv()

# SpaCy Model Selection
# - de_core_news_sm: Small model (~13MB) - fastest, basic features
# - de_core_news_md: Medium model (~43MB) - good balance
# - de_core_news_lg: Large model (~568MB) - best accuracy, includes word vectors
MODEL_NAME = "de_core_news_lg"  # Using large model for best quality

# Load SpaCy model globally
print(f"Loading SpaCy model: {MODEL_NAME}...")
start_time = time.time()
nlp = spacy.load(MODEL_NAME)
load_time = time.time() - start_time
print(f"✓ Model loaded in {load_time:.2f} seconds\n")

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
                    'pos': token.pos_,  # Part of speech
                    'tag': token.tag_,  # Detailed tag
                    'is_stop': token.is_stop,  # Is it a stop word?
                    'is_alpha': token.is_alpha,  # Is it alphabetic?
                    'has_vector': token.has_vector,  # Does it have a word vector?
                    'vector_norm': float(token.vector_norm) if token.has_vector else 0.0
                }
                processed_words.append(word_info)
    
    return processed_words

def analyze_subtitle_sample(subtitle_text, max_chars=500):
    """Analyze a sample of subtitle text"""
    if not subtitle_text:
        return None
    
    # Take first max_chars characters
    sample = subtitle_text[:max_chars]
    
    # Process with SpaCy
    doc = nlp(sample)
    
    # Extract sentences
    sentences = [sent.text.strip() for sent in doc.sents][:3]  # First 3 sentences
    
    # Extract entities
    entities = [(ent.text, ent.label_) for ent in doc.ents]
    
    return {
        'sentences': sentences,
        'entities': entities,
        'token_count': len(doc)
    }

def analyze_vocabulary():
    """Analyze vocabulary from videos and create example datasets"""
    conn = connect_db()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get a sample of videos with vocabulary
        cur.execute("""
            SELECT wl.id, wl.video_id, wl.words, 
                   v.title, v.channel_at, v._type, v.pure_subtitle
            FROM our_word_list wl
            JOIN our_videos v ON v.video_id = wl.video_id
            WHERE wl.words IS NOT NULL 
            AND wl.words != ''
            ORDER BY v.id DESC
            LIMIT 5  -- Process 5 videos as examples
        """)
        
        videos = cur.fetchall()
        print(f"Found {len(videos)} videos with vocabulary to process\n")
        
        all_results = []
        
        for video in videos:
            video_id = video['video_id']
            words = video['words']
            title = video['title']
            channel = video['channel_at']
            category = video['_type']
            subtitle = video['pure_subtitle']
            
            print(f"{'='*60}")
            print(f"Video: {title[:50]}...")
            print(f"Channel: {channel}")
            print(f"Category: {category}")
            print(f"Video ID: {video_id}")
            print(f"{'='*60}")
            
            # Process words
            processed = process_word_list(words)
            
            # Analyze this video's vocabulary
            lemmas = Counter()
            pos_counts = Counter()
            word_forms = {}
            
            for word_info in processed:
                lemma = word_info['lemma']
                original = word_info['original']
                pos = word_info['pos']
                
                lemmas[lemma] += 1
                pos_counts[pos] += 1
                
                if lemma not in word_forms:
                    word_forms[lemma] = {
                        'forms': set(),
                        'pos': pos,
                        'is_stop': word_info['is_stop'],
                        'has_vector': word_info['has_vector']
                    }
                word_forms[lemma]['forms'].add(original)
            
            # Print analysis for this video
            print(f"\n📊 Vocabulary Statistics:")
            print(f"   • Total words: {len(processed)}")
            print(f"   • Unique lemmas: {len(lemmas)}")
            print(f"   • Unique word forms: {len(set(w['original'] for w in processed))}")
            
            print(f"\n📝 Most Common Words (by lemma):")
            for lemma, count in lemmas.most_common(10):
                info = word_forms[lemma]
                forms_str = ', '.join(sorted(info['forms']))
                print(f"   • {lemma} ({info['pos']}): {count}x - Forms: [{forms_str}]")
            
            print(f"\n🏷️  Part of Speech Distribution:")
            for pos, count in pos_counts.most_common():
                pos_name = {
                    'NOUN': 'Nouns',
                    'VERB': 'Verbs', 
                    'ADJ': 'Adjectives',
                    'ADV': 'Adverbs',
                    'PRON': 'Pronouns',
                    'DET': 'Determiners',
                    'ADP': 'Prepositions',
                    'CONJ': 'Conjunctions',
                    'NUM': 'Numbers',
                    'PROPN': 'Proper Nouns',
                    'AUX': 'Auxiliary Verbs',
                    'PART': 'Particles',
                    'X': 'Other'
                }.get(pos, pos)
                print(f"   • {pos_name}: {count} ({count/len(processed)*100:.1f}%)")
            
            # Example sentences with the vocabulary
            print(f"\n💡 Example Learning Data:")
            # Get some interesting words (not stop words, with vectors)
            interesting_words = [
                w for w in processed 
                if not w['is_stop'] and w['has_vector'] and w['pos'] in ['NOUN', 'VERB', 'ADJ']
            ][:5]
            
            for word in interesting_words:
                print(f"   • {word['original']} → {word['lemma']} ({word['pos']})")
                if word['has_vector']:
                    print(f"     Vector norm: {word['vector_norm']:.2f}")
            
            # Analyze subtitle if available
            subtitle_analysis = None
            if subtitle:
                print(f"\n📺 Subtitle Analysis:")
                subtitle_analysis = analyze_subtitle_sample(subtitle)
                if subtitle_analysis:
                    print(f"   • Sample sentences: {len(subtitle_analysis['sentences'])}")
                    for i, sent in enumerate(subtitle_analysis['sentences'], 1):
                        print(f"     {i}. {sent[:80]}...")
                    
                    if subtitle_analysis['entities']:
                        print(f"   • Named entities found:")
                        for ent_text, ent_label in subtitle_analysis['entities'][:5]:
                            print(f"     - {ent_text} ({ent_label})")
            
            # Store results
            result = {
                'video_id': video_id,
                'title': title,
                'channel': channel,
                'category': category,
                'vocabulary': processed,
                'statistics': {
                    'total_words': len(processed),
                    'unique_lemmas': len(lemmas),
                    'pos_distribution': dict(pos_counts),
                    'top_lemmas': dict(lemmas.most_common(20))
                }
            }
            
            if subtitle_analysis:
                result['subtitle_analysis'] = subtitle_analysis
            
            all_results.append(result)
            
            print()
        
        # Save example datasets
        print(f"\n{'='*60}")
        print("💾 Saving example datasets...")
        
        output_dir = "vocabulary_examples"
        os.makedirs(output_dir, exist_ok=True)
        
        for i, result in enumerate(all_results):
            filename = f"{output_dir}/video_{i+1}_{result['video_id']}.json"
            with open(filename, 'w', encoding='utf-8') as f:
                json.dump(result, f, ensure_ascii=False, indent=2)
            print(f"   ✓ Saved: {filename}")
        
        # Create a summary file
        summary = {
            'processed_videos': len(all_results),
            'model_used': MODEL_NAME,
            'timestamp': time.strftime('%Y-%m-%d %H:%M:%S'),
            'videos': [
                {
                    'video_id': r['video_id'],
                    'title': r['title'],
                    'total_words': r['statistics']['total_words'],
                    'unique_lemmas': r['statistics']['unique_lemmas']
                }
                for r in all_results
            ]
        }
        
        with open(f"{output_dir}/summary.json", 'w', encoding='utf-8') as f:
            json.dump(summary, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ Successfully processed {len(all_results)} videos!")
        print(f"   Example datasets saved in: {output_dir}/")
        print(f"   Summary saved in: {output_dir}/summary.json")
            
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        cur.close()
        conn.close()

def create_enhanced_vocabulary_table():
    """Create a new table with SpaCy-processed vocabulary"""
    conn = connect_db()
    cur = conn.cursor()
    
    try:
        # Create enhanced vocabulary table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS our_vocabulary_enhanced (
                id SERIAL PRIMARY KEY,
                video_id VARCHAR(255),
                video_internal_id INTEGER,
                original_word VARCHAR(255),
                lemma VARCHAR(255),
                pos VARCHAR(50),
                tag VARCHAR(50),
                is_stop_word BOOLEAN DEFAULT FALSE,
                has_vector BOOLEAN DEFAULT FALSE,
                vector_norm FLOAT,
                frequency INTEGER DEFAULT 1,
                difficulty_score FLOAT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        # Create indexes
        cur.execute("CREATE INDEX IF NOT EXISTS idx_lemma ON our_vocabulary_enhanced(lemma);")
        cur.execute("CREATE INDEX IF NOT EXISTS idx_video_lemma ON our_vocabulary_enhanced(video_id, lemma);")
        cur.execute("CREATE UNIQUE INDEX IF NOT EXISTS idx_video_word ON our_vocabulary_enhanced(video_id, original_word);")
        
        conn.commit()
        print("✓ Enhanced vocabulary table created successfully!")
        
    except Exception as e:
        print(f"Error creating table: {e}")
        conn.rollback()
    finally:
        cur.close()
        conn.close()

if __name__ == "__main__":
    print("🚀 SpaCy German Vocabulary Processor")
    print("====================================")
    
    # First, analyze existing vocabulary
    analyze_vocabulary()
    
    # Optionally create enhanced table
    # print("\nWould you like to create the enhanced vocabulary table? (y/n)")
    # if input().lower() == 'y':
    #     create_enhanced_vocabulary_table() 