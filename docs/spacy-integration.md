# SpaCy Integration for LearnAndEarn

## Natural Language Processing für Deutsches Vokabular

### Was ist SpaCy?

SpaCy ist eine moderne NLP-Bibliothek, die speziell für Produktionsumgebungen entwickelt wurde. Für LearnAndEarn bietet SpaCy:

- **Schnelle Verarbeitung** von deutschen Texten
- **Präzise linguistische Analyse** (Lemmatisierung, POS-Tagging)
- **Vortrainierte Modelle** für Deutsch
- **Integration mit Machine Learning** für Schwierigkeitsbestimmung

### Warum SpaCy für LearnAndEarn?

#### 1. **Lemmatisierung** - Das Kernproblem lösen
```python
# Beispiel: Verschiedene Formen → Eine Grundform
"gehe", "gehst", "geht", "ging", "gegangen" → "gehen"
"Häuser", "Hauses", "Häusern" → "Haus"
```

Dies löst das Problem der Mehrfachbedeutungen und Wortformen in `our_vocabulary_list`.

#### 2. **Part-of-Speech (POS) Tagging**
```python
# Wortarten identifizieren
"Bank" + NOUN → Sitzbank
"Bank" + NOUN + Kontext(Geld) → Geldinstitut
"laufen" + VERB → to run
"Laufen" + NOUN → the running
```

#### 3. **Schwierigkeitsbestimmung**
- Wortlänge
- Häufigkeit im Korpus
- Morphologische Komplexität
- Zusammengesetzte Wörter erkennen

### Installation und Setup

```bash
# SpaCy installieren
pip install spacy

# Deutsches Sprachmodell herunterladen
python -m spacy download de_core_news_sm

# Für bessere Genauigkeit (größeres Modell)
python -m spacy download de_core_news_lg
```

### Integration in LearnAndEarn

#### Phase 1: Analyse der bestehenden Daten
```python
# Analysiere our_word_list
# - Extrahiere alle einzigartigen Wörter
# - Finde Lemmas (Grundformen)
# - Identifiziere Wortarten
# - Zähle Häufigkeiten
```

#### Phase 2: Erweiterte Vokabeltabelle
```sql
CREATE TABLE our_vocabulary_enhanced (
    id SERIAL PRIMARY KEY,
    original_word VARCHAR(255),      -- "gegangen"
    lemma VARCHAR(255),              -- "gehen"
    pos VARCHAR(50),                 -- "VERB"
    tag VARCHAR(50),                 -- "VVPP" (past participle)
    frequency INTEGER,               -- Wie oft im Korpus
    difficulty_score FLOAT,          -- 0.0 - 1.0
    example_sentence TEXT,           -- Kontext
    video_ids TEXT[]                 -- Array von Video IDs
);
```

#### Phase 3: Intelligente Wortgruppierung
```python
# Gruppiere verwandte Wörter
word_families = {
    "gehen": ["gehe", "gehst", "geht", "ging", "gegangen"],
    "Haus": ["Haus", "Hauses", "Häuser", "Häusern"],
}
```

### Praktische Anwendungen

#### 1. **Vokabel-Deduplizierung**
Statt 10 Einträge für "gehen" → 1 Eintrag mit allen Formen

#### 2. **Kontextbasierte Übersetzung**
```python
def get_translation(word, context_sentence):
    doc = nlp(context_sentence)
    # Analysiere Kontext für bessere Übersetzung
    # "Bank" im Finanzkontext vs. Parkkontext
```

#### 3. **Spaced Repetition Optimierung**
- Häufige Wörter → längere Intervalle
- Seltene/schwierige Wörter → kürzere Intervalle
- Verwandte Wörter → gemeinsam üben

#### 4. **Automatische Schwierigkeitseinstufung**
```python
def calculate_difficulty(word_info):
    score = 0.0
    
    # Länge
    if len(word_info['original']) > 10:
        score += 0.2
    
    # Zusammengesetzt?
    if word_info['tag'].startswith('NN') and '-' in word_info['original']:
        score += 0.3
    
    # Selten?
    if word_info['frequency'] < 100:
        score += 0.3
    
    return min(score, 1.0)
```

### Beispiel-Workflow

1. **Video-Upload** → YouTube Video wird verarbeitet
2. **Transkript-Extraktion** → Untertitel/Transkript
3. **SpaCy-Verarbeitung**:
   ```python
   doc = nlp(transcript)
   vocabulary = []
   
   for token in doc:
       if token.pos_ in ['NOUN', 'VERB', 'ADJ']:
           vocabulary.append({
               'word': token.text,
               'lemma': token.lemma_,
               'pos': token.pos_,
               'sentence': token.sent.text
           })
   ```
4. **Datenbank-Speicherung** mit allen linguistischen Informationen
5. **Intelligente Präsentation** im Vokabel-Trainer

### Vorteile für Lernende

1. **Keine Duplikate** - Jedes Wort nur einmal lernen
2. **Besserer Kontext** - Wörter mit Beispielsätzen
3. **Grammatik-Integration** - Wortart hilft beim Verstehen
4. **Effizienteres Lernen** - Fokus auf wichtige Wörter

### Nächste Schritte

1. **Pilot-Test**: SpaCy-Script auf 10 Videos anwenden
2. **Datenbank-Migration**: Enhanced vocabulary table erstellen
3. **API-Update**: Neue Endpoints für lemma-basierte Abfragen
4. **UI-Anpassung**: Wortfamilien in der Vokabelansicht

### Code-Beispiel: Vollständige Integration

```python
import spacy
from typing import List, Dict

class VocabularyProcessor:
    def __init__(self):
        self.nlp = spacy.load("de_core_news_lg")
        
    def process_video_vocabulary(self, video_id: str, word_list: str) -> List[Dict]:
        """Verarbeite Vokabelliste eines Videos mit SpaCy"""
        
        # Split comma-separated words
        words = [w.strip() for w in word_list.split(',')]
        
        processed_vocabulary = []
        
        for word in words:
            # Verarbeite mit SpaCy
            doc = self.nlp(word)
            
            for token in doc:
                if token.is_alpha and not token.is_stop:
                    vocab_entry = {
                        'video_id': video_id,
                        'original': token.text,
                        'lemma': token.lemma_,
                        'pos': token.pos_,
                        'tag': token.tag_,
                        'difficulty': self.calculate_difficulty(token)
                    }
                    processed_vocabulary.append(vocab_entry)
        
        return processed_vocabulary
    
    def calculate_difficulty(self, token) -> float:
        """Berechne Schwierigkeit basierend auf verschiedenen Faktoren"""
        # Implementierung...
        pass
```

### Fazit

SpaCy ermöglicht es LearnAndEarn, von einer einfachen Wortliste zu einem intelligenten, kontextbewussten Vokabeltrainer zu werden. Die linguistische Analyse verbessert nicht nur die Datenqualität, sondern auch das Lernerlebnis erheblich. 