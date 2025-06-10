// Lückentexte (Fill in the blanks) functionality
let currentVideo = null;
let currentSentences = [];
let currentExercise = null;
let currentLevel = 1;
let correctAnswers = {};
let currentBlankIndex = 0;
let recognition = null;
let isListening = false;
let currentExerciseType = 'artikel'; // Default to articles

// Word categories for different exercise types
const WORD_CATEGORIES = {
    artikel: {
        name: 'Artikel',
        words: ['der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines'],
        distractors: ['deren', 'dessen', 'denen', 'jeder', 'jede', 'jedes', 'dieser', 'diese', 'dieses'],
        checkWord: (word, pos) => {
            const cleanWord = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
            return WORD_CATEGORIES.artikel.words.includes(cleanWord);
        }
    },
    verben: {
        name: 'Verben',
        checkWord: (word, pos, lemma, token) => {
            // Check POS tag for verbs
            return pos === 'VERB' || pos === 'AUX';
        },
        needsSpacy: true
    },
    substantive: {
        name: 'Substantive',
        checkWord: (word, pos, lemma, token) => {
            // Check POS tag for nouns
            return pos === 'NOUN' || pos === 'PROPN';
        },
        needsSpacy: true
    },
    schwierig: {
        name: 'Schwierige Wörter',
        checkWord: (word, pos, lemma, token) => {
            // Words longer than 8 characters or compound words
            return word.length > 8 || word.includes('-');
        }
    },
    spaced: {
        name: 'Spaced Repetition Wörter',
        words: [], // Will be populated from user's due words
        checkWord: (word, pos, lemma) => {
            // Check if word is in user's spaced repetition list
            return WORD_CATEGORIES.spaced.words.includes(lemma || word.toLowerCase());
        },
        needsUserData: true
    }
};

// For backward compatibility
const ARTICLES = WORD_CATEGORIES.artikel;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authData = await checkAuth();
    
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Update header
    updateAuthUI();
    
    // Load videos
    await loadVideos();
    
    // Setup event listeners
    setupEventListeners();
    
    // Setup speech recognition
    setupSpeechRecognition();
    
    // Load spaced repetition words if logged in
    if (authData.authenticated) {
        loadSpacedRepetitionWords();
    }
});

// Load available videos
async function loadVideos() {
    try {
        const response = await fetch('/api/videos/search?limit=100', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) throw new Error('Failed to load videos');
        
        const data = await response.json();
        const videos = data.videos || [];
        
        const select = document.getElementById('videoSelect');
        select.innerHTML = '<option value="">Wählen Sie ein Video...</option>';
        
        videos.forEach(video => {
            const option = document.createElement('option');
            option.value = video.id;
            option.textContent = video.title;
            select.appendChild(option);
        });
    } catch (error) {
        console.error('Error loading videos:', error);
        showError('Fehler beim Laden der Videos');
    }
}

// Setup event listeners
function setupEventListeners() {
    // Video selection
    document.getElementById('videoSelect').addEventListener('change', loadVideoContent);
    
    // Exercise type buttons
    document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentExerciseType = btn.dataset.type;
            console.log('Selected exercise type:', currentExerciseType);
            updateInstructions();
            
            // Reload exercise if video is selected
            if (currentVideo && currentSentences.length > 0) {
                createExercise();
            }
        });
    });
    
    // Difficulty level buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentLevel = parseInt(btn.dataset.level);
            document.getElementById('currentLevel').textContent = currentLevel;
            updateInstructions();
            if (currentExercise) {
                displayExercise();
            }
        });
    });
    
    // Dictation modal close button
    const closeButton = document.querySelector('.close-button');
    if (closeButton) {
        closeButton.addEventListener('click', () => {
            document.getElementById('dictationModal').style.display = 'none';
            stopSpeechRecognition();
        });
    }
}

