#!/usr/bin/env python3
"""
Test des großen deutschen SpaCy-Modells (de_core_news_lg) auf Apple M4
"""

import spacy
import time
import psutil
import os

def test_large_model():
    print("=== SpaCy Large German Model Test ===")
    print(f"Model: de_core_news_lg (~568 MB)")
    print(f"System RAM: {psutil.virtual_memory().total / (1024**3):.1f} GB")
    print(f"Available RAM: {psutil.virtual_memory().available / (1024**3):.1f} GB")
    print()
    
    # Modell laden
    print("Loading model...")
    start_time = time.time()
    nlp = spacy.load("de_core_news_lg")
    load_time = time.time() - start_time
    print(f"✓ Model loaded in {load_time:.2f} seconds")
    
    # Memory nach dem Laden
    process = psutil.Process(os.getpid())
    memory_mb = process.memory_info().rss / (1024**2)
    print(f"✓ Memory usage: {memory_mb:.1f} MB")
    print()
    
    # Test mit komplexem deutschen Text
    test_text = """
    Die Bundesrepublik Deutschland ist ein föderaler Staat in Mitteleuropa. 
    Sie besteht aus 16 Bundesländern und ist als freiheitlich-demokratischer 
    und sozialer Rechtsstaat verfasst. Die 1949 gegründete Bundesrepublik 
    Deutschland stellt die jüngste Ausprägung des deutschen Nationalstaates dar. 
    Bundeshauptstadt und Regierungssitz ist Berlin. Deutschland grenzt an neun 
    Staaten, es hat Anteil an der Nord- und Ostsee im Norden sowie dem Bodensee 
    und den Alpen im Süden.
    """
    
    # Verarbeitung
    print("=== Processing Performance ===")
    start = time.time()
    doc = nlp(test_text)
    process_time = time.time() - start
    print(f"Text length: {len(test_text)} characters")
    print(f"Processing time: {process_time*1000:.2f} ms")
    print(f"Tokens/second: {len(doc)/(process_time):.0f}")
    print()
    
    # Feature-Extraktion
    print("=== Named Entities ===")
    for ent in doc.ents:
        print(f"  • {ent.text}: {ent.label_}")
    
    print("\n=== Noun Phrases ===")
    noun_phrases = [chunk.text for chunk in doc.noun_chunks]
    print(f"  Found {len(noun_phrases)} noun phrases")
    for np in noun_phrases[:5]:
        print(f"  • {np}")
    
    # Wortvektor-Qualität testen
    print("\n=== Word Vector Quality Test ===")
    test_words = ["Deutschland", "Berlin", "Bundesland", "Demokratie"]
    for word in test_words:
        token = nlp(word)[0]
        if token.has_vector:
            print(f"  • {word}: vector shape {token.vector.shape}, norm: {token.vector_norm:.2f}")
    
    # Ähnlichkeitstest
    print("\n=== Semantic Similarity ===")
    pairs = [
        ("Berlin", "Hauptstadt"),
        ("Deutschland", "Bundesrepublik"),
        ("Demokratie", "Freiheit"),
        ("Nord", "Süd")
    ]
    for w1, w2 in pairs:
        token1 = nlp(w1)[0]
        token2 = nlp(w2)[0]
        if token1.has_vector and token2.has_vector:
            similarity = token1.similarity(token2)
            print(f"  • {w1} ↔ {w2}: {similarity:.3f}")
    
    # Batch-Verarbeitung für Durchsatz
    print("\n=== Batch Processing Test ===")
    sentences = [
        "Angela Merkel war Bundeskanzlerin.",
        "Der Rhein fließt durch mehrere Bundesländer.",
        "München ist die Hauptstadt von Bayern.",
        "Die deutsche Wirtschaft ist exportorientiert.",
        "Das Grundgesetz wurde 1949 verabschiedet."
    ] * 20  # 100 Sätze
    
    start = time.time()
    docs = list(nlp.pipe(sentences, batch_size=50))
    batch_time = time.time() - start
    print(f"Processed {len(sentences)} sentences in {batch_time:.2f} seconds")
    print(f"Throughput: {len(sentences)/batch_time:.1f} sentences/second")
    
    # Finaler Speicherverbrauch
    final_memory = process.memory_info().rss / (1024**2)
    print(f"\n✓ Final memory usage: {final_memory:.1f} MB")
    print(f"✓ Memory increase: {final_memory - memory_mb:.1f} MB")

if __name__ == "__main__":
    try:
        test_large_model()
    except Exception as e:
        print(f"Error: {e}")
        print("\nMake sure the model is installed:")
        print("python3 -m spacy download de_core_news_lg") 