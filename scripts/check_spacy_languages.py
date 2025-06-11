#!/usr/bin/env python3
"""
Check installed SpaCy language models and their capabilities
"""

import spacy
import subprocess
import sys

def check_installed_models():
    """Check which SpaCy models are currently installed"""
    print("Checking installed SpaCy models...\n")
    
    # Common language models to check
    models_to_check = [
        ('de_core_news_md', 'German'),
        ('en_core_web_md', 'English'),
        ('es_core_news_md', 'Spanish'),
        ('fr_core_news_md', 'French'),
        ('it_core_news_md', 'Italian'),
        ('pt_core_news_md', 'Portuguese'),
        ('nl_core_news_md', 'Dutch'),
        ('pl_core_news_md', 'Polish')
    ]
    
    installed_models = []
    
    for model_name, language in models_to_check:
        try:
            nlp = spacy.load(model_name)
            installed_models.append((model_name, language))
            print(f"✓ {language} ({model_name}) - INSTALLED")
            
            # Show model capabilities
            pipe_names = nlp.pipe_names
            print(f"  Components: {', '.join(pipe_names)}")
            print(f"  Vocabulary size: {len(nlp.vocab)}")
            print()
            
        except OSError:
            print(f"✗ {language} ({model_name}) - NOT INSTALLED")
            print(f"  To install: python -m spacy download {model_name}\n")
    
    return installed_models

def test_language_processing(model_name, test_sentences):
    """Test basic processing with a model"""
    try:
        nlp = spacy.load(model_name)
        print(f"\nTesting {model_name}:")
        
        for sentence in test_sentences:
            doc = nlp(sentence)
            print(f"\nSentence: {sentence}")
            print("Tokens and POS tags:")
            for token in doc:
                print(f"  {token.text:15} {token.pos_:10} {token.lemma_}")
            
            # Check for entities
            if doc.ents:
                print("Named Entities:")
                for ent in doc.ents:
                    print(f"  {ent.text} - {ent.label_}")
    
    except Exception as e:
        print(f"Error testing {model_name}: {e}")

def main():
    print("SpaCy Multi-Language Support Checker")
    print("=" * 50)
    
    # Check SpaCy version
    print(f"SpaCy version: {spacy.__version__}\n")
    
    # Check installed models
    installed = check_installed_models()
    
    # Test sentences for different languages
    test_data = {
        'de_core_news_md': [
            "Der schnelle braune Fuchs springt über den faulen Hund.",
            "Ich lerne Deutsch in Berlin."
        ],
        'en_core_web_md': [
            "The quick brown fox jumps over the lazy dog.",
            "I am learning English in London."
        ],
        'es_core_news_md': [
            "El rápido zorro marrón salta sobre el perro perezoso.",
            "Estoy aprendiendo español en Madrid."
        ],
        'fr_core_news_md': [
            "Le rapide renard brun saute par-dessus le chien paresseux.",
            "J'apprends le français à Paris."
        ]
    }
    
    # Test installed models
    if installed:
        print("\n" + "=" * 50)
        print("Testing installed models with sample sentences:")
        
        for model_name, language in installed:
            if model_name in test_data:
                test_language_processing(model_name, test_data[model_name])
    
    # Show how to enable multi-language support
    print("\n" + "=" * 50)
    print("To enable multi-language support in the application:")
    print("1. Install additional language models as needed")
    print("2. Update spacy_api_server.py to load multiple models")
    print("3. Update database with language_target information")
    print("4. Modify API endpoints to use appropriate language model")

if __name__ == "__main__":
    main()