// Update instructions based on level and type
function updateInstructions() {
    const instructionText = document.getElementById('instructionText');
    const category = WORD_CATEGORIES[currentExerciseType];
    const wordType = category.name;
    
    switch (currentLevel) {
        case 1:
            instructionText.textContent = `Ziehen Sie die ${wordType} in die Lücken.`;
            break;
        case 2:
            instructionText.textContent = `Ziehen Sie die richtigen ${wordType} in die Lücken. Achtung: Es gibt zusätzliche Wörter!`;
            break;
        case 3:
            instructionText.textContent = `Klicken Sie auf eine Lücke und sprechen oder tippen Sie das fehlende Wort.`;
            break;
    }
}

// Load video content
async function loadVideoContent() {
    const videoId = document.getElementById('videoSelect').value;
    if (!videoId) return;
    
    const exerciseContent = document.getElementById('exerciseContent');
    exerciseContent.innerHTML = '<div class="loading"><div class="spinner"></div><p>Lade Sätze...</p></div>';
    
    try {
        // First, try to get sentences from the database
        const sentencesResponse = await fetch(`/api/spacy/sentences/${videoId}`, {
            credentials: 'same-origin'
        });
        
        if (sentencesResponse.ok) {
            const sentencesData = await sentencesResponse.json();
            console.log('Loaded sentences from database:', sentencesData);
            
            if (sentencesData.success && sentencesData.data.sentences.length > 0) {
                // Use sentences from database
                const allSentences = sentencesData.data.sentences.map(s => s.sentence);
                
                // For types that need SpaCy data, we need to process differently
                if (currentExerciseType === 'artikel' || currentExerciseType === 'schwierig') {
                    // Can filter without SpaCy data
                    currentSentences = filterSentencesForType(allSentences, currentExerciseType);
                } else {
                    // For verbs, nouns, etc., we need all sentences and will filter during exercise creation
                    currentSentences = allSentences.filter(s => s.split(/\s+/).length >= 5);
                }
                
                console.log(`Sentences for ${currentExerciseType}:`, currentSentences.length);
                
                if (currentSentences.length > 0) {
                    // Load video details for the title
                    const videoResponse = await fetch(`/api/videos/${videoId}`, {
                        credentials: 'same-origin'
                    });
                    if (videoResponse.ok) {
                        currentVideo = await videoResponse.json();
                    }
                    createExercise();
                } else {
                    showError(`Keine Sätze mit ${WORD_CATEGORIES[currentExerciseType].name} in diesem Video gefunden.`);
                }
                return;
            }
        }
        
        // Fallback: Load video and extract from pure_subtitle
        const response = await fetch(`/api/videos/${videoId}`, {
            credentials: 'same-origin'
        });
        
        if (!response.ok) throw new Error('Failed to load video');
        
        currentVideo = await response.json();
        
        // Try pure_subtitle first, then summary
        const textSource = currentVideo.pure_subtitle || currentVideo.subtitle || currentVideo.summary;
        
        if (textSource) {
            currentSentences = extractSentences(textSource);
            console.log('Extracted sentences from text:', currentSentences.length);
            console.log('First 3 sentences:', currentSentences.slice(0, 3));
            
            if (currentSentences.length > 0) {
                createExercise();
            } else {
                showError(`Keine Sätze mit ${WORD_CATEGORIES[currentExerciseType].name} gefunden. Bitte wählen Sie ein anderes Video oder einen anderen Übungstyp.`);
            }
        } else {
            showError('Kein Text für dieses Video verfügbar.');
        }
    } catch (error) {
        console.error('Error loading video content:', error);
        showError('Fehler beim Laden des Videos');
    }
}

// Extract sentences from text
function extractSentences(text) {
    // Split by sentence endings
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
    
    console.log('Total sentences found:', sentences.length);
    
    // Filter based on exercise type
    const filtered = filterSentencesForType(sentences.map(s => s.trim()), currentExerciseType);
    
    console.log(`Sentences suitable for ${currentExerciseType}:`, filtered.length);
    return filtered;
}

