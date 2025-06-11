#!/usr/bin/env python3
"""
Example of SpaCy API Server with Multi-Language Support
This is a template for future implementation when supporting multiple languages
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

# Load environment variables
load_dotenv()

# Initialize FastAPI app
app = FastAPI(title="LearnAndEarn Multi-Language SpaCy API", version="2.0.0")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Language model configuration
LANGUAGE_MODELS = {
    'de': {
        'model_name': 'de_core_news_md',
        'name': 'German',
        'articles': ['der', 'die', 'das', 'den', 'dem', 'des'],
        'stop_words_custom': ['und', 'oder', 'aber', 'weil']
    },
    'en': {
        'model_name': 'en_core_web_md',
        'name': 'English', 
        'articles': ['the', 'a', 'an'],
        'stop_words_custom': ['and', 'or', 'but', 'because']
    },
    'es': {
        'model_name': 'es_core_news_md',
        'name': 'Spanish',
        'articles': ['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas'],
        'stop_words_custom': ['y', 'o', 'pero', 'porque']
    },
    'fr': {
        'model_name': 'fr_core_news_md',
        'name': 'French',
        'articles': ['le', 'la', 'les', 'un', 'une', 'des'],
        'stop_words_custom': ['et', 'ou', 'mais', 'parce']
    }
}

# Load language models on startup
print("Loading SpaCy language models...")
loaded_models = {}

for lang_code, config in LANGUAGE_MODELS.items():
    try:
        print(f"Loading {config['name']} model: {config['model_name']}...")
        loaded_models[lang_code] = spacy.load(config['model_name'])
        print(f"✓ {config['name']} model loaded")
    except OSError:
        print(f"✗ {config['name']} model not found. Install with: python -m spacy download {config['model_name']}")

# Default to German if specified language not available
DEFAULT_LANGUAGE = 'de'

def get_nlp_model(language: str):
    """Get the appropriate NLP model for the language"""
    return loaded_models.get(language, loaded_models.get(DEFAULT_LANGUAGE))

def get_language_config(language: str) -> dict:
    """Get language-specific configuration"""
    return LANGUAGE_MODELS.get(language, LANGUAGE_MODELS[DEFAULT_LANGUAGE])

# Database connection
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv('DB_HOST', 'localhost'),
        port=os.getenv('DB_PORT', 3143),
        database=os.getenv('DB_NAME', 'jetzt'),
        user=os.getenv('DB_USER', 'odoo'),
        password=os.getenv('DB_PASSWORD')
    )

# Updated Pydantic models
class ProcessVideoRequest(BaseModel):
    video_id: str
    language: Optional[str] = None  # Auto-detect from DB if not provided

# API Endpoints

@app.get("/")
def read_root():
    return {
        "message": "LearnAndEarn Multi-Language SpaCy API Server",
        "status": "running",
        "languages_available": list(loaded_models.keys()),
        "languages_configured": list(LANGUAGE_MODELS.keys())
    }

@app.post("/process_video")
async def process_video(request: ProcessVideoRequest):
    """Process a video's subtitles with appropriate language model"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get video details including language
        cur.execute("""
            SELECT video_id, pure_subtitle, title, language_target
            FROM our_videos
            WHERE video_id = %s
        """, (request.video_id,))
        
        video = cur.fetchone()
        if not video or not video['pure_subtitle']:
            raise HTTPException(status_code=404, detail="Video or subtitles not found")
        
        # Determine language to use
        language = request.language or video.get('language_target', DEFAULT_LANGUAGE)
        
        # Get appropriate NLP model
        nlp = get_nlp_model(language)
        if not nlp:
            raise HTTPException(
                status_code=400, 
                detail=f"Language '{language}' not supported. Available: {list(loaded_models.keys())}"
            )
        
        subtitle_text = video['pure_subtitle']
        
        # Process with SpaCy
        doc = nlp(subtitle_text)
        
        # Extract words and their properties
        word_freq = {}
        word_data = {}
        
        for token in doc:
            if not token.is_punct and not token.is_space:
                word_lower = token.text.lower()
                word_freq[word_lower] = word_freq.get(word_lower, 0) + 1
                
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
        
        # Store in database with language information
        for word, freq in word_freq.items():
            data = word_data[word]
            cur.execute("""
                INSERT INTO our_videos_base_words 
                (video_id, original_word, lemma, pos, tag, is_stop_word, 
                 has_vector, vector_norm, frequency, language_target)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (video_id, original_word) 
                DO UPDATE SET 
                    frequency = EXCLUDED.frequency,
                    language_target = EXCLUDED.language_target
            """, (
                request.video_id,
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
        
        # Process and store sentences
        sentences = []
        for sent in doc.sents:
            sent_text = sent.text.strip()
            if len(sent_text.split()) >= 5:
                sentences.append({
                    'text': sent_text,
                    'start': sent.start,
                    'end': sent.end
                })
        
        # Store sentences with language info
        for idx, sent in enumerate(sentences):
            cur.execute("""
                INSERT INTO our_video_sentences 
                (video_id, sentence, sentence_index, word_count)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT DO NOTHING
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
            "language": language,
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

@app.get("/cloze_tests/{video_id}")
async def generate_cloze_tests(
    video_id: str, 
    count: int = 5, 
    type: str = "random",
    language: Optional[str] = None
):
    """Generate cloze tests with language-specific rules"""
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Get video language if not specified
        if not language:
            cur.execute("""
                SELECT language_target FROM our_videos WHERE video_id = %s
            """, (video_id,))
            result = cur.fetchone()
            language = result['language_target'] if result else DEFAULT_LANGUAGE
        
        # Get language configuration
        lang_config = get_language_config(language)
        nlp = get_nlp_model(language)
        
        # Get sentences
        cur.execute("""
            SELECT sentence FROM our_video_sentences
            WHERE video_id = %s
            AND LENGTH(sentence) > 50
            ORDER BY RANDOM()
            LIMIT %s
        """, (video_id, count * 2))
        
        sentences = cur.fetchall()
        if not sentences:
            raise HTTPException(status_code=404, detail="No sentences found for video")
        
        cloze_tests = []
        
        for sent_data in sentences[:count]:
            sent_text = sent_data['sentence']
            doc = nlp(sent_text)
            
            # Find suitable words based on type and language
            candidates = []
            
            if type == "artikel":
                # Use language-specific articles
                articles = lang_config['articles']
                candidates = [
                    token for token in doc
                    if token.text.lower() in articles
                ]
            elif type == "verben":
                candidates = [
                    token for token in doc
                    if token.pos_ in ['VERB', 'AUX'] and not token.is_punct
                ]
            # ... other types ...
            
            if candidates:
                target = random.choice(candidates)
                
                # Create cloze test with language-specific options
                blanked_sentence = sent_text.replace(target.text, '_____')
                
                # Generate language-appropriate distractors
                if type == "artikel":
                    options = [target.text] + [
                        art for art in lang_config['articles'] 
                        if art != target.text.lower()
                    ]
                else:
                    # Generic distractor generation
                    options = [target.text]  # Add more sophisticated generation
                
                random.shuffle(options)
                
                cloze_tests.append({
                    "sentence": blanked_sentence,
                    "cloze_word": target.text,
                    "options": options,
                    "original_sentence": sent_text,
                    "language": language
                })
        
        return {
            "video_id": video_id,
            "language": language,
            "cloze_tests": cloze_tests,
            "count": len(cloze_tests)
        }
        
    finally:
        cur.close()
        conn.close()

@app.get("/supported_languages")
def get_supported_languages():
    """Get list of supported languages and their status"""
    languages = []
    
    for lang_code, config in LANGUAGE_MODELS.items():
        languages.append({
            "code": lang_code,
            "name": config['name'],
            "model": config['model_name'],
            "installed": lang_code in loaded_models,
            "features": {
                "articles": len(config['articles']),
                "has_vectors": lang_code in loaded_models and loaded_models[lang_code].meta.get('vectors', False)
            }
        })
    
    return {
        "languages": languages,
        "default": DEFAULT_LANGUAGE,
        "total_configured": len(LANGUAGE_MODELS),
        "total_installed": len(loaded_models)
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)