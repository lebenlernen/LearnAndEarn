"""
Add sentence extraction endpoint to SpaCy API
"""

additional_endpoint = '''
@app.post("/extract_sentences")
async def extract_sentences(request: dict):
    """Extract sentences from text using SpaCy's sentence segmentation"""
    text = request.get("text", "")
    video_id = request.get("video_id", "")
    
    if not text:
        raise HTTPException(status_code=400, detail="Text is required")
    
    # Process text with SpaCy
    doc = nlp(text)
    
    # Extract sentences
    sentences = []
    for sent in doc.sents:
        sentence_text = sent.text.strip()
        # Filter out very short sentences and non-sentences
        if len(sentence_text) > 10 and any(char.isalpha() for char in sentence_text):
            sentences.append(sentence_text)
    
    return {
        "video_id": video_id,
        "sentences": sentences,
        "count": len(sentences)
    }
'''

print("Add this endpoint to your SpaCy FastAPI service:")
print(additional_endpoint)