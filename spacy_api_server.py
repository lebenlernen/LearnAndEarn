#!/usr/bin/env python3
"""
SpaCy API Server for LearnAndEarn Platform
Provides NLP processing for German text and vocabulary exercises
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Optional
import spacy
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from dotenv import load_dotenv
import json
import random
import re
from collections import Counter

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="LearnAndEarn SpaCy API", version="1.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Node.js app
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load SpaCy model - using medium model for good balance
MODEL_NAME = "de_core_news_md"
print(f"Loading SpaCy German model: {MODEL_NAME}...")
nlp = spacy.load(MODEL_NAME)
print("✓ SpaCy model loaded")

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', 3143),
        database=os.getenv('DB_NAME', 'jetzt'),
        user=os.getenv('DB_USER', 'odoo'),
        password=os.getenv('DB_PASSWORD')
    )

# Pydantic models
class ProcessVideoRequest(BaseModel):
    video_id: str

class Word(BaseModel):
    original: str
    lemma: str
    pos: str
    tag: str
    is_stop: bool
    has_vector: bool
    vector_norm: float

class Sentence(BaseModel):
    text: str
    words: List[Word]
    entities: List[Dict[str, str]]

class ClozeTest(BaseModel):
    sentence: str
    cloze_word: str
    cloze_position: int
    options: List[str]
    context: Optional[str] = None

class VocabularyExercise(BaseModel):
    word: str
    lemma: str
    pos: str
    example_sentences: List[str]
    difficulty_score: float

# API Endpoints

@app.get("/")
def read_root():
    return {"message": "LearnAndEarn SpaCy API Server", "status": "running"}

@app.post("/process_video")
async def process_video(request: ProcessVideoRequest):
    """Process a video's subtitles with SpaCy and store results"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get video subtitle
        cur.execute("""
            SELECT video_id, pure_subtitle, title
            FROM our_videos
            WHERE video_id = %s
        """, (request.video_id,))
        
        video = cur.fetchone()
        if not video or not video['pure_subtitle']:
            raise HTTPException(status_code=404, detail="Video or subtitles not found")
        
        subtitle_text = video['pure_subtitle']
        
        # Process with SpaCy
        doc = nlp(subtitle_text)
        
        # Extract words and their properties
        word_freq = Counter()
        word_data = {}
        
        for token in doc:
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
        
        # Store in database
        for word, freq in word_freq.items():
            data = word_data[word]
            cur.execute("""
                INSERT INTO our_videos_base_words 
                (video_id, original_word, lemma, pos, tag, is_stop_word, has_vector, vector_norm, frequency)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (video_id, original_word) 
                DO UPDATE SET frequency = EXCLUDED.frequency
            """, (
                request.video_id,
                data['original'],
                data['lemma'],
                data['pos'],
                data['tag'],
                data['is_stop'],
                data['has_vector'],
                data['vector_norm'],
                freq
            ))
        
        # Process sentences for exercises
        sentences = []
        for sent in doc.sents:
            sent_text = sent.text.strip()
            if len(sent_text.split()) >= 5:  # Only sentences with 5+ words
                sentences.append({
                    'text': sent_text,
                    'start': sent.start,
                    'end': sent.end
                })
        
        # Store sentences
        cur.execute("""
            CREATE TABLE IF NOT EXISTS our_video_sentences (
                id SERIAL PRIMARY KEY,
                video_id VARCHAR(255) NOT NULL,
                sentence TEXT NOT NULL,
                sentence_index INTEGER,
                word_count INTEGER,
                has_entities BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT fk_video_sentence FOREIGN KEY(video_id) 
                    REFERENCES our_videos(video_id) ON DELETE CASCADE
            )
        """)
        
        for idx, sent in enumerate(sentences):
            cur.execute("""
                INSERT INTO our_video_sentences 
                (video_id, sentence, sentence_index, word_count)
                VALUES (%s, %s, %s, %s)
            """, (
                request.video_id,
                sent['text'],
                idx,
                len(sent['text'].split())
            ))
        
        conn.commit()
        
        return {
            "video_id": request.video_id,
            "title": video['title'],
            "total_words": sum(word_freq.values()),
            "unique_words": len(word_data),
            "sentences_processed": len(sentences),
            "status": "success"
        }
        
    except Exception as e:
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cur.close()
        conn.close()

@app.get("/vocabulary/{video_id}")
async def get_vocabulary(video_id: str, limit: int = 50):
    """Get processed vocabulary for a video"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT * FROM our_videos_base_words
            WHERE video_id = %s
            AND is_stop_word = FALSE
            ORDER BY frequency DESC
            LIMIT %s
        """, (video_id, limit))
        
        words = cur.fetchall()
        
        return {
            "video_id": video_id,
            "vocabulary": words,
            "count": len(words)
        }
        
    finally:
        cur.close()
        conn.close()

