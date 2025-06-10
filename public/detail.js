// Simple text-to-speech function that works
const speakText = (text, rate) => {
    console.log('speakText called with:', text, 'rate:', rate);
    
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    // Trim and clean the text
    const cleanText = text.trim();
    console.log('Clean text to speak:', cleanText);
    
    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'de-DE'; // German language
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    // Add event listeners for debugging
    utterance.onstart = () => {
        console.log('Speech started for text:', cleanText);
    };
    
    utterance.onend = () => {
        console.log('Speech ended');
    };
    
    utterance.onerror = (event) => {
        console.error('Speech error:', event);
    };
    
    speechSynthesis.speak(utterance);
};

// Make functions globally available
window.speakText = speakText;

// Load user settings
async function loadUserSettings() {
    try {
        const authData = await checkAuth();
        if (authData.authenticated) {
            // Fetch user profile to get dictation preference
            const response = await fetch('/api/auth/me');
            if (response.ok) {
                const userData = await response.json();
                window.useSystemDictation = userData.user.use_system_dictation || false;
                
                // Update UI based on preference
                updateDictationUI();
            }
        }
    } catch (error) {
        console.error('Error loading user settings:', error);
    }
}

// Update UI based on dictation preference
function updateDictationUI() {
    const transcribedText = document.getElementById('transcribedText');
    const systemDictationInput = document.getElementById('systemDictationInput');
    const startButton = document.getElementById('startSpeechButton');
    const resultLabel = document.querySelector('.result-label');
    
    if (window.useSystemDictation) {
        // Show input field, hide transcribed text
        if (transcribedText) transcribedText.style.display = 'none';
        if (systemDictationInput) {
            systemDictationInput.style.display = 'block';
            // Clear input when switching modes
            systemDictationInput.value = '';
        }
        if (startButton) {
            startButton.innerHTML = '<span class="check-icon">✓</span> Text prüfen';
            // Remove old event listeners and add new one
            const newStartButton = startButton.cloneNode(true);
            startButton.parentNode.replaceChild(newStartButton, startButton);
            newStartButton.onclick = window.checkSystemDictation;
        }
        if (resultLabel) resultLabel.textContent = 'Ihr Text:';
    } else {
        // Show transcribed text, hide input field
        if (transcribedText) transcribedText.style.display = 'block';
        if (systemDictationInput) systemDictationInput.style.display = 'none';
        if (resultLabel) resultLabel.textContent = 'Ihre Aussprache:';
        // Speech recognition button already set up
    }
}

// Check system dictation input - defined as global to be accessible
window.checkSystemDictation = function() {
    const input = document.getElementById('systemDictationInput');
    if (input && input.value.trim()) {
        // Call the checkDictation function if it exists
        if (window.checkDictationFunction) {
            window.checkDictationFunction(input.value.trim());
        } else {
            console.error('checkDictation function not available');
            alert('Fehler: Die Prüffunktion ist nicht verfügbar. Bitte laden Sie die Seite neu.');
        }
    } else {
        alert('Bitte geben Sie einen Text ein.');
    }
}

// Helper function to get video ID
function getVideoId() {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('id');
}

