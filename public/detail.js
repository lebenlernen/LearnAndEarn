// Simple text-to-speech function that works
const speakText = (text, rate) => {
    // Cancel any ongoing speech
    speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'de-DE'; // German language
    utterance.rate = rate;
    utterance.pitch = 1.0;
    utterance.volume = 1.0;
    
    speechSynthesis.speak(utterance);
};

// Make functions globally available
window.speakText = speakText;

document.addEventListener('DOMContentLoaded', () => {
    const videoDetailContainer = document.getElementById('videoDetail');
    
    // Get video ID from URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    
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
            <div class="video-player-container">
                <iframe 
                    src="${embedUrl}" 
                    frameborder="0" 
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                    allowfullscreen>
                </iframe>
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
            sentenceDisplay.addEventListener('mouseup', () => {
                const selection = window.getSelection();
                const selectedText = selection.toString().trim();
                
                if (selectedText && selectedText.length > 0) {
                    currentSelectedText = selectedText;
                    // Highlight the selection
                    sentenceDisplay.classList.add('has-selection');
                } else {
                    currentSelectedText = '';
                    sentenceDisplay.classList.remove('has-selection');
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
    const openDictationModal = (sentence, sentenceIndex = null) => {
        const modal = document.getElementById('dictationModal');
        const sentenceDisplay = document.getElementById('sentenceDisplay');
        
        // Reset modal
        currentFullSentence = sentence;
        currentSelectedText = '';
        currentVideoId = videoId; // Store video ID for tracking
        currentSentenceIndex = sentenceIndex;
        practiceStartTime = Date.now(); // Start timing
        sentenceDisplay.textContent = sentence;
        sentenceDisplay.classList.remove('has-selection');
        
        // Clear previous results
        if (document.getElementById('transcribedText')) {
            document.getElementById('transcribedText').innerHTML = '';
            document.getElementById('transcribedText').dataset.finalText = '';
        }
        if (document.getElementById('comparisonResult')) {
            document.getElementById('comparisonResult').innerHTML = '';
        }
        
        // Re-attach play button event listeners
        const playButton = document.getElementById('playButton');
        const slowPlayButton = document.getElementById('slowPlayButton');
        
        if (playButton) {
            // Remove old listener and add new one
            playButton.replaceWith(playButton.cloneNode(true));
            const newPlayButton = document.getElementById('playButton');
            newPlayButton.addEventListener('click', () => {
                const textToPlay = currentSelectedText || currentFullSentence;
                speakText(textToPlay, 1.0);
            });
        }
        
        if (slowPlayButton) {
            // Remove old listener and add new one
            slowPlayButton.replaceWith(slowPlayButton.cloneNode(true));
            const newSlowPlayButton = document.getElementById('slowPlayButton');
            newSlowPlayButton.addEventListener('click', () => {
                const textToPlay = currentSelectedText || currentFullSentence;
                speakText(textToPlay, 0.6);
            });
        }
        
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
        const targetText = currentSelectedText || currentFullSentence;
        const comparisonResult = document.getElementById('comparisonResult');
        
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
    

    window.startSpeechRecognition = startSpeechRecognition;
    window.showPracticeHistory = showPracticeHistory;
    window.openDictationModal = openDictationModal;
    
    // Setup modals
    setupDictationModal();
    setupSpeechRecognition();
    setupHistoryModal();
    
    // Fetch video details on page load
    fetchVideoDetails();
    
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