// Filter sentences based on exercise type
function filterSentencesForType(sentences, type) {
    const category = WORD_CATEGORIES[type];
    
    if (type === 'artikel') {
        // Filter sentences that contain articles
        return sentences.filter(sentence => {
            const words = sentence.toLowerCase().split(/\s+/);
            return words.some(word => {
                const cleanWord = word.replace(/[.,!?;:'"]/g, '');
                return category.words.includes(cleanWord);
            });
        });
    } else if (type === 'schwierig') {
        // All sentences with long words
        return sentences.filter(sentence => {
            const words = sentence.split(/\s+/);
            return words.some(word => {
                const cleanWord = word.replace(/[.,!?;:'"]/g, '');
                return cleanWord.length > 8;
            });
        });
    } else {
        // For other types, we need SpaCy data, so return all sentences
        return sentences.filter(s => s.split(/\s+/).length >= 5);
    }
}

// Create exercise from sentences
function createExercise() {
    // Select a random sentence
    const randomIndex = Math.floor(Math.random() * currentSentences.length);
    const sentence = currentSentences[randomIndex];
    
    // Find and replace articles
    const words = sentence.split(/\s+/);
    const blanks = [];
    correctAnswers = {};
    currentBlankIndex = 0;
    
    const processedWords = words.map((word, index) => {
        const cleanWord = word.toLowerCase().replace(/[.,!?;:'"]/g, '');
        const punctuation = word.match(/[.,!?;:'"]+$/)?.[0] || '';
        const category = WORD_CATEGORIES[currentExerciseType];
        
        // Check if this word should be removed based on exercise type
        let shouldRemove = false;
        
        if (category.checkWord) {
            shouldRemove = category.checkWord(word, null, null, null);
        }
        
        if (shouldRemove) {
            const blankId = `blank-${currentBlankIndex}`;
            blanks.push({
                id: blankId,
                correctAnswer: word.replace(/[.,!?;:'"]/g, ''),
                index: currentBlankIndex
            });
            correctAnswers[blankId] = word.replace(/[.,!?;:'"]/g, '');
            currentBlankIndex++;
            return `<span class="blank-space" id="${blankId}" data-index="${index}"></span>${punctuation}`;
        }
        return word;
    });
    
    currentExercise = {
        sentence: processedWords.join(' '),
        blanks: blanks,
        originalSentence: sentence
    };
    
    console.log('Created exercise:', {
        originalSentence: sentence,
        blanksFound: blanks.length,
        articles: blanks.map(b => b.correctAnswer)
    });
    
    if (blanks.length === 0) {
        // No articles found in this sentence, try another
        console.log('No articles found in sentence, trying another...');
        if (currentSentences.length > 1) {
            currentSentences.splice(randomIndex, 1); // Remove this sentence
            createExercise(); // Try again
            return;
        }
    }
    
    displayExercise();
}

// Display the exercise
function displayExercise() {
    const exerciseContent = document.getElementById('exerciseContent');
    
    console.log('Displaying exercise with', currentExercise.blanks.length, 'blanks');
    
    let html = `<div class="sentence-exercise">${currentExercise.sentence}</div>`;
    
    if (currentLevel < 3) {
        // Level 1 and 2: Show drag options
        const options = getOptionsForLevel();
        console.log('Options for dragging:', options);
        
        if (options.length > 0) {
            html += '<div class="options-area" id="optionsArea">';
            html += '<p style="text-align: center; color: #666; margin-bottom: 10px;">Ziehen Sie die Artikel in die Lücken:</p>';
            options.forEach((option, index) => {
                html += `<div class="draggable-word" draggable="true" data-word="${option}" id="option-${index}">${option}</div>`;
            });
            html += '</div>';
        } else {
            html += '<div class="options-area" id="optionsArea">';
            html += '<p style="color: red;">Keine Artikel zum Ziehen gefunden!</p>';
            html += '</div>';
        }
    } else {
        // Level 3: Show dictation prompt
        html += '<div class="dictation-input-area">';
        html += '<p>Klicken Sie auf eine Lücke, um den Artikel zu diktieren oder einzugeben.</p>';
        html += '</div>';
    }
    
    exerciseContent.innerHTML = html;
    
    // Show control buttons
    document.getElementById('controlButtons').style.display = 'flex';
    document.getElementById('scoreDisplay').style.display = 'block';
    updateScore();
    
    // Setup interactions based on level
    if (currentLevel < 3) {
        setupDragAndDrop();
    } else {
        setupDictationMode();
    }
}

// Get options based on difficulty level
function getOptionsForLevel() {
    const correctWords = currentExercise.blanks.map(b => b.correctAnswer);
    const category = WORD_CATEGORIES[currentExerciseType];
    
    if (currentLevel === 1) {
        // Level 1: Only correct words (shuffled)
        return [...new Set(correctWords)].sort(() => Math.random() - 0.5);
    } else {
        // Level 2: Correct words + distractors
        const allOptions = [...new Set(correctWords)];
        
        // Add distractors based on type
        if (currentExerciseType === 'artikel' && category.distractors) {
            // Use predefined distractors for articles
            const numDistractors = Math.min(correctWords.length + 2, 5);
            const availableDistractors = category.distractors.filter(d => !allOptions.includes(d));
            
            for (let i = 0; i < numDistractors && availableDistractors.length > 0; i++) {
                const randomIndex = Math.floor(Math.random() * availableDistractors.length);
                allOptions.push(availableDistractors[randomIndex]);
                availableDistractors.splice(randomIndex, 1);
            }
        } else {
            // For other types, generate distractors from vocabulary
            // This would ideally come from the vocabulary database
            const distractors = generateDistractorsForType(currentExerciseType, correctWords);
            allOptions.push(...distractors);
        }
        
        return allOptions.sort(() => Math.random() - 0.5);
    }
}

// Generate distractors for different word types
function generateDistractorsForType(type, correctWords) {
    // This is a simplified version - ideally would use vocabulary from database
    const distractors = [];
    
    switch(type) {
        case 'verben':
            distractors.push('machen', 'gehen', 'kommen', 'sehen', 'geben');
            break;
        case 'substantive':
            distractors.push('Mann', 'Frau', 'Kind', 'Haus', 'Auto');
            break;
        case 'schwierig':
            distractors.push('Geschwindigkeit', 'Verantwortung', 'Entwicklung', 'Wissenschaft');
            break;
    }
    
    // Filter out any that are already in correct words
    return distractors.filter(d => !correctWords.includes(d)).slice(0, 3);
}

// Setup drag and drop
function setupDragAndDrop() {
    const draggables = document.querySelectorAll('.draggable-word');
    const blanks = document.querySelectorAll('.blank-space');
    
    draggables.forEach(draggable => {
        draggable.addEventListener('dragstart', handleDragStart);
        draggable.addEventListener('dragend', handleDragEnd);
    });
    
    blanks.forEach(blank => {
        blank.addEventListener('dragover', handleDragOver);
        blank.addEventListener('drop', handleDrop);
        blank.addEventListener('click', handleBlankClick);
    });
}

// Drag start
function handleDragStart(e) {
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', e.target.dataset.word);
    e.dataTransfer.setData('elementId', e.target.id);
    e.target.classList.add('dragging');
}

// Drag end
function handleDragEnd(e) {
    e.target.classList.remove('dragging');
}

// Drag over
function handleDragOver(e) {
    if (e.preventDefault) {
        e.preventDefault();
    }
    e.dataTransfer.dropEffect = 'move';
    return false;
}

// Drop
function handleDrop(e) {
    if (e.stopPropagation) {
        e.stopPropagation();
    }
    e.preventDefault();
    
    const word = e.dataTransfer.getData('text/plain');
    const elementId = e.dataTransfer.getData('elementId');
    const blank = e.target;
    
    // Clear previous content
    blank.textContent = word;
    blank.classList.add('filled');
    blank.dataset.word = word;
    
    // Mark the draggable as used
    const draggable = document.getElementById(elementId);
    if (draggable) {
        draggable.classList.add('used');
    }
    
    return false;
}

// Handle blank click (for level 3 or to clear)
function handleBlankClick(e) {
    const blank = e.target;
    
    if (currentLevel === 3) {
        // Open dictation modal
        openDictationForBlank(blank);
    } else if (blank.textContent) {
        // Clear the blank
        const word = blank.dataset.word;
        blank.textContent = '';
        blank.classList.remove('filled', 'correct', 'incorrect');
        delete blank.dataset.word;
        
        // Un-mark the draggable
        const draggables = document.querySelectorAll(`.draggable-word[data-word="${word}"]`);
        draggables.forEach(d => d.classList.remove('used'));
    }
}

// Setup dictation mode for level 3
function setupDictationMode() {
    const blanks = document.querySelectorAll('.blank-space');
    blanks.forEach(blank => {
        blank.addEventListener('click', () => openDictationForBlank(blank));
    });
}

// Open dictation modal for a specific blank
function openDictationForBlank(blank) {
    const modal = document.getElementById('dictationModal');
    const sentenceDisplay = document.getElementById('sentenceDisplay');
    
    // Store current blank
    window.currentDictationBlank = blank;
    
    // Display sentence with highlighted blank
    const sentence = currentExercise.originalSentence;
    sentenceDisplay.innerHTML = sentence.replace(
        correctAnswers[blank.id],
        `<span style="background: yellow; padding: 2px 8px; border-radius: 4px;">_____</span>`
    );
    
    // Clear previous results
    document.getElementById('transcribedText').textContent = '';
    
    modal.style.display = 'block';
}

// Submit dictation
window.submitDictation = function() {
    const transcribedText = document.getElementById('transcribedText').textContent.trim();
    if (transcribedText && window.currentDictationBlank) {
        window.currentDictationBlank.textContent = transcribedText;
        window.currentDictationBlank.classList.add('filled');
        window.currentDictationBlank.dataset.word = transcribedText;
        
        document.getElementById('dictationModal').style.display = 'none';
        stopSpeechRecognition();
    }
};

// Check answers
window.checkAnswers = function() {
    let correct = 0;
    let total = 0;
    
    const blanks = document.querySelectorAll('.blank-space');
    blanks.forEach(blank => {
        total++;
        const userAnswer = blank.textContent.trim().toLowerCase();
        const correctAnswer = correctAnswers[blank.id].toLowerCase();
        
        if (userAnswer === correctAnswer) {
            blank.classList.add('correct');
            blank.classList.remove('incorrect');
            correct++;
        } else {
            blank.classList.add('incorrect');
            blank.classList.remove('correct');
            
            // Show correct answer on hover
            blank.title = `Richtig: ${correctAnswers[blank.id]}`;
        }
    });
    
    // Update score
    document.getElementById('correctCount').textContent = correct;
    document.getElementById('totalCount').textContent = total;
    
    // Show feedback
    const feedbackMessage = document.getElementById('feedbackMessage');
    if (correct === total) {
        feedbackMessage.textContent = 'Ausgezeichnet! Alle Antworten sind richtig!';
        feedbackMessage.className = 'feedback-message success';
        document.querySelector('.btn-next').style.display = 'inline-block';
    } else {
        feedbackMessage.textContent = `${correct} von ${total} richtig. Versuchen Sie es noch einmal!`;
        feedbackMessage.className = 'feedback-message error';
    }
};

// Reset exercise
window.resetExercise = function() {
    const blanks = document.querySelectorAll('.blank-space');
    blanks.forEach(blank => {
        blank.textContent = '';
        blank.classList.remove('filled', 'correct', 'incorrect');
        delete blank.dataset.word;
        blank.title = '';
    });
    
    const draggables = document.querySelectorAll('.draggable-word');
    draggables.forEach(d => d.classList.remove('used'));
    
    document.getElementById('feedbackMessage').style.display = 'none';
    document.querySelector('.btn-next').style.display = 'none';
    
    updateScore();
};

// Next exercise
window.nextExercise = function() {
    document.getElementById('feedbackMessage').style.display = 'none';
    document.querySelector('.btn-next').style.display = 'none';
    
    if (currentSentences.length > 0) {
        createExercise();
    }
};

// Update score display
function updateScore() {
    const blanks = document.querySelectorAll('.blank-space');
    const filled = document.querySelectorAll('.blank-space.filled');
    
    document.getElementById('correctCount').textContent = filled.length;
    document.getElementById('totalCount').textContent = blanks.length;
}

// Show error message
function showError(message) {
    const exerciseContent = document.getElementById('exerciseContent');
    exerciseContent.innerHTML = `
        <div style="background: #ffebee; color: #c62828; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <strong>Fehler:</strong> ${message}
        </div>
        <div style="padding: 20px; background: #f5f5f5; border-radius: 8px;">
            <p>Tipps:</p>
            <ul>
                <li>Wählen Sie ein Video mit deutscher Zusammenfassung</li>
                <li>Die Übung sucht nach deutschen Artikeln (der, die, das, ein, eine, etc.)</li>
                <li>Versuchen Sie es mit einem anderen Video</li>
            </ul>
        </div>
    `;
    
    // Hide control buttons when there's an error
    document.getElementById('controlButtons').style.display = 'none';
    document.getElementById('scoreDisplay').style.display = 'none';
}

// Speech recognition setup
function setupSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        console.log('Speech recognition not supported');
        return;
    }
    
    recognition = new SpeechRecognition();
    recognition.lang = 'de-DE';
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    
    recognition.onstart = () => {
        isListening = true;
        document.getElementById('startSpeechButton').innerHTML = '<span class="mic-icon">🔴</span> Aufnahme läuft...';
        document.getElementById('listeningIndicator').style.display = 'block';
    };
    
    recognition.onresult = (event) => {
        let finalTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            }
        }
        
        if (finalTranscript) {
            document.getElementById('transcribedText').textContent = finalTranscript.trim();
        }
    };
    
    recognition.onerror = (event) => {
        console.error('Speech recognition error:', event.error);
        stopSpeechRecognition();
    };
    
    recognition.onend = () => {
        stopSpeechRecognition();
    };
    
    // Setup speech button
    document.getElementById('startSpeechButton').addEventListener('click', toggleSpeechRecognition);
}

// Toggle speech recognition
function toggleSpeechRecognition() {
    if (isListening) {
        stopSpeechRecognition();
    } else {
        startSpeechRecognition();
    }
}

// Start speech recognition
function startSpeechRecognition() {
    if (recognition) {
        recognition.start();
    }
}

// Stop speech recognition
function stopSpeechRecognition() {
    if (recognition) {
        recognition.stop();
    }
    isListening = false;
    document.getElementById('startSpeechButton').innerHTML = '<span class="mic-icon">🎤</span> Sprechen beginnen';
    document.getElementById('listeningIndicator').style.display = 'none';
}

// Play sentence audio
document.getElementById('playButton')?.addEventListener('click', () => {
    const sentence = currentExercise?.originalSentence;
    if (sentence && 'speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(sentence);
        utterance.lang = 'de-DE';
        utterance.rate = 0.9;
        speechSynthesis.speak(utterance);
    }
});

// Load spaced repetition words for the user
async function loadSpacedRepetitionWords() {
    try {
        const response = await fetch('/api/spacy/vocabulary-due?limit=50', {
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            const data = await response.json();
            if (data.success && data.words) {
                // Store the words for spaced repetition exercise type
                WORD_CATEGORIES.spaced.words = data.words.map(w => w.lemma || w.word);
                console.log('Loaded', WORD_CATEGORIES.spaced.words.length, 'spaced repetition words');
                
                // Enable/disable spaced button based on available words
                const spacedBtn = document.querySelector('[data-type="spaced"]');
                if (spacedBtn) {
                    if (WORD_CATEGORIES.spaced.words.length === 0) {
                        spacedBtn.disabled = true;
                        spacedBtn.title = 'Keine Wörter zur Wiederholung fällig';
                    } else {
                        spacedBtn.disabled = false;
                        spacedBtn.title = `${WORD_CATEGORIES.spaced.words.length} Wörter zur Wiederholung`;
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error loading spaced repetition words:', error);
    }
}