document.addEventListener('DOMContentLoaded', () => {
    const videoDetailContainer = document.getElementById('videoDetail');
    
    // Get video ID from URL parameters
    const videoId = getVideoId();
    
    if (!videoId) {
        videoDetailContainer.innerHTML = '<p class="error">No video ID provided.</p>';
        return;
    }
    
    // Store user data globally when auth is checked
    checkAuth().then(authData => {
        if (authData.authenticated) {
            window.currentUser = authData.user;
        }
    });
    
    // Check authentication and update UI
    updateAuthUI();
    
    // Check if browser supports speech recognition
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const hasSpeechRecognition = !!SpeechRecognition;
    
    // Update authentication UI
    async function updateAuthUI() {
        const authData = await checkAuth();
        const userHeader = document.getElementById('userHeader');
        
        if (authData.authenticated) {
            userHeader.style.display = 'flex';
            document.getElementById('userName').textContent = authData.user.username;
            document.getElementById('userRole').textContent = authData.user.role;
            
            if (authData.user.role === 'admin') {
                document.getElementById('userRole').classList.add('admin');
                document.getElementById('adminLink').style.display = 'inline-block';
            }
        }
    }
    
    // Setup vocabulary button
    const setupVocabularyButton = () => {
        const vocabBtn = document.getElementById('startVocabularyBtn');
        if (vocabBtn) {
            vocabBtn.addEventListener('click', () => {
                window.location.href = `/vocabulary.html?video=${videoId}`;
            });
        }
    };
    
    // Fetch video details
    const fetchVideoDetails = async () => {
        try {
            const response = await fetch(`/api/videos/${videoId}`);
            if (!response.ok) {
                throw new Error('Video not found');
            }
            
            const video = await response.json();
            displayVideoDetails(video);
        } catch (error) {
            console.error('Error fetching video details:', error);
            videoDetailContainer.innerHTML = '<p class="error">Error loading video details. Please try again later.</p>';
        }
    };
    
    // Display video details
    const displayVideoDetails = (video) => {
        const embedUrl = `https://www.youtube.com/embed/${video.video_id}`;
        
        videoDetailContainer.innerHTML = `
            <div class="video-player-wrapper">
                <div class="video-controls-bar">
                    <a href="/transcript.html?id=${videoId}" class="transcript-link">
                        <span class="transcript-icon">📝</span> Transkript anzeigen
                    </a>
                </div>
                <div class="video-player-container">
                    <iframe 
                        src="${embedUrl}" 
                        frameborder="0" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>
            </div>
            
            <div class="video-info">
                <h1>${video.title}</h1>
                
                <div class="video-metadata">
                    ${video._type ? `<span class="video-category-large">${video._type}</span>` : ''}
                    ${video.channel ? `<span class="metadata-item">Channel: ${video.channel}</span>` : ''}
                    ${video.duration ? `<span class="metadata-item">Duration: ${video.duration}</span>` : ''}
                    ${video.views ? `<span class="metadata-item">Views: ${video.views}</span>` : ''}
                </div>
                
                ${video.description ? `
                    <div class="video-section">
                        <h2>Description</h2>
                        <p class="video-description">${decodeURIComponent(video.description).replace(/\+/g, ' ')}</p>
                    </div>
                ` : ''}
                
                <div class="video-section">
                    <h2>Summary</h2>
                    <div id="summaryContent" class="video-summary">${formatSummary(video.summary)}</div>
                </div>
            </div>
        `;
        
        // Add event listeners after content is added to DOM
        setupDictationModal();
        makeSentencesClickable();
        setupVocabularyButton();
    };
    
    // Track current sentence and selection
    let currentFullSentence = '';
    let currentSelectedText = '';
    let currentVideoId = null;
    let practiceStartTime = null;
    let currentSentenceIndex = null;
    
    // Setup dictation modal
    const setupDictationModal = () => {
        const modal = document.getElementById('dictationModal');
        const closeButton = document.querySelector('.close-button');
        const playButton = document.getElementById('playButton');
        const slowPlayButton = document.getElementById('slowPlayButton');
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        const viewHistoryButton = document.getElementById('viewHistoryButton');
        
        // Close modal when clicking X or outside
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                stopSpeechRecognition();
                modal.style.display = 'none';
            });
        }
        
        window.addEventListener('click', (event) => {
            if (event.target === modal) {
                stopSpeechRecognition();
                modal.style.display = 'none';
            }
        });
        
        // Handle text selection in sentence display
        if (sentenceDisplay) {
            // Function to handle selection
            const handleTextSelection = () => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                
                console.log('Text selected:', selectedText);
                
                if (selectedText && selectedText.length > 0) {
                    currentSelectedText = selectedText;
                    // Highlight the selection
                    sentenceDisplay.classList.add('has-selection');
                    
                    // Show visual feedback for selection
                    const selectionInfo = document.createElement('div');
                    selectionInfo.className = 'selection-info';
                    selectionInfo.textContent = `Ausgewählt: "${selectedText}"`;
                    selectionInfo.style.cssText = 'background: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 6px; font-size: 0.9em; color: #1976d2;';
                    
                    // Remove any existing selection info
                    const existingInfo = document.querySelector('.selection-info');
                    if (existingInfo) existingInfo.remove();
                    
                    // Add new selection info after sentence display
                    sentenceDisplay.parentNode.insertBefore(selectionInfo, sentenceDisplay.nextSibling);
                } else {
                    currentSelectedText = '';
                    sentenceDisplay.classList.remove('has-selection');
                    // Remove selection info
                    const existingInfo = document.querySelector('.selection-info');
                    if (existingInfo) existingInfo.remove();
                }
            };
            
            // Add both mouse and touch event listeners
            sentenceDisplay.addEventListener('mouseup', handleTextSelection);
            sentenceDisplay.addEventListener('touchend', () => {
                // Small delay for touch to allow selection to complete
                setTimeout(handleTextSelection, 100);
            });
            
            // Also handle selection change event for better mobile support
            document.addEventListener('selectionchange', () => {
                if (sentenceDisplay.contains(window.getSelection().anchorNode)) {
                    handleTextSelection();
                }
            });
        }
        
        // Play audio buttons
        if (playButton) {
            playButton.addEventListener('click', () => {
                const textToPlay = currentSelectedText || currentFullSentence;
                speakText(textToPlay, 1.0);
            });
        }
        
        if (slowPlayButton) {
            slowPlayButton.addEventListener('click', () => {
                const textToPlay = currentSelectedText || currentFullSentence;
                speakText(textToPlay, 0.6);
            });
        }
        
        // View history button
        if (viewHistoryButton) {
            viewHistoryButton.addEventListener('click', () => {
                showPracticeHistory();
            });
        }
        
        // Setup speech recognition if available
        if (hasSpeechRecognition) {
            setupSpeechRecognition();
        }
        
        // Setup history modal
        setupHistoryModal();
    };
    
    // Speech recognition setup
    let recognition = null;
    let isListening = false;
    
    const setupSpeechRecognition = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        recognition = new SpeechRecognition();
        
        recognition.lang = 'de-DE'; // German language
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        
        const startButton = document.getElementById('startSpeechButton');
        const listeningIndicator = document.getElementById('listeningIndicator');
        const transcribedText = document.getElementById('transcribedText');
        
        if (startButton) {
            startButton.addEventListener('click', () => {
                if (!isListening) {
                    // Reset previous results when starting new recording
                    resetDictation();
                    startSpeechRecognition();
                } else {
                    stopSpeechRecognition();
                }
            });
        }
        
        recognition.onstart = () => {
            isListening = true;
            startButton.innerHTML = '<span class="mic-icon">🔴</span> Sprechen beenden';
            startButton.classList.add('listening');
            listeningIndicator.style.display = 'flex';
            
            // Clear previous results
            document.getElementById('comparisonResult').innerHTML = '';
            
            // Show what text we're expecting
            const expectedText = window.currentSelectedText || currentSelectedText || currentFullSentence;
            console.log('Expecting speech for:', expectedText);
            
            // Add visual indicator of expected text
            const expectedDiv = document.createElement('div');
            expectedDiv.id = 'expectedTextIndicator';
            expectedDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffeaa7; padding: 10px; margin: 10px 0; border-radius: 6px; font-size: 0.9em;';
            expectedDiv.innerHTML = `<strong>Erwarteter Text:</strong> "${expectedText}"`;
            
            const existingIndicator = document.getElementById('expectedTextIndicator');
            if (existingIndicator) existingIndicator.remove();
            
            const speechResult = document.getElementById('speechResult');
            speechResult.parentNode.insertBefore(expectedDiv, speechResult);
        };
        
        recognition.onend = () => {
            isListening = false;
            startButton.innerHTML = '<span class="mic-icon">🎤</span> Sprechen beginnen';
            startButton.classList.remove('listening');
            listeningIndicator.style.display = 'none';
            
            // Automatically check the answer when stopping
            const finalText = transcribedText.dataset.finalText || '';
            if (finalText.trim()) {
                checkDictation(finalText.trim());
            }
            
            // Remove expected text indicator after a delay
            setTimeout(() => {
                const expectedIndicator = document.getElementById('expectedTextIndicator');
                if (expectedIndicator) expectedIndicator.remove();
            }, 3000);
        };
        
        recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript + ' ';
                } else {
                    interimTranscript += transcript;
                }
            }
            
            // Update the transcribed text
            const currentText = transcribedText.dataset.finalText || '';
            transcribedText.innerHTML = `
                <span class="final-text">${currentText + finalTranscript}</span>
                <span class="interim-text">${interimTranscript}</span>
            `;
            transcribedText.dataset.finalText = currentText + finalTranscript;
        };
        
        recognition.onerror = (event) => {
            console.error('Speech recognition error:', event.error);
            if (event.error === 'no-speech') {
                showTemporaryMessage('Keine Sprache erkannt. Bitte versuchen Sie es erneut.');
            } else if (event.error === 'not-allowed') {
                showTemporaryMessage('Mikrofonzugriff verweigert. Bitte erlauben Sie den Mikrofonzugriff.');
            }
            stopSpeechRecognition();
        };
    };
    
    const startSpeechRecognition = () => {
        if (recognition && !isListening) {
            recognition.start();
        }
    };
    
    const stopSpeechRecognition = () => {
        if (recognition && isListening) {
            recognition.stop();
        }
    };
    
    // Open dictation modal with sentence
    const openDictationModal = async (sentence, sentenceIndex = null) => {
        const modal = document.getElementById('dictationModal');
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        
        // Reset modal
        currentFullSentence = sentence;
        currentSelectedText = '';
        window.currentSelectedText = ''; // Clear window variable too
        currentVideoId = videoId; // Store video ID for tracking
        currentSentenceIndex = sentenceIndex;
        practiceStartTime = Date.now(); // Start timing
        sentenceDisplay.textContent = sentence;
        sentenceDisplay.classList.remove('has-selection');
        
        // Load user settings to update dictation UI
        await loadUserSettings();
        
        // Add iOS-specific selection help and alternative selection method
        if (/iPhone|iPad|iPod/.test(navigator.userAgent) || window.innerWidth <= 768) {
            const iosHint = document.querySelector('.selection-hint');
            if (iosHint) {
                iosHint.innerHTML = '💡 <strong>Tipp:</strong> Erstes Wort antippen = Start, zweites Wort = Ende der Auswahl. Alle Wörter dazwischen werden ausgewählt.';
            }
            
            // Make words clickable for easier selection on mobile
            const words = sentence.split(' ');
            sentenceDisplay.innerHTML = words.map((word, i) => 
                `<span class="clickable-sentence-word" data-index="${i}" style="padding: 4px 2px; cursor: pointer; border: 1px solid transparent;">${word}</span>`
            ).join(' ');
            
            // Add debug info
            const debugInfo = document.createElement('div');
            debugInfo.style.cssText = 'position: fixed; top: 10px; right: 10px; background: yellow; padding: 5px; font-size: 12px; z-index: 9999;';
            debugInfo.textContent = 'Mobile selection active';
            document.body.appendChild(debugInfo);
            setTimeout(() => debugInfo.remove(), 3000);
            
            // Handle word clicks for selection - continuous selection only
            let selectionStart = null;
            let selectionEnd = null;
            
            function updateSelection() {
                // Clear all selections first
                sentenceDisplay.querySelectorAll('.clickable-sentence-word').forEach((span, idx) => {
                    span.style.background = '';
                    span.style.color = '';
                    span.style.fontWeight = '';
                });
                
                // Apply selection if we have start and end
                if (selectionStart !== null) {
                    const start = Math.min(selectionStart, selectionEnd || selectionStart);
                    const end = Math.max(selectionStart, selectionEnd || selectionStart);
                    
                    // Highlight selected range
                    sentenceDisplay.querySelectorAll('.clickable-sentence-word').forEach((span, idx) => {
                        if (idx >= start && idx <= end) {
                            span.style.background = '#1976d2';
                            span.style.color = 'white';
                            span.style.fontWeight = 'bold';
                        }
                    });
                    
                    // Update selected text
                    const selectedWords = [];
                    for (let i = start; i <= end; i++) {
                        selectedWords.push(words[i]);
                    }
                    window.currentSelectedText = selectedWords.join(' '); // Use window scope
                    currentSelectedText = window.currentSelectedText; // Also update local var
                    
                    // Show selection info
                    let selectionInfo = document.querySelector('.selection-info');
                    if (!selectionInfo) {
                        selectionInfo = document.createElement('div');
                        selectionInfo.className = 'selection-info';
                        sentenceDisplay.parentNode.insertBefore(selectionInfo, sentenceDisplay.nextSibling);
                    }
                    selectionInfo.textContent = `Ausgewählt: "${window.currentSelectedText}"`;
                    selectionInfo.style.cssText = 'background: #e3f2fd; padding: 10px; margin: 10px 0; border-radius: 6px; font-size: 0.9em; color: #1976d2;';
                    
                    console.log('Updated selection:', window.currentSelectedText);
                } else {
                    // Clear selection
                    window.currentSelectedText = '';
                    currentSelectedText = '';
                    const selectionInfo = document.querySelector('.selection-info');
                    if (selectionInfo) selectionInfo.remove();
                }
            }
            
            sentenceDisplay.querySelectorAll('.clickable-sentence-word').forEach(span => {
                span.addEventListener('click', function(e) {
                    e.preventDefault();
                    e.stopPropagation();
                    const index = parseInt(this.dataset.index);
                    
                    // Visual feedback on tap
                    this.style.transform = 'scale(0.95)';
                    setTimeout(() => {
                        this.style.transform = '';
                    }, 100);
                    
                    if (selectionStart === null) {
                        // First click - start selection
                        selectionStart = index;
                        selectionEnd = index;
                    } else if (index === selectionStart && selectionEnd === selectionStart) {
                        // Clicking the same word again - clear selection
                        selectionStart = null;
                        selectionEnd = null;
                    } else {
                        // Second click - set end of selection
                        selectionEnd = index;
                    }
                    
                    updateSelection();
                    
                    // Update play buttons to use new selection
                    updatePlayButtons();
                });
            });
        }
        
        // Function to update play buttons - define before usage
        function updatePlayButtons() {
            const playButton = document.getElementById('playButton');
            const slowPlayButton = document.getElementById('slowPlayButton');
            
            if (playButton) {
                // Remove all existing event listeners by replacing the button
                const newPlayButton = playButton.cloneNode(true);
                playButton.parentNode.replaceChild(newPlayButton, playButton);
                
                // Add new event listener
                newPlayButton.onclick = function() {
                    // Get selected text from DOM if available
                    const selectionInfo = document.querySelector('.selection-info');
                    let selectedFromDOM = '';
                    if (selectionInfo) {
                        const match = selectionInfo.textContent.match(/Ausgewählt: "(.+)"/);
                        if (match) {
                            selectedFromDOM = match[1];
                        }
                    }
                    
                    // Use DOM selection or variable (check window scope too)
                    const selected = selectedFromDOM || window.currentSelectedText || currentSelectedText;
                    const full = currentFullSentence;
                    const textToPlay = selected || full;
                    
                    console.log('Play button clicked');
                    console.log('currentSelectedText:', currentSelectedText);
                    console.log('selectedFromDOM:', selectedFromDOM);
                    console.log('currentFullSentence:', full);
                    console.log('Playing:', textToPlay);
                    
                    // Debug alert for mobile
                    alert(`Playing: ${textToPlay}\nWindow var: "${window.currentSelectedText}"\nLocal var: "${currentSelectedText}"\nDOM: "${selectedFromDOM}"\nFull: "${full}"`);
                    
                    speakText(textToPlay, 1.0);
                };
            }
            
            if (slowPlayButton) {
                // Remove all existing event listeners by replacing the button
                const newSlowPlayButton = slowPlayButton.cloneNode(true);
                slowPlayButton.parentNode.replaceChild(newSlowPlayButton, slowPlayButton);
                
                // Add new event listener
                newSlowPlayButton.onclick = function() {
                    // Get selected text from DOM if available
                    const selectionInfo = document.querySelector('.selection-info');
                    let selectedFromDOM = '';
                    if (selectionInfo) {
                        const match = selectionInfo.textContent.match(/Ausgewählt: "(.+)"/);
                        if (match) {
                            selectedFromDOM = match[1];
                        }
                    }
                    
                    // Use DOM selection or variable (check window scope too)
                    const selected = selectedFromDOM || window.currentSelectedText || currentSelectedText;
                    const full = currentFullSentence;
                    const textToPlay = selected || full;
                    
                    console.log('Slow play button clicked');
                    console.log('currentSelectedText:', currentSelectedText);
                    console.log('selectedFromDOM:', selectedFromDOM);
                    console.log('currentFullSentence:', full);
                    console.log('Playing slowly:', textToPlay);
                    
                    speakText(textToPlay, 0.6);
                };
            }
        }
        
        // Clear previous results
        if (document.getElementById('transcribedText')) {
            document.getElementById('transcribedText').innerHTML = '';
            document.getElementById('transcribedText').dataset.finalText = '';
        }
        if (document.getElementById('comparisonResult')) {
            document.getElementById('comparisonResult').innerHTML = '';
        }
        
        // Re-attach play button event listeners
        updatePlayButtons();
        
        // Check if user is logged in to show history button and load attempt count
        checkAuth().then(authData => {
            const historyButton = document.getElementById('viewHistoryButton');
            const attemptCounter = document.getElementById('attemptCounter');
            
            if (authData.authenticated) {
                historyButton.style.display = 'inline-block';
                // Load attempt count
                loadAttemptCount(sentence);
            } else {
                historyButton.style.display = 'none';
                attemptCounter.style.display = 'none';
            }
        });
        
        // Show modal
        modal.style.display = 'block';
    };
    
    // Load attempt count for a sentence
    const loadAttemptCount = async (sentence) => {
        const attemptCounter = document.getElementById('attemptCounter');
        const attemptCountSpan = attemptCounter.querySelector('.attempt-count');
        
        try {
            const response = await fetch(`/api/progress/sentence-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoId: currentVideoId,
                    sentenceText: sentence
                }),
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const sessions = await response.json();
                if (sessions && sessions.length > 0) {
                    attemptCounter.style.display = 'block';
                    attemptCountSpan.textContent = `Bisherige Versuche: ${sessions.length}`;
                } else {
                    attemptCounter.style.display = 'none';
                }
            }
        } catch (error) {
            console.error('Error loading attempt count:', error);
            attemptCounter.style.display = 'none';
        }
    };
    

    
    // Check dictation answer with color coding
    const checkDictation = (userInput) => {
        // Use window variable first, then local, then full sentence
        const targetText = window.currentSelectedText || currentSelectedText || currentFullSentence;
        const comparisonResult = document.getElementById('comparisonResult');
        
        console.log('Checking dictation against:', targetText);
        console.log('Window selected:', window.currentSelectedText);
        console.log('Local selected:', currentSelectedText);
        console.log('Full sentence:', currentFullSentence);
        
        // Normalize and split into words
        const normalizeText = (text) => {
            return text.toLowerCase()
                .replace(/[.,!?;:'"„"]/g, '') // Remove punctuation including quotes
                .replace(/\s+/g, ' ') // Normalize spaces
                .trim();
        };
        
        // Keep original words for display while using normalized for comparison
        const targetWords = normalizeText(targetText).split(' ');
        const userWords = normalizeText(userInput).split(' ');
        
        // Also split original input to preserve capitalization for display
        const userInputOriginal = userInput
            .replace(/[.,!?;:'"„"]/g, '') // Remove punctuation but keep capitalization
            .replace(/\s+/g, ' ')
            .trim();
        const userWordsOriginal = userInputOriginal.split(' ');
        
        // Check if this might be a connection issue (missing start words)
        let connectionIssue = false;
        const missingStartWords = [];
        
        if (targetWords.length > userWords.length && userWords.length > 0) {
            // Check if user's words match the end of the target
            let matchesEnd = true;
            let offset = targetWords.length - userWords.length;
            
            for (let i = 0; i < userWords.length; i++) {
                if (normalizeText(userWords[i]) !== normalizeText(targetWords[i + offset])) {
                    matchesEnd = false;
                    break;
                }
            }
            
            if (matchesEnd && offset <= 3) {  // Changed from 2 to 3
                connectionIssue = true;
                // Get the missing words
                for (let i = 0; i < offset; i++) {
                    missingStartWords.push(targetWords[i]);
                }
            }
        }
        
        // Create colored result
        let coloredResult = '<div class="word-comparison">';
        let correctCount = 0;
        
        // Show missing words at the beginning in capitals if connection issue
        if (connectionIssue && missingStartWords.length > 0) {
            missingStartWords.forEach(word => {
                coloredResult += `<span class="word-missing">${word.toUpperCase()}</span> `;
            });
        }
        
        userWords.forEach((word, index) => {
            let className = 'word-incorrect';
            const targetIndex = index + (connectionIssue ? missingStartWords.length : 0);
            
            // All comparisons are already case-insensitive since both arrays contain normalized (lowercased) words
            if (targetIndex < targetWords.length && word === targetWords[targetIndex]) {
                // Correct position (accounting for offset)
                className = 'word-correct';
                correctCount++;
            } else if (targetWords.includes(word)) {
                // Word exists but wrong position
                className = 'word-exists';
            }
            
            // Use original capitalization for display
            const displayWord = userWordsOriginal[index] || word;
            coloredResult += `<span class="${className}">${displayWord}</span> `;
        });
        
        coloredResult += '</div>';
        
        // Calculate accuracy (be more generous if connection issue detected)
        let accuracy;
        if (connectionIssue && correctCount === userWords.length) {
            // All spoken words were correct, just missed the beginning
            accuracy = (correctCount / targetWords.length) * 100;
        } else {
            accuracy = (correctCount / targetWords.length) * 100;
        }
        
        // Add connection issue message if detected
        let connectionMessage = '';
        if (connectionIssue && missingStartWords.length <= 3) {  // Changed from 2 to 3
            connectionMessage = '<p class="connection-notice">💡 Es scheint, dass die ersten Wörter fehlen - dies könnte an der Internetverbindung liegen. Der Rest sieht gut aus!</p>';
        }
        
        // Add feedback message
        let feedbackMessage = '';
        if (accuracy === 100) {
            feedbackMessage = '<p class="feedback-success">✓ Perfekt! Ausgezeichnete Aussprache!</p>';
        } else if (accuracy >= 80 || (connectionIssue && correctCount === userWords.length)) {
            feedbackMessage = '<p class="feedback-success">✓ Sehr gut! Fast perfekt!</p>';
        } else if (accuracy >= 60) {
            feedbackMessage = '<p class="feedback-warning">Guter Versuch! Weiter üben.</p>';
        } else {
            feedbackMessage = '<p class="feedback-error">Weiter versuchen! Hören Sie genau auf die Aussprache.</p>';
        }
        
        // Show expected text if not perfect
        let expectedText = '';
        if (accuracy < 100 && !connectionIssue) {
            expectedText = `
                <div class="expected-text">
                    <p class="expected-label">Erwartet:</p>
                    <p class="expected-sentence">"${targetText}"</p>
                </div>
            `;
        }
        
        comparisonResult.innerHTML = `
            ${coloredResult}
            ${connectionMessage}
            ${feedbackMessage}
            ${expectedText}
            <div class="legend">
                <span class="legend-item"><span class="word-correct">Grün</span> = Richtige Position</span>
                <span class="legend-item"><span class="word-exists">Orange</span> = Wort existiert</span>
                <span class="legend-item"><span class="word-incorrect">Rot</span> = Falsch</span>
                ${connectionIssue ? '<span class="legend-item"><span class="word-missing">GROSSBUCHSTABEN</span> = Fehlende Wörter</span>' : ''}
            </div>
        `;
        
        // Save practice session if user is logged in and no connection issue
        if (!connectionIssue) {
            savePracticeSession({
                userSpeech: userInput,
                expectedText: targetText,
                accuracyScore: accuracy,
                correctWords: correctCount,
                totalWords: targetWords.length
            });
        }
    };
    
    // Save practice session to database
    const savePracticeSession = async (practiceData) => {
        // Check if user is logged in
        const authData = await checkAuth();
        if (!authData.authenticated) {
            return; // Don't save if not logged in
        }
        
        const practiceDuration = practiceStartTime ? Math.round((Date.now() - practiceStartTime) / 1000) : null;
        
        try {
            const response = await fetch('/api/progress/practice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoId: currentVideoId,
                    sentenceText: currentFullSentence,
                    sentenceIndex: currentSentenceIndex,
                    userSpeech: practiceData.userSpeech,
                    expectedText: practiceData.expectedText,
                    accuracyScore: practiceData.accuracyScore,
                    correctWords: practiceData.correctWords,
                    totalWords: practiceData.totalWords,
                    practiceDuration: practiceDuration
                }),
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                console.log('Practice session saved successfully');
                // Refresh attempt count
                loadAttemptCount(currentFullSentence);
            }
        } catch (error) {
            console.error('Error saving practice session:', error);
        }
    };
    
    // Reset dictation
    const resetDictation = () => {
        const transcribedText = document.getElementById('transcribedText');
        const comparisonResult = document.getElementById('comparisonResult');
        
        if (transcribedText) {
            transcribedText.innerHTML = '';
            transcribedText.dataset.finalText = '';
        }
        if (comparisonResult) {
            comparisonResult.innerHTML = '';
        }
    };
    
    // Show temporary message
    const showTemporaryMessage = (message) => {
        const comparisonResult = document.getElementById('comparisonResult');
        comparisonResult.innerHTML = `<p class="feedback-warning">${message}</p>`;
        setTimeout(() => {
            comparisonResult.innerHTML = '';
        }, 3000);
    };
    
    // Format summary text and make sentences clickable
    const formatSummary = (summary) => {
        if (!summary) return '<p>No summary available.</p>';
        
        // Split by line breaks and create paragraphs
        const paragraphs = summary.split(/\n+/)
            .filter(p => p.trim())
            .map((p, paragraphIndex) => {
                // Split paragraph into sentences and wrap each in a clickable span
                const sentences = p.trim().match(/[^.!?]+[.!?]+/g) || [p.trim()];
                let sentenceIndexInSummary = 0;
                
                const clickableSentences = sentences.map((sentence, index) => {
                    const globalIndex = sentenceIndexInSummary++;
                    return `<span class="clickable-sentence notranslate" translate="no" data-sentence-index="${globalIndex}">${sentence.trim()}</span>`;
                }).join(' ');
                return `<p class="notranslate" translate="no">${clickableSentences}</p>`;
            })
            .join('');
            
        return paragraphs || '<p>No summary available.</p>';
    };
    
    // Make sentences clickable
    const makeSentencesClickable = () => {
        const sentences = document.querySelectorAll('.clickable-sentence');
        sentences.forEach(sentence => {
            sentence.addEventListener('click', () => {
                const sentenceIndex = sentence.dataset.sentenceIndex ? parseInt(sentence.dataset.sentenceIndex) : null;
                openDictationModal(sentence.textContent.trim(), sentenceIndex);
            });
        });
    };
    
    // Setup history modal
    const setupHistoryModal = () => {
        const historyModal = document.getElementById('historyModal');
        const historyClose = document.querySelector('.history-close');
        
        historyClose.addEventListener('click', () => {
            historyModal.style.display = 'none';
        });
        
        window.addEventListener('click', (event) => {
            if (event.target === historyModal) {
                historyModal.style.display = 'none';
            }
        });
    };
    
    // Show practice history
    const showPracticeHistory = async () => {
        const historyModal = document.getElementById('historyModal');
        const historyList = document.getElementById('historyList');
        
        historyModal.style.display = 'block';
        historyList.innerHTML = '<p class="loading">Loading history...</p>';
        
        try {
            const response = await fetch(`/api/progress/sentence-history`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    videoId: currentVideoId,
                    sentenceText: currentFullSentence
                }),
                credentials: 'same-origin'
            });
            
            if (!response.ok) {
                throw new Error('Failed to load history');
            }
            
            const sessions = await response.json();
            displayPracticeHistory(sessions);
        } catch (error) {
            console.error('Error loading history:', error);
            historyList.innerHTML = '<p class="error">Failed to load practice history.</p>';
        }
    };
    
    // Display practice history
    const displayPracticeHistory = (sessions) => {
        const historyList = document.getElementById('historyList');
        
        if (!sessions || sessions.length === 0) {
            historyList.innerHTML = '<p class="no-data">Noch kein Übungsverlauf für diesen Satz vorhanden.</p>';
            return;
        }
        
        historyList.innerHTML = sessions.map((session, index) => {
            // Parse the UTC timestamp and ensure it's interpreted correctly
            const utcDate = new Date(session.created_at);
            
            // Create a date in the user's timezone
            const localDate = new Date(utcDate.getTime());
            
            // Format date and time for teacher review in German timezone
            const fullDateTime = localDate.toLocaleString('de-DE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: false,
                timeZone: window.currentUser?.timezone || 'Europe/Berlin'
            });
            
            // Also show relative time for context
            const now = new Date();
            const diffMs = now - localDate;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
            const diffMinutes = Math.floor(diffMs / (1000 * 60));
            
            let relativeTime = '';
            if (diffMinutes < 60) {
                relativeTime = `vor ${diffMinutes} Minute${diffMinutes !== 1 ? 'n' : ''}`;
            } else if (diffHours < 24) {
                relativeTime = `vor ${diffHours} Stunde${diffHours !== 1 ? 'n' : ''}`;
            } else if (diffDays < 7) {
                relativeTime = `vor ${diffDays} Tag${diffDays !== 1 ? 'en' : ''}`;
            } else {
                relativeTime = `vor ${Math.floor(diffDays / 7)} Woche${Math.floor(diffDays / 7) !== 1 ? 'n' : ''}`;
            }
            
            const accuracyClass = session.accuracy_score >= 80 ? 'accuracy-good' : 
                                 session.accuracy_score >= 60 ? 'accuracy-medium' : 'accuracy-poor';
            
            return `
                <div class="history-item">
                    <div class="history-header">
                        <span class="history-number">Versuch #${sessions.length - index}</span>
                        <span class="history-timing">
                            <span class="history-date">${fullDateTime}</span>
                            <span class="history-relative">(${relativeTime})</span>
                        </span>
                    </div>
                    <div class="history-details">
                        <div class="history-text">
                            <p class="history-label">Antwort des Schülers:</p>
                            <p class="history-speech">"${session.user_speech || '(keine Sprache erkannt)'}"</p>
                            ${session.expected_text !== session.sentence_text ? 
                                `<p class="history-label">Erwartet (Auswahl):</p>
                                 <p class="history-expected">"${session.expected_text}"</p>` : ''}
                        </div>
                        <div class="history-stats">
                            <span class="accuracy-score ${accuracyClass}">
                                ${Math.round(session.accuracy_score)}% korrekt
                            </span>
                            <span class="history-metrics">
                                ${session.correct_words}/${session.total_words} Wörter richtig
                            </span>
                            <span class="history-duration">
                                Dauer: ${session.practice_duration ? `${session.practice_duration} Sekunden` : 'Nicht aufgezeichnet'}
                            </span>
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    };
    
    // Make functions globally accessible for HTML onclick handlers
    window.closeDictationModal = () => {
        const modal = document.getElementById('dictationModal');
        modal.style.display = 'none';
        stopSpeechRecognition();
    };
    
    window.displayWordSelection = displayWordSelection;
    window.startSpeechRecognition = startSpeechRecognition;
    window.showPracticeHistory = showPracticeHistory;
    window.openDictationModal = openDictationModal;
    window.checkDictationFunction = checkDictation;
    
    // Open dictation modal for cloze test sentence
    window.openClozeDictation = async function() {
        if (!currentClozeTests || currentClozeIndex >= currentClozeTests.length) return;
        
        const test = currentClozeTests[currentClozeIndex];
        const fullSentence = test.original_sentence || test.sentence.replace('_____', test.cloze_word);
        
        // Set up dictation modal variables
        currentFullSentence = fullSentence;
        currentSelectedText = '';
        currentVideoId = getVideoId();
        currentSentenceIndex = test.sentence_id || currentClozeIndex;
        practiceStartTime = Date.now();
        
        // Load user settings to update dictation UI
        await loadUserSettings();
        
        // Open the dictation modal
        const modal = document.getElementById('dictationModal');
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        
        // Display the full sentence
        sentenceDisplay.textContent = fullSentence;
        sentenceDisplay.classList.remove('has-selection');
        
        modal.style.display = 'block';
    };
    
    // Setup modals
    setupDictationModal();
    setupSpeechRecognition();
    setupHistoryModal();
    
    // Fetch video details on page load
    fetchVideoDetails();
    
    // SpaCy Vocabulary Features
    let currentClozeTests = [];
    let currentClozeIndex = 0;
    let clozeScore = 0;
    let clozeAttempts = 0;
    let currentClozeType = 'artikel'; // Default to artikel
    
    // Load SpaCy Vocabulary
    const loadVocabBtn = document.getElementById('loadVocabBtn');
    if (loadVocabBtn) {
        loadVocabBtn.addEventListener('click', async () => {
            const videoId = getVideoId();
            if (!videoId) return;
            
            // Show loading state
            document.getElementById('vocabPlaceholder').style.display = 'none';
            document.getElementById('vocabLoading').style.display = 'block';
            loadVocabBtn.style.display = 'none';
            
            try {
                // Load both vocabulary and sentences
                const [vocabResponse, sentencesResponse] = await Promise.all([
                    fetch(`/api/spacy/vocabulary/${videoId}`, { credentials: 'same-origin' }),
                    fetch(`/api/spacy/sentences/${videoId}`, { credentials: 'same-origin' })
                ]);
                
                if (!vocabResponse.ok) throw new Error('Failed to load vocabulary');
                
                const vocabData = await vocabResponse.json();
                const sentencesData = await sentencesResponse.json();
                
                if (vocabData.success && vocabData.data) {
                    displayVocabulary(vocabData.data);
                    
                    // Store sentences globally
                    if (sentencesData.success && sentencesData.data) {
                        window.videoSentences = sentencesData.data.sentences;
                        console.log(`Loaded ${window.videoSentences.length} sentences`);
                    }
                    
                    // Setup mode selector
                    setupPracticeModeSelector();
                } else {
                    throw new Error('No vocabulary data available');
                }
            } catch (error) {
                console.error('Error loading vocabulary:', error);
                document.getElementById('vocabLoading').style.display = 'none';
                document.getElementById('vocabPlaceholder').textContent = 'Error loading vocabulary. Please try again.';
                document.getElementById('vocabPlaceholder').style.display = 'block';
                loadVocabBtn.style.display = 'block';
            }
        });
    }
    
    // Setup practice mode selector
    function setupPracticeModeSelector() {
        const modeSelector = document.getElementById('practiceMode');
        if (!modeSelector) return;
        
        // Store current mode globally
        window.currentPracticeMode = 'einzelwort';
        
        modeSelector.addEventListener('change', (e) => {
            const mode = e.target.value;
            window.currentPracticeMode = mode;
            
            // Always keep vocab grid visible
            document.getElementById('vocabGrid').style.display = 'grid';
            
            // Hide secondary views
            document.getElementById('sentencesList').style.display = 'none';
            document.getElementById('wordSelectionList').style.display = 'none';
            
            // Update vocab cards behavior based on mode
            updateVocabCardsBehavior(mode);
            
            switch(mode) {
                case 'einzelwort':
                    // Just vocabulary cards with normal dictation
                    break;
                    
                case 'satzauswahl':
                    // Vocabulary cards will show sentences on click
                    break;
                    
                case 'wortauswahl':
                    // Vocabulary cards will show word selection on click
                    break;
            }
        });
    }
    
    // Update vocabulary cards behavior based on mode
    function updateVocabCardsBehavior(mode) {
        const vocabCards = document.querySelectorAll('.vocab-card');
        vocabCards.forEach(card => {
            const translationDiv = card.querySelector('.word-main-translation');
            if (translationDiv) {
                // Remove old event listeners by cloning
                const newTranslationDiv = translationDiv.cloneNode(true);
                translationDiv.parentNode.replaceChild(newTranslationDiv, translationDiv);
                
                // Add new event listener based on mode
                if (mode === 'satzauswahl') {
                    newTranslationDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const wordIndex = parseInt(card.dataset.wordIndex);
                        const germanWord = card.dataset.germanWord;
                        showSentencesForWord(germanWord, wordIndex);
                    });
                } else if (mode === 'wortauswahl') {
                    newTranslationDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const wordIndex = parseInt(card.dataset.wordIndex);
                        const germanWord = card.dataset.germanWord;
                        showWordSelectionForWord(germanWord, wordIndex);
                    });
                } else {
                    // Default behavior for einzelwort
                    newTranslationDiv.addEventListener('click', (e) => {
                        e.stopPropagation();
                        const wordIndex = parseInt(card.dataset.wordIndex);
                        toggleDefaultDictation(card, wordIndex);
                    });
                }
            }
        });
    }
    
    // Show sentences containing a specific word
    async function showSentencesForWord(germanWord, wordIndex) {
        if (!window.videoSentences || window.videoSentences.length === 0) {
            alert('No sentences available for this video.');
            return;
        }
        
        // Find sentences containing this word (case-insensitive)
        const wordLower = germanWord.toLowerCase();
        let matchingSentences = window.videoSentences.filter(s => 
            s.sentence.toLowerCase().includes(wordLower)
        );
        
        let sentencesToShow = [];
        let fromOtherVideos = false;
        
        if (matchingSentences.length >= 3) {
            // We have enough sentences from this video
            sentencesToShow = matchingSentences.slice(0, 3);
        } else {
            // Add what we have from this video
            sentencesToShow = [...matchingSentences];
            
            // Fetch additional sentences from other videos
            const needed = 3 - sentencesToShow.length;
            if (needed > 0) {
                try {
                    const response = await fetch(`/api/spacy/sentences-by-word/${encodeURIComponent(germanWord)}?limit=${needed}`, {
                        credentials: 'same-origin'
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        if (data.success && data.sentences) {
                            fromOtherVideos = true;
                            // Add sentences from other videos
                            data.sentences.forEach(sent => {
                                sentencesToShow.push({
                                    sentence: sent.sentence,
                                    fromOtherVideo: true,
                                    videoTitle: sent.video_title
                                });
                            });
                        }
                    }
                } catch (error) {
                    console.error('Error fetching sentences from other videos:', error);
                }
            }
        }
        
        if (sentencesToShow.length === 0) {
            alert(`No sentences found containing "${germanWord}"`);
            return;
        }
        
        // Get translation from vocabulary
        const wordData = window.currentVocabulary[wordIndex];
        const translation = wordData.translation || germanWord;
        
        // Create a modal to show sentences
        const modal = document.createElement('div');
        modal.className = 'sentences-modal';
        modal.dataset.targetWord = germanWord;
        modal.innerHTML = `
            <div class="sentences-modal-content">
                <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>Find the German Word</h2>
                <div class="word-search-header">
                    <div class="search-word-display">${translation}</div>
                    <p class="search-instruction">Click on the correct German word in the sentences below:</p>
                    ${fromOtherVideos ? '<p class="other-videos-note">von anderen Videos</p>' : ''}
                </div>
                <div class="word-sentences-list">
                    ${sentencesToShow.map((sent, idx) => `
                        <div class="word-sentence-item ${sent.fromOtherVideo ? 'from-other-video' : ''}">
                            <div class="sentence-number">${idx + 1}.</div>
                            <div class="sentence-content">
                                <div class="sentence-controls">
                                    <button class="mini-play-btn" data-sentence-idx="${idx}" title="Play sentence">
                                        ▶
                                    </button>
                                    <button class="mini-play-slow-btn" data-sentence-idx="${idx}" title="Play slowly">
                                        ▶️
                                    </button>
                                </div>
                                <div class="sentence-clickable" data-sentence-index="${sent.fromOtherVideo ? -1 : window.videoSentences.indexOf(sent)}" data-is-other-video="${sent.fromOtherVideo || false}">
                                    ${makeWordsClickable(sent.sentence, germanWord)}
                                </div>
                                ${sent.fromOtherVideo && sent.videoTitle ? `<div class="video-source">From: ${sent.videoTitle}</div>` : ''}
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Store sentences for audio playback
        modal.sentencesData = sentencesToShow;
        
        // Add play button handlers
        modal.querySelectorAll('.mini-play-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.sentenceIdx);
                const sentence = sentencesToShow[idx].sentence;
                speakText(sentence, 1.0);
            });
        });
        
        modal.querySelectorAll('.mini-play-slow-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.target.dataset.sentenceIdx);
                const sentence = sentencesToShow[idx].sentence;
                speakText(sentence, 0.6);
            });
        });
        
        // Track sentence attempts for this word
        let sentenceAttempts = 0;
        const sentenceStartTime = Date.now();
        
        // Add click handlers to all words
        modal.querySelectorAll('.clickable-word').forEach(wordSpan => {
            wordSpan.addEventListener('click', (e) => {
                const clickedWord = e.target.dataset.word;
                const sentenceContainer = e.target.closest('.sentence-clickable');
                const sentenceIndex = parseInt(sentenceContainer.dataset.sentenceIndex);
                const isOtherVideo = sentenceContainer.dataset.isOtherVideo === 'true';
                
                if (clickedWord.toLowerCase() === germanWord.toLowerCase()) {
                    // Correct word clicked
                    const timeSpent = (Date.now() - sentenceStartTime) / 1000; // seconds
                    
                    // Calculate difficulty based on attempts and time
                    let difficulty;
                    if (sentenceAttempts === 0 && timeSpent < 5) {
                        difficulty = 1; // Easy - found quickly on first try
                    } else if (sentenceAttempts <= 1 && timeSpent < 10) {
                        difficulty = 2; // Good - found with minimal help
                    } else if (sentenceAttempts <= 3 || timeSpent < 20) {
                        difficulty = 3; // Hard - needed some attempts or time
                    } else {
                        difficulty = 4; // Again - struggled to find
                    }
                    
                    // Save practice to spaced repetition
                    const wordData = window.currentVocabulary[wordIndex];
                    if (wordData) {
                        savePracticeToSpacedRepetition(germanWord, wordData.lemma, difficulty);
                        console.log(`Sentence practice saved: ${germanWord}, attempts: ${sentenceAttempts}, time: ${timeSpent.toFixed(1)}s, difficulty: ${difficulty}`);
                        
                        // Track activity
                        if (window.activityMonitor) {
                            window.activityMonitor.trackSentencePractice(
                                sentenceContainer.textContent.trim(),
                                germanWord,
                                sentenceAttempts,
                                timeSpent
                            );
                        }
                    }
                    
                    modal.remove();
                    if (!isOtherVideo && sentenceIndex >= 0) {
                        // Practice with sentence from current video
                        practiceSentenceFromWord(sentenceIndex, germanWord);
                    } else {
                        // For sentences from other videos, show success feedback
                        showSuccessMessageWithStats(germanWord, translation, sentenceAttempts, timeSpent);
                        // Still open practice modal with the sentence
                        const sentenceText = e.target.closest('.sentence-clickable').textContent.trim();
                        openDictationModalForOtherVideo(sentenceText, germanWord);
                    }
                } else {
                    // Wrong word clicked - mark it orange and count attempt
                    sentenceAttempts++;
                    e.target.classList.add('wrong-selection');
                    setTimeout(() => {
                        e.target.classList.remove('wrong-selection');
                    }, 1000);
                }
            });
        });
    }
    
    // Make words clickable in sentence
    function makeWordsClickable(sentence, targetWord) {
        // Split sentence into words while preserving punctuation
        const words = sentence.split(/(\s+|[.,!?;:'"„"]+)/);
        
        return words.map(word => {
            // Skip empty strings and whitespace
            if (!word || /^\s+$/.test(word)) {
                return word;
            }
            
            // Skip punctuation
            if (/^[.,!?;:'"„"]+$/.test(word)) {
                return word;
            }
            
            // Make word clickable
            const cleanWord = word.replace(/[.,!?;:'"„"]/g, '');
            return `<span class="clickable-word" data-word="${cleanWord}">${word}</span>`;
        }).join('');
    }
    
    // Highlight word in sentence
    function highlightWordInSentence(sentence, word) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        return sentence.replace(regex, `<span class="highlighted-word">${word}</span>`);
    }
    
    // Show success message for correct word selection
    function showSuccessMessage(germanWord, translation) {
        const modal = document.createElement('div');
        modal.className = 'success-modal';
        modal.innerHTML = `
            <div class="success-modal-content">
                <div class="success-icon">✅</div>
                <h3>Correct!</h3>
                <p><strong>${translation}</strong> = <strong>${germanWord}</strong></p>
                <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">Continue</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            modal.remove();
        }, 3000);
    }
    
    // Show success message with performance statistics
    function showSuccessMessageWithStats(germanWord, translation, attempts, timeSpent) {
        let performanceMessage;
        if (attempts === 0 && timeSpent < 5) {
            performanceMessage = 'Ausgezeichnet! Sofort gefunden!';
        } else if (attempts <= 1 && timeSpent < 10) {
            performanceMessage = 'Gut gemacht!';
        } else if (attempts <= 3) {
            performanceMessage = 'Weiter üben!';
        } else {
            performanceMessage = 'Nicht aufgeben - Übung macht den Meister!';
        }
        
        const modal = document.createElement('div');
        modal.className = 'success-modal';
        modal.innerHTML = `
            <div class="success-modal-content">
                <div class="success-icon">✅</div>
                <h3>Richtig!</h3>
                <p><strong>${translation}</strong> = <strong>${germanWord}</strong></p>
                <p style="font-size: 0.9em; color: #666; margin-top: 10px;">
                    ${performanceMessage}
                </p>
                <p style="font-size: 0.85em; color: #999;">
                    Zeit: ${timeSpent.toFixed(1)}s ${attempts > 0 ? `• Versuche: ${attempts + 1}` : ''}
                </p>
                <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">Weiter</button>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Auto-close after 3 seconds
        setTimeout(() => {
            modal.remove();
        }, 3000);
    }
    
    // Open dictation modal for sentences from other videos
    async function openDictationModalForOtherVideo(sentenceText, focusWord) {
        const modal = document.getElementById('dictationModal');
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        
        // Use the existing dictation modal
        currentFullSentence = sentenceText;
        currentSelectedText = '';
        currentVideoId = null; // No video ID for external sentences
        currentSentenceIndex = null;
        practiceStartTime = Date.now();
        
        // Load user settings to update dictation UI
        await loadUserSettings();
        
        // Highlight the focus word in the sentence
        sentenceDisplay.innerHTML = highlightWordInSentence(sentenceText, focusWord);
        sentenceDisplay.classList.remove('has-selection');
        
        modal.style.display = 'block';
    }
    
    // Practice sentence from word context
    window.practiceSentenceFromWord = async function(sentenceIndex, focusWord) {
        if (!window.videoSentences || !window.videoSentences[sentenceIndex]) return;
        
        const sentence = window.videoSentences[sentenceIndex];
        const modal = document.getElementById('dictationModal');
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        
        // Use the existing dictation modal
        currentFullSentence = sentence.sentence;
        currentSelectedText = '';
        currentVideoId = getVideoId();
        currentSentenceIndex = sentenceIndex;
        practiceStartTime = Date.now();
        
        // Load user settings to update dictation UI
        await loadUserSettings();
        
        // Highlight the focus word in the sentence
        sentenceDisplay.innerHTML = highlightWordInSentence(sentence.sentence, focusWord);
        sentenceDisplay.classList.remove('has-selection');
        
        // Close the sentences modal
        document.querySelector('.sentences-modal')?.remove();
        
        modal.style.display = 'block';
    };
    
    // Default dictation toggle (extracted from original card click)
    function toggleDefaultDictation(card, index) {
        const dictationArea = card.querySelector('.word-dictation-area');
        const isExpanded = dictationArea.style.display !== 'none';
        
        // Collapse all other cards
        document.querySelectorAll('.vocab-card .word-dictation-area').forEach(area => {
            area.style.display = 'none';
        });
        
        // Stop any active dictation
        if (currentCardIndex !== null && currentCardIndex !== index) {
            stopCardDictation(currentCardIndex);
        }
        
        if (!isExpanded) {
            // Show dictation area
            dictationArea.style.display = 'block';
            
            // Automatically start dictation
            setTimeout(() => {
                toggleCardDictation(index);
            }, 100);
        } else {
            // Hide dictation area
            dictationArea.style.display = 'none';
        }
    }
    
    // Display sentences for Satzauswahl mode
    function displaySentences() {
        const sentencesList = document.getElementById('sentencesList');
        if (!window.videoSentences || window.videoSentences.length === 0) {
            sentencesList.innerHTML = '<p>No sentences available for this video.</p>';
            return;
        }
        
        sentencesList.innerHTML = '<div class="sentences-container">';
        
        window.videoSentences.forEach((sentenceData, index) => {
            const sentenceCard = document.createElement('div');
            sentenceCard.className = 'sentence-card';
            sentenceCard.innerHTML = `
                <div class="sentence-number">#${index + 1}</div>
                <div class="sentence-content">
                    <div class="sentence-translation">${sentenceData.translation || sentenceData.sentence}</div>
                    <div class="sentence-original" style="display: none;">${sentenceData.sentence}</div>
                </div>
                <button class="practice-sentence-btn" onclick="practiceSentence(${index})">
                    🎤 Practice
                </button>
            `;
            sentencesList.appendChild(sentenceCard);
        });
    }
    
    // Show word selection for a specific word
    function showWordSelectionForWord(correctGermanWord, wordIndex) {
        const wordData = window.currentVocabulary[wordIndex];
        const correctTranslation = wordData.translation || 'Translation not available';
        
        // Create a selection of 10 German words including the correct one
        let wordSelection = [wordData];
        
        // Add 9 more random words from vocabulary
        const otherWords = window.currentVocabulary
            .filter((w, idx) => idx !== wordIndex)
            .sort(() => Math.random() - 0.5)
            .slice(0, 9);
        
        wordSelection = wordSelection.concat(otherWords);
        
        // Shuffle the selection
        wordSelection = wordSelection.sort(() => Math.random() - 0.5);
        
        // Create modal
        const modal = document.createElement('div');
        modal.className = 'word-selection-modal';
        modal.innerHTML = `
            <div class="word-selection-modal-content">
                <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <div class="word-selection-header">
                    <div class="selection-word-display">${correctTranslation}</div>
                    <p class="selection-instruction">Klicken Sie auf das richtige deutsche Wort:</p>
                </div>
                <div class="word-options-grid">
                    ${wordSelection.map((word) => `
                        <div class="word-option" 
                             onclick="checkWordChoice('${word.original_word}', '${correctGermanWord}', this)">
                            ${word.original_word}
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Track wrong attempts for difficulty calculation
    window.wordSelectionAttempts = window.wordSelectionAttempts || {};
    
    // Save practice data to spaced repetition system
    async function savePracticeToSpacedRepetition(word, lemma, difficulty) {
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const videoId = urlParams.get('id');
            
            const response = await fetch('/api/spacy/vocabulary-practice', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    videoId: videoId,
                    word: word,
                    lemma: lemma,
                    difficulty: difficulty
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                console.log('Practice saved:', data);
                
                // Show next review date in console
                const nextReview = new Date(data.next_review);
                const daysUntilReview = Math.ceil((nextReview - new Date()) / (1000 * 60 * 60 * 24));
                console.log(`Next review for "${word}" in ${daysUntilReview} days`);
            } else {
                console.error('Failed to save practice');
            }
        } catch (error) {
            console.error('Error saving practice:', error);
        }
    }
    
    // Check word choice
    window.checkWordChoice = function(selectedGerman, correctGerman, element) {
        // Initialize attempts counter for this word
        if (!window.wordSelectionAttempts[correctGerman]) {
            window.wordSelectionAttempts[correctGerman] = 0;
        }
        
        if (selectedGerman === correctGerman) {
            // Correct choice
            element.classList.add('correct');
            
            // Calculate difficulty based on attempts
            const attempts = window.wordSelectionAttempts[correctGerman];
            let difficulty;
            if (attempts === 0) {
                difficulty = 1; // Easy - first try
            } else if (attempts === 1) {
                difficulty = 2; // Good - second try
            } else if (attempts <= 3) {
                difficulty = 3; // Hard - few attempts
            } else {
                difficulty = 4; // Again - many attempts
            }
            
            // Find the word data to get lemma and other info
            const wordData = window.currentVocabulary.find(w => w.original_word === correctGerman);
            if (wordData) {
                // Save practice to spaced repetition system
                savePracticeToSpacedRepetition(correctGerman, wordData.lemma, difficulty);
                
                // Track activity
                if (window.activityMonitor) {
                    window.activityMonitor.trackWordSelection(correctGerman, attempts, 0);
                }
            }
            
            // Reset attempts for this word
            delete window.wordSelectionAttempts[correctGerman];
            
            // Show success and close modal after delay
            setTimeout(() => {
                const modal = element.closest('.word-selection-modal');
                modal.remove();
                
                // Show success message
                const successModal = document.createElement('div');
                successModal.className = 'success-modal';
                successModal.innerHTML = `
                    <div class="success-modal-content">
                        <div class="success-icon">✅</div>
                        <h3>Richtig!</h3>
                        <p><strong>${correctGerman}</strong></p>
                        <p style="font-size: 0.9em; color: #666;">
                            ${attempts === 0 ? 'Perfekt beim ersten Versuch!' : 
                              attempts === 1 ? 'Gut gemacht!' : 
                              'Weiter üben!'}
                        </p>
                        <button class="btn btn-primary" onclick="this.parentElement.parentElement.remove()">Weiter</button>
                    </div>
                `;
                document.body.appendChild(successModal);
                
                setTimeout(() => {
                    successModal.remove();
                }, 2000);
            }, 500);
        } else {
            // Wrong choice
            window.wordSelectionAttempts[correctGerman]++;
            element.classList.add('wrong');
            setTimeout(() => {
                element.classList.remove('wrong');
            }, 1000);
        }
    };
    
    // Display word selection interface (not used in current implementation)
    function displayWordSelection() {
        const wordList = document.getElementById('wordSelectionList');
        if (!window.currentVocabulary || window.currentVocabulary.length === 0) {
            wordList.innerHTML = '<p>No vocabulary available.</p>';
            return;
        }
        
        // Create a random selection of words (10 words)
        const selectedWords = [...window.currentVocabulary]
            .sort(() => Math.random() - 0.5)
            .slice(0, 10);
        
        // Store selected words globally for practice
        window.selectedPracticeWords = selectedWords;
        
        wordList.innerHTML = `
            <div class="word-selection-header">
                <h3>Click on a word to practice:</h3>
                <button class="refresh-words-btn" onclick="displayWordSelection()">
                    🔄 Get New Words
                </button>
            </div>
            <div class="word-selection-display">
                ${selectedWords.map((word, index) => `
                    <span class="word-selection-item" 
                          data-index="${index}" 
                          data-german="${word.original_word}"
                          onclick="practiceWordFromSelection(${index})">
                        ${word.translation || word.original_word}
                    </span>
                `).join('<span class="word-separator">, </span>')}
            </div>
        `;
    }
    
    // Practice a sentence
    window.practiceSentence = async function(index) {
        if (!window.videoSentences || !window.videoSentences[index]) return;
        
        const sentence = window.videoSentences[index];
        const modal = document.getElementById('dictationModal');
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        
        // Use the existing dictation modal but modify it for sentences
        currentFullSentence = sentence.sentence;
        currentSelectedText = '';
        currentVideoId = getVideoId();
        currentSentenceIndex = index;
        practiceStartTime = Date.now();
        
        // Load user settings to update dictation UI
        await loadUserSettings();
        
        sentenceDisplay.textContent = sentence.sentence;
        sentenceDisplay.classList.remove('has-selection');
        
        modal.style.display = 'block';
    };
    
    // Practice word from word selection mode
    window.practiceWordFromSelection = function(index) {
        if (!window.selectedPracticeWords || !window.selectedPracticeWords[index]) return;
        
        const word = window.selectedPracticeWords[index];
        const germanWord = word.original_word;
        const translation = word.translation || germanWord;
        
        // Create practice modal
        const modal = document.createElement('div');
        modal.className = 'word-practice-modal';
        modal.innerHTML = `
            <div class="word-practice-content">
                <span class="close-modal" onclick="this.parentElement.parentElement.remove()">&times;</span>
                <h2>Practice Word</h2>
                
                <div class="practice-word-display">
                    <div class="translation-large">${translation}</div>
                    <p class="instruction">Say this word in German:</p>
                </div>
                
                <div class="dictation-section">
                    <button class="dictate-btn large" onclick="toggleWordPractice(${index})">
                        <span class="mic-icon">🎤</span> Start Dictation
                    </button>
                    <div id="word-result-${index}" class="word-result" style="display: none;"></div>
                    <div id="word-feedback-${index}" class="word-feedback" style="display: none;"></div>
                </div>
                
                <div class="word-hint">
                    <button class="hint-btn" onclick="revealGermanWord(${index})">
                        💡 Show German Word
                    </button>
                    <div id="german-reveal-${index}" class="german-reveal" style="display: none;">
                        <p>German: <strong>${germanWord}</strong></p>
                        <button class="play-word-btn" onclick="speakText('${germanWord}', 0.8)">
                            🔊 Play
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        
        // Store current practice word globally
        window.currentPracticeWord = word;
        window.currentPracticeIndex = index;
    };
    
    // Toggle word practice dictation
    window.toggleWordPractice = function(index) {
        const btn = document.querySelector('.word-practice-modal .dictate-btn');
        const resultDiv = document.getElementById(`word-result-${index}`);
        const feedbackDiv = document.getElementById(`word-feedback-${index}`);
        
        if (!window.wordPracticeRecognition) {
            // Initialize recognition
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) {
                alert('Speech recognition not supported');
                return;
            }
            
            window.wordPracticeRecognition = new SpeechRecognition();
            window.wordPracticeRecognition.lang = 'de-DE';
            window.wordPracticeRecognition.continuous = false;
            window.wordPracticeRecognition.interimResults = true;
            window.wordPracticeRecognition.maxAlternatives = 1;
        }
        
        const recognition = window.wordPracticeRecognition;
        
        if (!window.isWordPracticeListening) {
            // Start listening
            recognition.onstart = () => {
                window.isWordPracticeListening = true;
                btn.innerHTML = '<span class="mic-icon">🔴</span> Stop Dictation';
                btn.classList.add('listening');
                resultDiv.style.display = 'block';
                resultDiv.innerHTML = '<p class="listening-text">Listening...</p>';
                feedbackDiv.style.display = 'none';
            };
            
            recognition.onresult = (event) => {
                let transcript = '';
                for (let i = event.resultIndex; i < event.results.length; i++) {
                    transcript = event.results[i][0].transcript;
                }
                resultDiv.innerHTML = `<p class="result-text">"${transcript}"</p>`;
                
                // Auto-stop after detecting a word
                if (transcript.trim().split(/\s+/).length >= 1) {
                    setTimeout(() => {
                        if (window.isWordPracticeListening) {
                            recognition.stop();
                        }
                    }, 500);
                }
            };
            
            recognition.onend = () => {
                window.isWordPracticeListening = false;
                btn.innerHTML = '<span class="mic-icon">🎤</span> Start Dictation';
                btn.classList.remove('listening');
                
                // Check the result
                const spokenText = resultDiv.querySelector('.result-text')?.textContent.replace(/['"]/g, '').trim();
                if (spokenText) {
                    checkWordResult(spokenText, index);
                }
            };
            
            recognition.onerror = (event) => {
                console.error('Recognition error:', event.error);
                window.isWordPracticeListening = false;
                btn.innerHTML = '<span class="mic-icon">🎤</span> Start Dictation';
                btn.classList.remove('listening');
                resultDiv.innerHTML = '<p class="error-text">Error: ' + event.error + '</p>';
            };
            
            recognition.start();
        } else {
            // Stop listening
            recognition.stop();
        }
    };
    
    // Check word result
    function checkWordResult(spokenText, index) {
        const word = window.currentPracticeWord;
        const germanWord = word.original_word.toLowerCase();
        const spoken = spokenText.toLowerCase();
        const feedbackDiv = document.getElementById(`word-feedback-${index}`);
        
        feedbackDiv.style.display = 'block';
        
        if (spoken === germanWord) {
            feedbackDiv.innerHTML = `
                <div class="feedback-success">
                    <p>✅ Correct! Excellent pronunciation!</p>
                    <div class="rating-buttons">
                        <p>How difficult was this?</p>
                        <button onclick="rateAndNext(1, ${index})" class="rate-btn easy">😄 Easy</button>
                        <button onclick="rateAndNext(2, ${index})" class="rate-btn good">😊 Good</button>
                        <button onclick="rateAndNext(3, ${index})" class="rate-btn hard">😐 Hard</button>
                        <button onclick="rateAndNext(4, ${index})" class="rate-btn again">😣 Again</button>
                    </div>
                </div>
            `;
        } else {
            feedbackDiv.innerHTML = `
                <div class="feedback-error">
                    <p>❌ Not quite right. You said: "${spokenText}"</p>
                    <p>The correct word is: <strong>${word.original_word}</strong></p>
                    <button class="try-again-btn" onclick="toggleWordPractice(${index})">Try Again</button>
                </div>
            `;
        }
    }
    
    // Reveal German word hint
    window.revealGermanWord = function(index) {
        const revealDiv = document.getElementById(`german-reveal-${index}`);
        revealDiv.style.display = 'block';
    };
    
    // Rate and go to next word
    window.rateAndNext = async function(difficulty, index) {
        const word = window.currentPracticeWord;
        const videoId = getVideoId();
        
        // Save rating
        try {
            await fetch('/api/spacy/vocabulary-practice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: videoId,
                    word: word.original_word,
                    lemma: word.lemma || word.original_word,
                    difficulty: difficulty
                }),
                credentials: 'same-origin'
            });
        } catch (error) {
            console.error('Error saving rating:', error);
        }
        
        // Close modal
        document.querySelector('.word-practice-modal').remove();
        
        // Mark word as practiced
        const wordElement = document.querySelector(`.word-selection-item[data-index="${index}"]`);
        if (wordElement) {
            wordElement.classList.add('practiced');
        }
    };
    
    // Display vocabulary
    function displayVocabulary(vocabData) {
        document.getElementById('vocabLoading').style.display = 'none';
        document.getElementById('vocabContent').style.display = 'block';
        
        // Update stats
        document.getElementById('totalWords').textContent = vocabData.count || 0;
        document.getElementById('uniqueWords').textContent = vocabData.vocabulary?.length || 0;
        
        // Display vocabulary grid
        const vocabGrid = document.getElementById('vocabGrid');
        vocabGrid.innerHTML = '';
        
        // Store vocabulary data globally for dictation
        window.currentVocabulary = vocabData.vocabulary || [];
        
        if (vocabData.vocabulary && vocabData.vocabulary.length > 0) {
            vocabData.vocabulary.forEach((word, index) => {
                const wordCard = createWordCard(word, index);
                vocabGrid.appendChild(wordCard);
            });
        } else {
            vocabGrid.innerHTML = '<p>No vocabulary found for this video.</p>';
        }
    }
    
    // Create word card
    function createWordCard(word, index) {
        const card = document.createElement('div');
        card.className = 'vocab-card';
        card.dataset.wordIndex = index;
        card.dataset.germanWord = word.original_word;
        
        const posColors = {
            'NOUN': '#3498db',
            'VERB': '#e74c3c',
            'ADJ': '#f39c12',
            'ADV': '#9b59b6',
            'default': '#95a5a6'
        };
        
        const posColor = posColors[word.pos] || posColors.default;
        
        // Show translation prominently if available
        const displayWord = word.translation || `Motherlanguage: ${word.original_word}`;
        
        card.innerHTML = `
            <div class="word-main-translation">${displayWord}</div>
            <div class="word-dictation-area" id="dictation-${index}" style="display: none;">
                <button class="dictate-btn" onclick="toggleCardDictation(${index})">
                    <span class="mic-icon">🎤</span> Start Dictation
                </button>
                <div class="dictation-result" id="result-${index}" style="display: none;"></div>
                <div class="rating-buttons" id="rating-${index}" style="display: none;">
                    <button onclick="rateWordDirect(${index}, 1)" class="rate-btn easy">😄 Easy</button>
                    <button onclick="rateWordDirect(${index}, 2)" class="rate-btn good">😊 Good</button>
                    <button onclick="rateWordDirect(${index}, 3)" class="rate-btn hard">😐 Hard</button>
                    <button onclick="rateWordDirect(${index}, 4)" class="rate-btn again">😣 Again</button>
                </div>
            </div>
            <div class="word-details-small">
                <span class="word-pos-small" style="background-color: ${posColor}">${word.pos}</span>
                <span class="word-freq">×${word.frequency}</span>
            </div>
        `;
        
        // Store word data for later use
        card.wordData = word;
        
        // Add click event to the translation text only
        const translationDiv = card.querySelector('.word-main-translation');
        translationDiv.addEventListener('click', (e) => {
            e.stopPropagation();
            
            // Toggle dictation area
            const dictationArea = card.querySelector('.word-dictation-area');
            const isExpanded = dictationArea.style.display !== 'none';
            
            // Collapse all other cards
            document.querySelectorAll('.vocab-card .word-dictation-area').forEach(area => {
                area.style.display = 'none';
            });
            
            // Stop any active dictation
            if (currentCardIndex !== null && currentCardIndex !== index) {
                stopCardDictation(currentCardIndex);
            }
            
            if (!isExpanded) {
                // Show dictation area
                dictationArea.style.display = 'block';
                
                // Automatically start dictation
                setTimeout(() => {
                    toggleCardDictation(index);
                }, 100); // Small delay to ensure UI is ready
            } else {
                // Hide dictation area
                dictationArea.style.display = 'none';
            }
        });
        
        return card;
    }
    
    // Load word context
    async function loadWordContext(word) {
        try {
            const videoId = getVideoId();
            const response = await fetch(`/api/spacy/word-context/${videoId}/${encodeURIComponent(word)}`, {
                credentials: 'same-origin'
            });
            
            if (!response.ok) throw new Error('Failed to load word context');
            
            const data = await response.json();
            if (data.success && data.data) {
                showWordContextModal(word, data.data);
            }
        } catch (error) {
            console.error('Error loading word context:', error);
        }
    }
    
    // Show word context modal with spaced repetition
    function showWordContextModal(word, contextData) {
        const modal = document.getElementById('practiceModal');
        const modalContent = modal.querySelector('.modal-content');
        
        // Store current word data for practice
        window.currentVocabWord = {
            word: word,
            lemma: contextData.word_info.lemma,
            pos: contextData.word_info.pos,
            frequency: contextData.word_info.frequency,
            translation: contextData.translation,
            motherLanguage: contextData.mother_language
        };
        
        // Different learning modes based on user preference
        const learningModes = {
            translation: contextData.translation && contextData.mother_language !== 'German',
            context: true,
            visual: false // Future: add images
        };
        
        modalContent.innerHTML = `
            <span class="close">&times;</span>
            <h2>Learn: ${word}</h2>
            
            <div class="vocab-practice-container">
                <!-- Learning Side -->
                <div id="learningSide" class="vocab-card-side">
                    <div class="word-main-large">${word}</div>
                    ${contextData.translation && !contextData.translation.startsWith('[') ? `
                        <div class="word-translation">
                            <p class="translation-text">${contextData.translation}</p>
                            <p class="translation-lang">(${contextData.mother_language})</p>
                        </div>
                    ` : contextData.mother_language !== 'German' && contextData.mother_language !== 'Deutsch' ? `
                        <div class="word-translation no-translation">
                            <p class="translation-text">Motherlanguage ${contextData.mother_language}</p>
                            <p class="translation-note">Translation coming soon</p>
                        </div>
                    ` : ''}
                    <div class="word-details">
                        <p><strong>Base form:</strong> ${contextData.word_info.lemma}</p>
                        <p><strong>Type:</strong> ${getPosDescription(contextData.word_info.pos)}</p>
                        <p><strong>Frequency:</strong> ${contextData.word_info.frequency}x in this video</p>
                    </div>
                    
                    <div class="pronunciation-buttons">
                        <button class="btn btn-primary" onclick="speakWord('${word}')">
                            🔊 German
                        </button>
                        ${contextData.translation && !contextData.translation.startsWith('[') ? `
                            <button class="btn btn-info" onclick="speakTranslation('${contextData.translation}', '${contextData.mother_language}')">
                                🔊 ${contextData.mother_language}
                            </button>
                        ` : ''}
                    </div>
                    
                    <div class="example-sentences">
                        <h4>Examples in context:</h4>
                        ${contextData.example_sentences.slice(0, 3).map(sent => 
                            `<p class="example-sentence">${highlightWord(sent, word)}</p>`
                        ).join('') || '<p>No examples found</p>'}
                    </div>
                    
                    <button class="btn btn-success" onclick="showTestSide()">
                        Test Yourself →
                    </button>
                </div>
                
                <!-- Testing Side -->
                <div id="testingSide" class="vocab-card-side" style="display: none;">
                    <h3>Say this word in German</h3>
                    
                    <div class="test-prompt">
                        <div class="translation-prompt">
                            <p class="prompt-label">Your task:</p>
                            ${contextData.translation && !contextData.translation.startsWith('[') ? `
                                <p class="prompt-text">${contextData.translation}</p>
                                <p class="prompt-lang">(${contextData.mother_language})</p>
                            ` : `
                                <p class="prompt-text">Motherlanguage ${contextData.mother_language}: <strong>${word}</strong></p>
                                <p class="prompt-instruction">Please say the German word shown above</p>
                            `}
                        </div>
                        
                        ${contextData.translation && !contextData.translation.startsWith('[') ? `
                            <div class="word-hint">
                                <p>Hints:</p>
                                <p>• Type: <strong>${getPosDescription(contextData.word_info.pos)}</strong></p>
                                <p>• First letter: <strong>${word.charAt(0).toUpperCase()}</strong></p>
                            </div>
                        ` : ''}
                    </div>
                    
                    <!-- Dictation Section -->
                    <div class="vocab-dictation-section">
                        <button id="vocabSpeechButton" class="speech-button" onclick="toggleVocabSpeech()">
                            <span class="mic-icon">🎤</span> Sprechen beginnen
                        </button>
                        
                        <div id="vocabListeningIndicator" class="listening-indicator" style="display: none;">
                            <div class="listening-animation">
                                <span class="pulse"></span>
                                <span class="pulse"></span>
                                <span class="pulse"></span>
                            </div>
                            <p>Hören zu...</p>
                        </div>
                        
                        <div id="vocabTranscribedText" class="transcribed-text"></div>
                    </div>
                    
                    <div id="recallResult" style="display: none;"></div>
                    
                    <div class="difficulty-buttons" style="display: none;">
                        <p>How difficult was this?</p>
                        <button class="diff-btn" onclick="rateWord(1)">😄 Easy</button>
                        <button class="diff-btn" onclick="rateWord(2)">😊 Good</button>
                        <button class="diff-btn" onclick="rateWord(3)">😐 Hard</button>
                        <button class="diff-btn" onclick="rateWord(4)">😣 Again</button>
                    </div>
                </div>
                
                <!-- Statistics Side -->
                <div id="statsSide" class="vocab-card-side" style="display: none;">
                    <h3>Your Progress</h3>
                    <div id="wordStats">Loading...</div>
                    <button class="btn btn-primary" onclick="location.reload()">Practice More Words</button>
                </div>
            </div>
        `;
        
        modal.querySelector('.close').onclick = () => {
            stopVocabSpeech();
            modal.style.display = 'none';
        };
        modal.style.display = 'block';
        
        // Setup vocab speech recognition
        setupVocabSpeechRecognition();
        
        // Load word statistics
        loadWordStats(word);
    }
    
    // Helper function to get POS description
    function getPosDescription(pos) {
        const descriptions = {
            'NOUN': 'Noun (Substantiv)',
            'VERB': 'Verb',
            'ADJ': 'Adjective (Adjektiv)',
            'ADV': 'Adverb',
            'PRON': 'Pronoun (Pronomen)',
            'DET': 'Determiner (Artikel)',
            'ADP': 'Preposition (Präposition)',
            'CONJ': 'Conjunction (Konjunktion)',
            'NUM': 'Number (Zahl)',
            'PROPN': 'Proper Noun (Eigenname)',
            'AUX': 'Auxiliary Verb (Hilfsverb)',
            'PART': 'Particle (Partikel)'
        };
        return descriptions[pos] || pos;
    }
    
    // Speak word function
    window.speakWord = function(word) {
        speakText(word, 0.8);
    };
    
    // Speak translation
    window.speakTranslation = function(text, language) {
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Map language to voice code
        const langMap = {
            'English': 'en-US',
            'Englisch': 'en-US',
            'Spanish': 'es-ES',
            'Spanisch': 'es-ES',
            'French': 'fr-FR',
            'Französisch': 'fr-FR',
            'Italian': 'it-IT',
            'Italienisch': 'it-IT',
            'Portuguese': 'pt-PT',
            'Portugiesisch': 'pt-PT',
            'Russian': 'ru-RU',
            'Russisch': 'ru-RU',
            'Chinese': 'zh-CN',
            'Chinesisch': 'zh-CN',
            'Japanese': 'ja-JP',
            'Japanisch': 'ja-JP',
            'Turkish': 'tr-TR',
            'Türkisch': 'tr-TR',
            'Arabic': 'ar-SA',
            'Arabisch': 'ar-SA',
            'Polish': 'pl-PL',
            'Polnisch': 'pl-PL',
            'Dutch': 'nl-NL',
            'Niederländisch': 'nl-NL',
            'Swedish': 'sv-SE',
            'Schwedisch': 'sv-SE',
            'Korean': 'ko-KR',
            'Koreanisch': 'ko-KR'
        };
        
        utterance.lang = langMap[language] || 'en-US';
        utterance.rate = 0.8;
        speechSynthesis.speak(utterance);
    };
    
    // Show test side
    window.showTestSide = function() {
        document.getElementById('learningSide').style.display = 'none';
        document.getElementById('testingSide').style.display = 'block';
    };
    
    // Vocabulary speech recognition
    let vocabRecognition = null;
    let isVocabListening = false;
    
    function setupVocabSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;
        
        vocabRecognition = new SpeechRecognition();
        vocabRecognition.lang = 'de-DE'; // Always German - the language being learned
        vocabRecognition.continuous = false;
        vocabRecognition.interimResults = true;
        vocabRecognition.maxAlternatives = 1;
        
        vocabRecognition.onstart = () => {
            isVocabListening = true;
            document.getElementById('vocabSpeechButton').innerHTML = '<span class="mic-icon">🔴</span> Sprechen beenden';
            document.getElementById('vocabSpeechButton').classList.add('listening');
            document.getElementById('vocabListeningIndicator').style.display = 'flex';
            document.getElementById('vocabTranscribedText').innerHTML = '';
        };
        
        vocabRecognition.onend = () => {
            isVocabListening = false;
            document.getElementById('vocabSpeechButton').innerHTML = '<span class="mic-icon">🎤</span> Sprechen beginnen';
            document.getElementById('vocabSpeechButton').classList.remove('listening');
            document.getElementById('vocabListeningIndicator').style.display = 'none';
            
            // Check the result
            const finalText = document.getElementById('vocabTranscribedText').textContent.trim();
            if (finalText) {
                checkVocabRecall(finalText);
            }
        };
        
        vocabRecognition.onresult = (event) => {
            let transcript = '';
            for (let i = event.resultIndex; i < event.results.length; i++) {
                transcript = event.results[i][0].transcript;
            }
            console.log('Speech recognition result:', transcript);
            const transcribedDiv = document.getElementById('vocabTranscribedText');
            if (transcribedDiv) {
                transcribedDiv.textContent = transcript;
            } else {
                console.error('vocabTranscribedText element not found');
            }
        };
        
        vocabRecognition.onerror = (event) => {
            console.error('Vocab speech recognition error:', event.error);
            stopVocabSpeech();
        };
    }
    
    window.toggleVocabSpeech = function() {
        if (!isVocabListening) {
            startVocabSpeech();
        } else {
            stopVocabSpeech();
        }
    };
    
    function startVocabSpeech() {
        if (vocabRecognition && !isVocabListening) {
            vocabRecognition.start();
        }
    }
    
    function stopVocabSpeech() {
        if (vocabRecognition && isVocabListening) {
            vocabRecognition.stop();
        }
    }
    
    // Check vocabulary recall from speech
    function checkVocabRecall(spokenText) {
        const spoken = spokenText.toLowerCase().trim();
        const correct = window.currentVocabWord.word.toLowerCase();
        const lemma = window.currentVocabWord.lemma.toLowerCase();
        const resultDiv = document.getElementById('recallResult');
        
        // Check for exact match or close match
        if (spoken === correct) {
            resultDiv.innerHTML = '<p class="correct">✅ Perfect! Excellent pronunciation!</p>';
            resultDiv.className = 'recall-result correct';
        } else if (spoken === lemma) {
            resultDiv.innerHTML = `<p class="partial">⚠️ Close! You said the base form. The answer is: <strong>${window.currentVocabWord.word}</strong></p>`;
            resultDiv.className = 'recall-result partial';
        } else if (spoken.includes(correct) || correct.includes(spoken)) {
            resultDiv.innerHTML = `<p class="partial">⚠️ Almost there! You said: "${spokenText}". The answer is: <strong>${window.currentVocabWord.word}</strong></p>`;
            resultDiv.className = 'recall-result partial';
        } else {
            resultDiv.innerHTML = `<p class="incorrect">❌ You said: "${spokenText}". The correct answer is: <strong>${window.currentVocabWord.word}</strong></p>`;
            resultDiv.className = 'recall-result incorrect';
        }
        
        resultDiv.style.display = 'block';
        document.querySelector('.difficulty-buttons').style.display = 'block';
    }
    
    // Rate word difficulty
    window.rateWord = async function(difficulty) {
        try {
            const videoId = getVideoId();
            const response = await fetch('/api/spacy/vocabulary-practice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: videoId,
                    word: window.currentVocabWord.word,
                    lemma: window.currentVocabWord.lemma,
                    difficulty: difficulty
                }),
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                showStats(data);
            }
        } catch (error) {
            console.error('Error saving practice:', error);
        }
    };
    
    // Show statistics
    function showStats(data) {
        document.getElementById('testingSide').style.display = 'none';
        document.getElementById('statsSide').style.display = 'block';
        
        const nextReview = new Date(data.next_review);
        const statsHtml = `
            <p>Review count: <strong>${data.review_count}</strong></p>
            <p>Next review: <strong>${nextReview.toLocaleDateString()}</strong></p>
            <p>Interval: <strong>${data.interval_days} days</strong></p>
        `;
        
        document.getElementById('wordStats').innerHTML = statsHtml;
    }
    
    // Load word statistics
    async function loadWordStats(word) {
        try {
            const videoId = getVideoId();
            const response = await fetch(`/api/spacy/vocabulary-stats/${videoId}/${encodeURIComponent(word)}`, {
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data.stats) {
                    // Show previous stats if available
                    console.log('Previous stats:', data.stats);
                }
            }
        } catch (error) {
            console.error('Error loading stats:', error);
        }
    }
    
    function highlightWord(sentence, word) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        return sentence.replace(regex, `<span style="background-color: yellow; font-weight: bold;">${word}</span>`);
    }
    
    // Setup cloze type buttons
    const clozeTypeButtons = document.querySelectorAll('.cloze-type-btn');
    clozeTypeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update active state
            clozeTypeButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentClozeType = btn.dataset.type;
            console.log('Selected cloze type:', currentClozeType);
        });
    });
    
    // Cloze Tests
    const startClozeBtn = document.getElementById('startClozeBtn');
    if (startClozeBtn) {
        startClozeBtn.addEventListener('click', async () => {
            const videoId = getVideoId();
            if (!videoId) return;
            
            // Show loading state
            document.getElementById('clozePlaceholder').style.display = 'none';
            document.getElementById('clozeLoading').style.display = 'block';
            startClozeBtn.style.display = 'none';
            
            try {
                // Add exercise type to the request
                const response = await fetch(`/api/spacy/cloze-tests/${videoId}?count=5&type=${currentClozeType}`, {
                    credentials: 'same-origin'
                });
                
                if (!response.ok) throw new Error('Failed to load cloze tests');
                
                const data = await response.json();
                
                if (data.success && data.data && data.data.cloze_tests) {
                    currentClozeTests = data.data.cloze_tests;
                    currentClozeIndex = 0;
                    clozeScore = 0;
                    clozeAttempts = 0;
                    displayClozeTest();
                } else {
                    throw new Error('No cloze tests available');
                }
            } catch (error) {
                console.error('Error loading cloze tests:', error);
                document.getElementById('clozeLoading').style.display = 'none';
                document.getElementById('clozePlaceholder').textContent = 'Error loading cloze tests. Please try again.';
                document.getElementById('clozePlaceholder').style.display = 'block';
                startClozeBtn.style.display = 'block';
            }
        });
    }
    
    // Display cloze test
    function displayClozeTest() {
        if (currentClozeIndex >= currentClozeTests.length) {
            showClozeResults();
            return;
        }
        
        document.getElementById('clozeLoading').style.display = 'none';
        document.getElementById('clozeContent').style.display = 'block';
        
        const test = currentClozeTests[currentClozeIndex];
        document.getElementById('clozeSentence').textContent = test.sentence;
        document.getElementById('currentQuestion').textContent = currentClozeIndex + 1;
        document.getElementById('totalQuestions').textContent = currentClozeTests.length;
        
        // Show dictation button when cloze test is displayed
        const dictationBtn = document.getElementById('clozeDictationBtn');
        if (dictationBtn) {
            dictationBtn.style.display = 'inline-block';
        }
        
        const optionsContainer = document.getElementById('clozeOptions');
        optionsContainer.innerHTML = '';
        
        test.options.forEach(option => {
            const btn = document.createElement('button');
            btn.className = 'cloze-option-btn';
            btn.textContent = option;
            btn.addEventListener('click', () => checkClozeAnswer(option, test.cloze_word));
            optionsContainer.appendChild(btn);
        });
        
        document.getElementById('clozeResult').style.display = 'none';
        document.getElementById('nextClozeBtn').style.display = 'none';
    }
    
    // Check cloze answer
    function checkClozeAnswer(answer, correctAnswer) {
        clozeAttempts++;
        const isCorrect = answer === correctAnswer;
        if (isCorrect) clozeScore++;
        
        // Disable all option buttons
        document.querySelectorAll('.cloze-option-btn').forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === correctAnswer) {
                btn.classList.add('correct');
            } else if (btn.textContent === answer && !isCorrect) {
                btn.classList.add('incorrect');
            }
        });
        
        // Show result
        const resultDiv = document.getElementById('clozeResult');
        resultDiv.textContent = isCorrect ? 'Correct! ✓' : `Incorrect. The answer is: ${correctAnswer}`;
        resultDiv.className = 'cloze-result ' + (isCorrect ? 'correct' : 'incorrect');
        resultDiv.style.display = 'block';
        
        // Update score
        document.getElementById('clozeScore').textContent = clozeScore;
        document.getElementById('clozeAttempts').textContent = clozeAttempts;
        
        // Show next button
        document.getElementById('nextClozeBtn').style.display = 'block';
    }
    
    // Next cloze test
    document.getElementById('nextClozeBtn')?.addEventListener('click', () => {
        currentClozeIndex++;
        displayClozeTest();
    });
    
    // Show final results
    function showClozeResults() {
        const clozeContent = document.getElementById('clozeContent');
        const percentage = Math.round((clozeScore / clozeAttempts) * 100);
        
        clozeContent.innerHTML = `
            <div class="cloze-final-results">
                <h3>Test Complete!</h3>
                <p>Your score: ${clozeScore} out of ${currentClozeTests.length}</p>
                <p>Accuracy: ${percentage}%</p>
                <button class="btn btn-primary" onclick="location.reload()">Try Again</button>
            </div>
        `;
    }
    
    // Card-based dictation functionality
    let cardRecognition = null;
    let isCardListening = false;
    let currentCardIndex = null;
    
    // Toggle dictation for vocabulary card
    window.toggleCardDictation = function(index) {
        if (currentCardIndex !== null && currentCardIndex !== index) {
            // Stop any other active dictation
            stopCardDictation(currentCardIndex);
        }
        
        currentCardIndex = index;
        const dictateBtn = document.querySelector(`#dictation-${index} .dictate-btn`);
        
        if (!isCardListening) {
            startCardDictation(index);
        } else {
            stopCardDictation(index);
        }
    };
    
    // Start dictation for card
    function startCardDictation(index) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            alert('Speech recognition is not supported in your browser.');
            return;
        }
        
        console.log('Starting dictation for card index:', index);
        
        // Check if microphone permission is granted
        navigator.mediaDevices.getUserMedia({ audio: true })
            .then(stream => {
                console.log('Microphone access granted');
                stream.getTracks().forEach(track => track.stop()); // Stop the test stream
                
                cardRecognition = new SpeechRecognition();
                cardRecognition.lang = 'de-DE'; // German language
                cardRecognition.continuous = false; // Single word mode
                cardRecognition.interimResults = true;
                cardRecognition.maxAlternatives = 3; // Get multiple alternatives for better accuracy
                
                const dictateBtn = document.querySelector(`#dictation-${index} .dictate-btn`);
                const resultDiv = document.getElementById(`result-${index}`);
                
                if (!resultDiv) {
                    console.error('Result div not found for index:', index);
                    return;
                }
                
                setupCardRecognitionHandlers(index, dictateBtn, resultDiv);
                
                // Start recognition
                try {
                    cardRecognition.start();
                    console.log('Speech recognition started');
                } catch (err) {
                    console.error('Failed to start speech recognition:', err);
                    alert('Failed to start speech recognition. Please try again.');
                }
            })
            .catch(err => {
                console.error('Microphone access denied:', err);
                alert('Microphone access is required for dictation. Please allow microphone access and try again.');
            });
    }
    
    function setupCardRecognitionHandlers(index, dictateBtn, resultDiv) {
        
        cardRecognition.onstart = () => {
            console.log('Dictation started');
            isCardListening = true;
            dictateBtn.innerHTML = '<span class="mic-icon">🔴</span> Stop Dictation';
            dictateBtn.classList.add('listening');
            resultDiv.style.display = 'block';
            resultDiv.innerHTML = '<p style="color: #999; font-style: italic;">Listening...</p>';
            resultDiv.dataset.finalText = ''; // Clear previous results
        };
        
        cardRecognition.onend = () => {
            console.log('Dictation ended');
            isCardListening = false;
            dictateBtn.innerHTML = '<span class="mic-icon">🎤</span> Start Dictation';
            dictateBtn.classList.remove('listening');
            
            // Get the final text from the stored data
            const finalText = (resultDiv.dataset.finalText || '').trim();
            
            console.log('Final text:', finalText);
            
            if (finalText && finalText !== '') {
                const germanWord = window.currentVocabulary[index].original_word;
                const lemma = window.currentVocabulary[index].lemma;
                
                // Check if the spoken word matches
                const isCorrect = finalText.toLowerCase() === germanWord.toLowerCase() || 
                                finalText.toLowerCase() === lemma.toLowerCase();
                
                resultDiv.innerHTML = `
                    <div class="dictation-feedback">
                        <p><strong>You said:</strong> "${finalText}"</p>
                        <p><strong>German word:</strong> "${germanWord}"</p>
                        ${isCorrect ? '<p style="color: green;">✓ Correct!</p>' : '<p style="color: orange;">Keep practicing!</p>'}
                    </div>
                `;
                resultDiv.style.display = 'block';
                
                // Show rating buttons
                document.getElementById(`rating-${index}`).style.display = 'block';
            } else {
                resultDiv.innerHTML = '<p style="color: #999;">No speech detected. Try speaking louder or check your microphone.</p>';
            }
        };
        
        cardRecognition.onresult = (event) => {
            console.log('Speech recognition result event:', event);
            let finalTranscript = '';
            let interimTranscript = '';
            
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript + ' ';
                } else {
                    interimTranscript += result[0].transcript;
                }
            }
            
            // Store final text for later use
            if (finalTranscript) {
                resultDiv.dataset.finalText = (resultDiv.dataset.finalText || '') + finalTranscript;
            }
            
            const displayText = (resultDiv.dataset.finalText || '') + interimTranscript;
            console.log('Display text:', displayText, 'Final:', finalTranscript);
            
            // Show the result div immediately with results
            resultDiv.style.display = 'block';
            if (displayText.trim()) {
                resultDiv.innerHTML = `<p style="color: #333;">"${displayText.trim()}"</p>`;
            }
            
            // Auto-stop after detecting a word (for vocabulary practice)
            if (displayText.trim()) {
                // Extract just the first word
                const firstWord = displayText.trim().split(/\s+/)[0];
                console.log('Detected word:', firstWord);
                
                // Check if we have a complete word (at least 2 characters)
                if (firstWord.length >= 2) {
                    // Wait a short moment to catch any final adjustments
                    setTimeout(() => {
                        if (isCardListening && cardRecognition) {
                            console.log('Auto-stopping after word detection');
                            cardRecognition.stop();
                        }
                    }, 500); // 500ms delay to ensure we catch the final result
                }
            }
        };
        
        cardRecognition.onerror = (event) => {
            console.error('Card speech recognition error:', event.error);
            isCardListening = false;
            
            if (event.error === 'no-speech') {
                resultDiv.innerHTML = '<p style="color: #ff6b6b;">No speech detected. Please speak clearly into your microphone.</p>';
            } else if (event.error === 'not-allowed') {
                resultDiv.innerHTML = '<p style="color: #ff6b6b;">Microphone access denied. Please allow microphone access in your browser settings.</p>';
            } else if (event.error === 'network') {
                resultDiv.innerHTML = '<p style="color: #ff6b6b;">Network error. Please check your internet connection.</p>';
            } else {
                resultDiv.innerHTML = `<p style="color: #ff6b6b;">Error: ${event.error}. Please try again.</p>`;
            }
            
            dictateBtn.innerHTML = '<span class="mic-icon">🎤</span> Start Dictation';
            dictateBtn.classList.remove('listening');
        };
        
        cardRecognition.onspeechstart = () => {
            console.log('Speech detected!');
            // Don't overwrite the result div, just log it
        };
        
        cardRecognition.onspeechend = () => {
            console.log('Speech ended');
        };
        
        cardRecognition.onaudiostart = () => {
            console.log('Audio capture started');
        };
        
        cardRecognition.onaudioend = () => {
            console.log('Audio capture ended');
        };
    }
    
    // Stop dictation for card
    function stopCardDictation(index) {
        if (cardRecognition && isCardListening) {
            cardRecognition.stop();
        }
    }
    
    // Rate word directly from card
    window.rateWordDirect = async function(index, difficulty) {
        const word = window.currentVocabulary[index];
        const videoId = getVideoId();
        
        try {
            const response = await fetch('/api/spacy/vocabulary-practice', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    videoId: videoId,
                    word: word.original_word,
                    lemma: word.lemma || word.original_word,
                    difficulty: difficulty
                }),
                credentials: 'same-origin'
            });
            
            if (response.ok) {
                const data = await response.json();
                
                // Show feedback
                const ratingButtons = document.getElementById(`rating-${index}`);
                const feedback = document.createElement('div');
                feedback.className = 'rating-feedback';
                feedback.innerHTML = `
                    <p class="success">✓ Rating saved!</p>
                    <p>Next review: ${new Date(data.next_review).toLocaleDateString()}</p>
                `;
                ratingButtons.appendChild(feedback);
                
                // Hide rating buttons after feedback
                setTimeout(() => {
                    ratingButtons.style.display = 'none';
                    // Collapse the dictation area
                    document.getElementById(`dictation-${index}`).style.display = 'none';
                }, 2000);
            }
        } catch (error) {
            console.error('Error saving rating:', error);
        }
    };
    
    // Prevent right-click on learning content
    document.addEventListener('contextmenu', (e) => {
        if (e.target.closest('.learning-content, .notranslate, .clickable-sentence')) {
            e.preventDefault();
            return false;
        }
    });
    
    // Detect and warn about translation attempts
    let translationWarningShown = false;
    const detectTranslation = () => {
        // Check if Google Translate is active
        if (document.documentElement.classList.contains('translated-ltr') || 
            document.documentElement.classList.contains('translated-rtl') ||
            document.querySelector('font') || // Old Google Translate
            document.querySelector('#goog-gt-tt') || // Google Translate toolbar
            document.querySelector('.goog-te-menu')) { // Google Translate menu
            
            if (!translationWarningShown) {
                translationWarningShown = true;
                alert('⚠️ Warnung: Bitte deaktivieren Sie die Übersetzung für optimales Lernen!\n\nTranslation tools will prevent proper language learning. Please disable translation.');
            }
        }
    };
    
    // Check periodically for translation
    setInterval(detectTranslation, 2000);
});