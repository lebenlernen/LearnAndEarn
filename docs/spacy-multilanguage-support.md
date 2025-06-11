# SpaCy Multi-Language Support Guide

## Current Setup
Currently, we're using SpaCy with the German model (`de_core_news_md`) for processing German language content.

## SpaCy Language Support

SpaCy supports **over 70 languages** with varying levels of support:

### Tier 1 Languages (Full Pipeline Support)
These languages have pre-trained models with full NLP pipeline support (tokenization, POS tagging, dependency parsing, NER):

- **English** (`en_core_web_sm/md/lg`)
- **German** (`de_core_news_sm/md/lg`) - Currently installed
- **Spanish** (`es_core_news_sm/md/lg`)
- **French** (`fr_core_news_sm/md/lg`)
- **Portuguese** (`pt_core_news_sm/md/lg`)
- **Italian** (`it_core_news_sm/md/lg`)
- **Dutch** (`nl_core_news_sm/md/lg`)
- **Greek** (`el_core_news_sm/md/lg`)
- **Chinese** (`zh_core_web_sm/md/lg`)
- **Japanese** (`ja_core_news_sm/md/lg`)
- **Russian** (`ru_core_news_sm/md/lg`)
- **Polish** (`pl_core_news_sm/md/lg`)
- **Danish** (`da_core_news_sm/md/lg`)
- **Romanian** (`ro_core_news_sm/md/lg`)
- **Norwegian** (`nb_core_news_sm/md/lg`)
- **Swedish** (`sv_core_news_sm/md/lg`)
- **Finnish** (`fi_core_news_sm/md/lg`)
- **Korean** (`ko_core_news_sm/md/lg`)

### Installation for Additional Languages

To add support for another language, you need to:

1. **Install the language model**:
```bash
# Example for Spanish
python -m spacy download es_core_news_md

# Example for French
python -m spacy download fr_core_news_md

# Example for English
python -m spacy download en_core_web_md
```

2. **Update the SpaCy API server** (`spacy_api_server.py`):
```python
# Current code (single language)
MODEL_NAME = "de_core_news_md"
nlp = spacy.load(MODEL_NAME)

# Multi-language support
MODELS = {
    'de': spacy.load("de_core_news_md"),
    'en': spacy.load("en_core_web_md"),
    'es': spacy.load("es_core_news_md"),
    'fr': spacy.load("fr_core_news_md")
}

def get_nlp_model(language):
    return MODELS.get(language, MODELS['de'])  # Default to German
```

## Database Schema Updates Needed

1. **Update API endpoints** to accept language parameter:
```python
@app.post("/process_video")
async def process_video(request: ProcessVideoRequest):
    # Get language from video
    language_target = video.get('language_target', 'de')
    nlp = get_nlp_model(language_target)
    # Process with appropriate model
```

2. **Update cloze test generation** to be language-aware:
```python
# Language-specific article lists
ARTICLES = {
    'de': ['der', 'die', 'das', 'den', 'dem', 'des'],
    'en': ['the', 'a', 'an'],
    'es': ['el', 'la', 'los', 'las', 'un', 'una'],
    'fr': ['le', 'la', 'les', 'un', 'une', 'des']
}
```

## Model Size Comparison

- **Small (sm)**: ~15-25 MB - Basic tokenization and POS tagging
- **Medium (md)**: ~40-50 MB - Includes word vectors (recommended)
- **Large (lg)**: ~400-800 MB - Best accuracy, includes larger word vectors

## Memory Requirements

Loading multiple language models simultaneously:
- Each medium model: ~200-500 MB RAM
- Recommended: Load models on-demand based on video language

## Implementation Strategy

1. **Phase 1**: Add language detection to video processing
2. **Phase 2**: Install commonly needed language models
3. **Phase 3**: Modify API to load appropriate model based on `language_target`
4. **Phase 4**: Update UI to show language-specific exercises

## Language-Specific Considerations

### Chinese/Japanese/Korean
- Require additional tokenization libraries
- No spaces between words, special handling needed

### Right-to-Left Languages (Arabic, Hebrew)
- Special UI considerations
- Limited SpaCy support currently

### Recommended Next Languages
Based on typical language learning patterns:
1. English (most requested)
2. Spanish (large learner base)
3. French (European focus)
4. Italian (similar to existing German infrastructure)