@app.get("/cloze_tests/{video_id}")
async def generate_cloze_tests(video_id: str, count: int = 5):
    """Generate cloze tests from video sentences"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get sentences
        cur.execute("""
            SELECT sentence FROM our_video_sentences
            WHERE video_id = %s
            AND word_count BETWEEN 7 AND 20
            ORDER BY RANDOM()
            LIMIT %s
        """, (video_id, count * 2))  # Get extra for filtering
        
        sentences = cur.fetchall()
        if not sentences:
            raise HTTPException(status_code=404, detail="No sentences found for video")
        
        # Get vocabulary for distractors
        cur.execute("""
            SELECT DISTINCT lemma, pos FROM our_videos_base_words
            WHERE video_id = %s
            AND is_stop_word = FALSE
            AND pos IN ('NOUN', 'VERB', 'ADJ')
        """, (video_id,))
        
        vocab = cur.fetchall()
        vocab_by_pos = {}
        for word in vocab:
            if word['pos'] not in vocab_by_pos:
                vocab_by_pos[word['pos']] = []
            vocab_by_pos[word['pos']].append(word['lemma'])
        
        cloze_tests = []
        
        for sent_data in sentences[:count]:
            sent_text = sent_data['sentence']
            doc = nlp(sent_text)
            
            # Find suitable words to remove (content words)
            candidates = [
                token for token in doc 
                if not token.is_stop and not token.is_punct 
                and token.pos_ in ['NOUN', 'VERB', 'ADJ']
                and len(token.text) > 3
            ]
            
            if not candidates:
                continue
            
            # Select random word to remove
            target = random.choice(candidates)
            
            # Generate distractors
            distractors = []
            if target.pos_ in vocab_by_pos:
                same_pos_words = [w for w in vocab_by_pos[target.pos_] 
                                 if w != target.lemma_]
                distractors = random.sample(
                    same_pos_words, 
                    min(3, len(same_pos_words))
                )
            
            # Create cloze sentence
            words = sent_text.split()
            target_idx = None
            for i, word in enumerate(words):
                if target.text in word:
                    words[i] = "_____"
                    target_idx = i
                    break
            
            if target_idx is not None:
                cloze_sentence = " ".join(words)
                
                options = [target.text] + distractors
                random.shuffle(options)
                
                cloze_tests.append({
                    "sentence": cloze_sentence,
                    "cloze_word": target.text,
                    "cloze_position": target_idx,
                    "options": options,
                    "original_sentence": sent_text
                })
        
        return {
            "video_id": video_id,
            "cloze_tests": cloze_tests,
            "count": len(cloze_tests)
        }
        
    finally:
        cur.close()
        conn.close()

@app.get("/word_context/{video_id}/{word}")
async def get_word_context(video_id: str, word: str):
    """Get example sentences containing a specific word"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get word info
        cur.execute("""
            SELECT * FROM our_videos_base_words
            WHERE video_id = %s
            AND (original_word = %s OR lemma = %s)
            LIMIT 1
        """, (video_id, word, word))
        
        word_info = cur.fetchone()
        if not word_info:
            raise HTTPException(status_code=404, detail="Word not found")
        
        # Get sentences containing this word
        cur.execute("""
            SELECT sentence FROM our_video_sentences
            WHERE video_id = %s
            AND (
                sentence ILIKE %s 
                OR sentence ILIKE %s
            )
            LIMIT 5
        """, (
            video_id, 
            f'% {word} %',
            f'% {word_info["lemma"]} %'
        ))
        
        sentences = [s['sentence'] for s in cur.fetchall()]
        
        return {
            "word": word,
            "word_info": word_info,
            "example_sentences": sentences,
            "count": len(sentences)
        }
        
    finally:
        cur.close()
        conn.close()

@app.get("/similar_words/{word}")
async def get_similar_words(word: str, limit: int = 10):
    """Get semantically similar words using word vectors"""
    doc = nlp(word)
    if not doc or not doc[0].has_vector:
        return {"word": word, "similar_words": [], "message": "No vector found for word"}
    
    word_vector = doc[0].vector
    
    # Find similar words in vocabulary
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cur.execute("""
            SELECT DISTINCT lemma, pos, AVG(vector_norm) as avg_norm
            FROM our_videos_base_words
            WHERE has_vector = TRUE
            AND lemma != %s
            GROUP BY lemma, pos
            HAVING AVG(vector_norm) > 0
        """, (word,))
        
        candidates = cur.fetchall()
        
        # Calculate similarities
        similarities = []
        for candidate in candidates:
            cand_doc = nlp(candidate['lemma'])
            if cand_doc and cand_doc[0].has_vector:
                similarity = doc[0].similarity(cand_doc[0])
                similarities.append({
                    'word': candidate['lemma'],
                    'pos': candidate['pos'],
                    'similarity': float(similarity)
                })
        
        # Sort by similarity
        similarities.sort(key=lambda x: x['similarity'], reverse=True)
        
        return {
            "word": word,
            "similar_words": similarities[:limit]
        }
        
    finally:
        cur.close()
        conn.close()

@app.post("/check_grammar")
async def check_grammar(text: str):
    """Check grammar and provide corrections"""
    doc = nlp(text)
    
    issues = []
    
    # Basic grammar checks
    for token in doc:
        # Check for common errors
        if token.pos_ == "NOUN" and token.text[0].islower() and token.i > 0:
            issues.append({
                "type": "capitalization",
                "word": token.text,
                "suggestion": token.text.capitalize(),
                "message": "Nouns should be capitalized in German"
            })
    
    return {
        "text": text,
        "issues": issues,
        "is_correct": len(issues) == 0
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)