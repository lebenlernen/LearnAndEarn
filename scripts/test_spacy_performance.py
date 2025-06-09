#!/usr/bin/env python3
"""
Test SpaCy Performance auf Apple Silicon M4
Testet das mittlere deutsche Modell (de_core_news_md)
"""

import spacy
import time
import psutil
import platform

def get_system_info():
    """Zeigt System-Informationen"""
    print("=== System Information ===")
    print(f"Platform: {platform.platform()}")
    print(f"Processor: {platform.processor()}")
    print(f"Python: {platform.python_version()}")
    print(f"RAM: {psutil.virtual_memory().total / (1024**3):.1f} GB")
    print()

def test_spacy_performance():
    """Testet SpaCy Performance mit deutschem Text"""
    print("=== Loading de_core_news_md ===")
    start_time = time.time()
    nlp = spacy.load("de_core_news_md")
    load_time = time.time() - start_time
    print(f"Model loaded in {load_time:.2f} seconds")
    print(f"Model size: ~43 MB")
    print()
    
    # Test-Texte
    test_texts = [
        "Die deutsche Sprache ist eine der meistgesprochenen Sprachen in Europa.",
        "Berlin ist die Hauptstadt von Deutschland und hat über 3,7 Millionen Einwohner.",
        "Der Rhein ist mit 1.233 Kilometern Länge einer der längsten Flüsse Europas.",
        "Die Bundesrepublik Deutschland wurde am 23. Mai 1949 gegründet.",
        "München ist bekannt für das Oktoberfest und seine historische Altstadt."
    ]
    
    print("=== Processing Performance ===")
    
    # Einzelne Dokumente verarbeiten
    single_times = []
    for text in test_texts:
        start = time.time()
        doc = nlp(text)
        elapsed = time.time() - start
        single_times.append(elapsed)
        print(f"Text ({len(text)} chars): {elapsed*1000:.2f} ms")
    
    print(f"\nAverage single doc: {sum(single_times)/len(single_times)*1000:.2f} ms")
    
    # Batch-Verarbeitung
    print("\n=== Batch Processing ===")
    start = time.time()
    docs = list(nlp.pipe(test_texts * 100))  # 500 Dokumente
    batch_time = time.time() - start
    print(f"500 documents processed in {batch_time:.2f} seconds")
    print(f"Throughput: {500/batch_time:.1f} docs/second")
    
    # Memory usage
    print(f"\n=== Memory Usage ===")
    print(f"Current memory: {psutil.Process().memory_info().rss / (1024**2):.1f} MB")
    
    # Feature extraction example
    print("\n=== Feature Extraction Example ===")
    doc = nlp("Angela Merkel war von 2005 bis 2021 Bundeskanzlerin von Deutschland.")
    
    print("Entities:")
    for ent in doc.ents:
        print(f"  - {ent.text}: {ent.label_}")
    
    print("\nPOS Tags:")
    for token in doc[:5]:
        print(f"  - {token.text}: {token.pos_}")
    
    print("\nDependencies:")
    for token in doc[:5]:
        print(f"  - {token.text} -> {token.dep_}")

if __name__ == "__main__":
    get_system_info()
    
    try:
        test_spacy_performance()
    except Exception as e:
        print(f"Error: {e}")
        print("\nPlease install SpaCy and the German model first:")
        print("pip install spacy[apple]")
        print("python -m spacy download de_core_news_md") 