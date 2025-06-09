// Vocabulary Learning with Spaced Repetition
document.addEventListener('DOMContentLoaded', async () => {
    // Update auth UI
    await updateAuthUI();
    
    // Check authentication
    const authData = await checkAuth();
    if (!authData.authenticated) {
        window.location.href = '/login.html?redirect=/vocabulary.html';
        return;
    }
    
    // Initialize vocabulary system
    initializeVocabulary();
});

let currentMode = 'word'; // 'word' or 'sentence'
let currentWord = null;
let recognition = null;
let isRecording = false;

function initializeVocabulary() {
    // Mode switching
    const modeButtons = document.querySelectorAll('.mode-btn');
    modeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            modeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentMode = btn.dataset.mode;
            loadVocabulary();
        });
    });
    
    // Control buttons
    document.getElementById('speakBtn').addEventListener('click', speakWord);
    document.getElementById('showBtn').addEventListener('click', showTranslation);
    document.getElementById('recordBtn').addEventListener('click', toggleRecording);
    
    // Difficulty buttons
    document.querySelectorAll('.diff-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = parseInt(btn.dataset.difficulty);
            recordDifficulty(difficulty);
        });
    });
    
    // Initialize speech recognition
    initializeSpeechRecognition();
    
    // Check for video parameter
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('video');
    
    if (videoId) {
        loadVideoVocabulary(videoId);
    } else {
        // Load general vocabulary or show message
        showNoVocabularyMessage();
    }
}

function initializeSpeechRecognition() {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        recognition.lang = 'de-DE';
        recognition.continuous = false;
        recognition.interimResults = false;
        
        recognition.onresult = (event) => {
            const transcript = event.results[0][0].transcript;
            handleSpeechResult(transcript);
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            stopRecording();
            showTranscriptionResult('Error: ' + event.error, false);
        };
        
        recognition.onend = () => {
            stopRecording();
        };
    } else {
        console.error('Speech recognition not supported');
        document.getElementById('recordBtn').style.display = 'none';
    }
}

async function loadVideoVocabulary(videoId) {
    try {
        // First, let's explore the table structure
        const response = await fetch(`/api/vocabulary/video/${videoId}`, {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load vocabulary');
        }
        
        const data = await response.json();
        console.log('Vocabulary data:', data);
        
        // For now, show the structure
        if (data.words && data.words.length > 0) {
            showVocabularyContent();
            // Display first word
            displayWord(data.words[0]);
        } else {
            showNoVocabularyMessage('This video has no vocabulary available yet.');
        }
        
    } catch (error) {
        console.error('Error loading vocabulary:', error);
        showNoVocabularyMessage('Failed to load vocabulary.');
    }
}

function showVocabularyContent() {
    document.querySelector('.no-vocab-message').style.display = 'none';
    document.getElementById('vocabContent').style.display = 'block';
}

function showNoVocabularyMessage(message) {
    const noVocabDiv = document.querySelector('.no-vocab-message');
    if (message) {
        noVocabDiv.querySelector('p').textContent = message;
    }
    noVocabDiv.style.display = 'block';
    document.getElementById('vocabContent').style.display = 'none';
}

function displayWord(wordData) {
    currentWord = wordData;
    
    // For now, display whatever fields we have
    const wordDisplay = document.getElementById('wordDisplay');
    const contextDisplay = document.getElementById('wordContext');
    const translationDisplay = document.getElementById('wordTranslation');
    
    // Try to find the word field
    if (wordData.word) {
        wordDisplay.textContent = wordData.word;
    } else if (wordData.words) {
        // Might be a JSON field
        try {
            const words = JSON.parse(wordData.words);
            wordDisplay.textContent = words[0] || 'No word available';
        } catch {
            wordDisplay.textContent = wordData.words;
        }
    } else {
        wordDisplay.textContent = 'Word data structure unknown';
    }
    
    // Context (sentence)
    contextDisplay.textContent = wordData.sentence || wordData.context || '';
    
    // Translation (hidden initially)
    translationDisplay.textContent = wordData.translation || 'Translation not available';
    translationDisplay.style.display = 'none';
    
    // Reset UI
    document.getElementById('showBtn').textContent = 'Show Translation';
    document.getElementById('difficultyButtons').style.display = 'none';
    document.getElementById('transcriptionResult').style.display = 'none';
}

function speakWord() {
    if (!currentWord) return;
    
    const utterance = new SpeechSynthesisUtterance();
    utterance.lang = 'de-DE';
    
    if (currentMode === 'word') {
        utterance.text = document.getElementById('wordDisplay').textContent;
    } else {
        utterance.text = document.getElementById('wordContext').textContent;
    }
    
    utterance.rate = 0.8; // Slower for learning
    speechSynthesis.speak(utterance);
}

function showTranslation() {
    const translationDiv = document.getElementById('wordTranslation');
    const showBtn = document.getElementById('showBtn');
    
    if (translationDiv.style.display === 'none') {
        translationDiv.style.display = 'block';
        showBtn.textContent = 'Hide Translation';
        document.getElementById('difficultyButtons').style.display = 'flex';
    } else {
        translationDiv.style.display = 'none';
        showBtn.textContent = 'Show Translation';
        document.getElementById('difficultyButtons').style.display = 'none';
    }
}

function toggleRecording() {
    if (isRecording) {
        stopRecording();
    } else {
        startRecording();
    }
}

function startRecording() {
    if (!recognition) return;
    
    isRecording = true;
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.classList.add('recording');
    recordBtn.textContent = '⏹ Stop Speaking';
    
    recognition.start();
}

function stopRecording() {
    isRecording = false;
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.classList.remove('recording');
    recordBtn.textContent = '🎤 Start Speaking';
    
    if (recognition) {
        recognition.stop();
    }
}

function handleSpeechResult(transcript) {
    const expectedText = currentMode === 'word' 
        ? document.getElementById('wordDisplay').textContent 
        : document.getElementById('wordContext').textContent;
    
    const isCorrect = transcript.toLowerCase().trim() === expectedText.toLowerCase().trim();
    
    showTranscriptionResult(
        `You said: "${transcript}"`,
        isCorrect
    );
    
    if (isCorrect) {
        // Automatically show translation and difficulty buttons
        showTranslation();
    }
}

function showTranscriptionResult(message, isCorrect) {
    const resultDiv = document.getElementById('transcriptionResult');
    resultDiv.textContent = message;
    resultDiv.className = 'transcription-result ' + 
        (isCorrect ? 'transcription-correct' : 'transcription-incorrect');
    resultDiv.style.display = 'block';
}

async function recordDifficulty(difficulty) {
    // TODO: Save to database with spaced repetition algorithm
    console.log('Recording difficulty:', difficulty);
    
    // For now, just load next word
    loadNextWord();
}

function loadNextWord() {
    // TODO: Implement loading next word based on SRS algorithm
    showNoVocabularyMessage('More vocabulary coming soon!');
}

// Update stats
async function updateStats() {
    // TODO: Fetch from database
    document.getElementById('newWords').textContent = '0';
    document.getElementById('reviewWords').textContent = '0';
    document.getElementById('masteredWords').textContent = '0';
} 