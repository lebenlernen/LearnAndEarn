// Enhanced fill-in-the-blanks that uses SpaCy data from database
async function createExerciseWithSpacy() {
    if (!currentVideo || currentSentences.length === 0) return;
    
    // Select a random sentence
    const randomIndex = Math.floor(Math.random() * currentSentences.length);
    const sentenceData = currentSentences[randomIndex];
    
    // If we have sentence ID, fetch tokens from database
    if (sentenceData.id) {
        try {
            const response = await fetch(`/api/spacy/sentence-tokens/${sentenceData.id}`, {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.success && data.tokens) {
                    createExerciseFromTokens(sentenceData.sentence || sentenceData.text, data.tokens);
                    return;
                }
            }
        } catch (error) {
            console.log('Failed to fetch tokens, using fallback');
        }
    }
    
    // Fallback to pattern-based detection
    createExercise();
}

function createExerciseFromTokens(sentence, tokens) {
    const blanks = [];
    correctAnswers = {};
    currentBlankIndex = 0;
    
    // Build sentence with blanks based on SpaCy tokens
    let processedSentence = '';
    let lastEnd = 0;
    
    tokens.forEach((token, index) => {
        // Add any text between tokens (spaces, etc.)
        if (token.token_index > lastEnd) {
            processedSentence += sentence.substring(lastEnd, token.token_index);
        }
        
        let shouldBlank = false;
        
        switch(currentExerciseType) {
            case 'artikel':
                // Check for articles (DET or ART tag)
                shouldBlank = token.pos === 'DET' || token.tag === 'ART' || 
                            ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines']
                            .includes(token.text.toLowerCase());
                break;
                
            case 'verben':
                // Verbs but not nominalized (check if capitalized)
                shouldBlank = (token.pos === 'VERB' || token.pos === 'AUX') && 
                            token.text[0] === token.text[0].toLowerCase();
                break;
                
            case 'substantive':
                // All nouns including nominalized verbs
                shouldBlank = token.pos === 'NOUN' || token.pos === 'PROPN';
                break;
                
            case 'adjektive':
                // Adjectives and adverbs
                shouldBlank = token.pos === 'ADJ' || token.pos === 'ADV';
                break;
                
            case 'schwierig':
                // Long or compound words
                shouldBlank = token.text.length > 8 || token.text.includes('-');
                break;
        }
        
        if (shouldBlank && !token.is_punct) {
            const blankId = `blank-${currentBlankIndex}`;
            blanks.push({
                id: blankId,
                correctAnswer: token.text,
                lemma: token.lemma,
                pos: token.pos,
                index: currentBlankIndex
            });
            correctAnswers[blankId] = token.text;
            currentBlankIndex++;
            processedSentence += `<span class="blank-space" id="${blankId}" data-index="${index}"></span>`;
        } else {
            processedSentence += token.text;
        }
        
        lastEnd = token.token_index + token.text.length;
    });
    
    // Add any remaining text
    if (lastEnd < sentence.length) {
        processedSentence += sentence.substring(lastEnd);
    }
    
    currentExercise = {
        sentence: processedSentence,
        blanks: blanks,
        originalSentence: sentence
    };
    
    console.log('Created SpaCy-based exercise:', {
        originalSentence: sentence,
        blanksFound: blanks.length,
        blanks: blanks.map(b => `${b.correctAnswer} (${b.pos})`)
    });
    
    if (blanks.length === 0) {
        // No matching words found, try another sentence
        console.log(`No ${currentExerciseType} found in sentence, trying another...`);
        if (currentSentences.length > 1) {
            currentSentences.splice(randomIndex, 1);
            createExerciseWithSpacy(); // Try again
            return;
        }
    }
    
    displayExercise();
}