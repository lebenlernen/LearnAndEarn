// Transcript page functionality
let player;
let subtitles = [];
let currentSubtitleIndex = -1;
let isPlayerReady = false;

document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authData = await checkAuth();
    
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Update header
    updateAuthUI();
    
    // Get video ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get('id');
    
    if (!videoId) {
        showError('No video ID provided');
        return;
    }
    
    // Set back link
    const backLink = document.getElementById('backToVideo');
    backLink.href = `/detail.html?id=${videoId}`;
    
    // Load video data
    await loadVideoData(videoId);
});

// Load video data including subtitles
async function loadVideoData(videoId) {
    try {
        const response = await fetch(`/api/videos/${videoId}`, {
            credentials: 'same-origin'
        });
        if (!response.ok) {
            throw new Error('Video not found');
        }
        
        const video = await response.json();
        console.log('Video data received:', video); // Debug log
        
        // Initialize YouTube player with the actual YouTube video ID
        if (video.video_id) {
            console.log('Initializing YouTube player with ID:', video.video_id); // Debug log
            initializeYouTubePlayer(video.video_id);
        } else {
            showError('YouTube Video ID nicht gefunden');
            return;
        }
        
        // Parse subtitles from JSON - check different possible fields
        const subtitleData = video.subtitle || video.subtitles || video.pure_subtitle;
        
        if (subtitleData) {
            console.log('Raw subtitle data:', subtitleData); // Debug log
            try {
                // Handle different subtitle formats
                let parsedSubtitles;
                if (typeof subtitleData === 'string') {
                    // Try to parse as JSON
                    try {
                        parsedSubtitles = JSON.parse(subtitleData);
                    } catch (e) {
                        // If not JSON, might be plain text - create simple subtitles
                        console.log('Subtitle is not JSON, treating as plain text');
                        // Split by sentences and create basic subtitles
                        const sentences = subtitleData.match(/[^.!?]+[.!?]+/g) || [subtitleData];
                        parsedSubtitles = sentences.map((text, index) => ({
                            start: index * 5, // 5 seconds per sentence as estimate
                            end: (index + 1) * 5,
                            text: text.trim()
                        }));
                    }
                } else {
                    parsedSubtitles = subtitleData;
                }
                
                // Convert time strings to seconds if needed
                parsedSubtitles = parsedSubtitles.map((subtitle, index) => {
                    // Calculate end time from start + duration if needed
                    let endTime;
                    if (subtitle.end !== undefined) {
                        endTime = convertToSeconds(subtitle.end);
                    } else if (subtitle.duration !== undefined) {
                        endTime = convertToSeconds(subtitle.start) + convertToSeconds(subtitle.duration);
                    } else {
                        // Default to 2 seconds duration if not specified
                        endTime = convertToSeconds(subtitle.start) + 2;
                    }
                    
                    const converted = {
                        start: convertToSeconds(subtitle.start),
                        end: endTime,
                        text: subtitle.text
                    };
                    
                    // Debug first few subtitles
                    if (index < 5) {
                        console.log(`Subtitle ${index}: start=${converted.start.toFixed(2)}, end=${converted.end.toFixed(2)}, text="${subtitle.text.substring(0, 30)}..."`);
                    }
                    
                    return converted;
                });
                
                console.log('Total parsed subtitles:', parsedSubtitles.length);
                console.log('First 5 subtitles:', parsedSubtitles.slice(0, 5));
                subtitles = parsedSubtitles;
                displaySubtitles();
            } catch (error) {
                console.error('Error parsing subtitles:', error);
                showNoSubtitles();
            }
        } else {
            console.log('No subtitle field in video data'); // Debug log
            // For testing, let's create some dummy subtitles
            console.log('Creating test subtitles for demonstration');
            subtitles = [
                { start: 0, end: 5, text: "Test subtitle 1 - Dies ist ein Test" },
                { start: 5, end: 10, text: "Test subtitle 2 - Weitere Testuntertitel" },
                { start: 10, end: 15, text: "Test subtitle 3 - Noch mehr Test" },
                { start: 15, end: 20, text: "Test subtitle 4 - Letzter Test" }
            ];
            displaySubtitles();
        }
    } catch (error) {
        console.error('Error loading video data:', error);
        showError('Fehler beim Laden der Videodaten');
    }
}

// Initialize YouTube player
function initializeYouTubePlayer(youtubeVideoId) {
    console.log('initializeYouTubePlayer called with:', youtubeVideoId); // Debug log
    
    // For now, let's use a simple iframe approach that works
    const videoContainer = document.getElementById('videoPlayer');
    videoContainer.innerHTML = `
        <iframe 
            id="youtube-iframe"
            width="100%" 
            height="100%" 
            src="https://www.youtube.com/embed/${youtubeVideoId}?enablejsapi=1&rel=0&modestbranding=1" 
            frameborder="0" 
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
            allowfullscreen>
        </iframe>
    `;
    
    // Load YouTube IFrame API for controlling the player
    if (!window.YT && !document.querySelector('script[src*="youtube.com/iframe_api"]')) {
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        const firstScriptTag = document.getElementsByTagName('script')[0];
        firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
    } else if (window.YT && window.YT.Player) {
        // API already loaded, create player directly
        setTimeout(() => {
            window.onYouTubeIframeAPIReady();
        }, 100);
    }
    
    // YouTube API callback
    window.onYouTubeIframeAPIReady = function() {
        console.log('YouTube API ready, getting existing iframe'); // Debug log
        try {
            player = new YT.Player('youtube-iframe', {
                events: {
                    'onReady': onPlayerReady,
                    'onStateChange': onPlayerStateChange,
                    'onError': onPlayerError
                }
            });
        } catch (error) {
            console.error('Error creating YT.Player:', error);
            // Fallback: Try again after a short delay
            setTimeout(() => {
                try {
                    player = new YT.Player('youtube-iframe', {
                        events: {
                            'onReady': onPlayerReady,
                            'onStateChange': onPlayerStateChange,
                            'onError': onPlayerError
                        }
                    });
                } catch (retryError) {
                    console.error('Retry failed:', retryError);
                }
            }, 1000);
        }
    };
}


// Player ready callback
function onPlayerReady(event) {
    console.log('Player is ready');
    isPlayerReady = true;
    
    // Start checking current time
    setInterval(() => {
        updateCurrentSubtitle();
    }, 100);
}

// Player state change callback
function onPlayerStateChange(event) {
    // Handle player state changes if needed
}

// Player error callback
function onPlayerError(event) {
    console.error('YouTube player error:', event.data);
    let errorMessage = 'Video konnte nicht geladen werden. ';
    switch(event.data) {
        case 2:
            errorMessage += 'Ungültige Video ID.';
            break;
        case 5:
            errorMessage += 'HTML5 Player Fehler.';
            break;
        case 100:
            errorMessage += 'Video nicht gefunden.';
            break;
        case 101:
        case 150:
            errorMessage += 'Video kann nicht eingebettet werden.';
            break;
        default:
            errorMessage += 'Unbekannter Fehler.';
    }
    showError(errorMessage);
}

// Update currently highlighted subtitle based on video time
function updateCurrentSubtitle() {
    if (!isPlayerReady || !player || typeof player.getCurrentTime !== 'function') {
        return;
    }
    
    try {
        const currentTime = player.getCurrentTime();
        let newIndex = -1;
        
        // Debug: Log every 10th call to avoid console spam
        if (Math.random() < 0.05) { // Reduced frequency
            console.log('Current time:', currentTime.toFixed(2), 'Looking for subtitle...');
            
            // Find which subtitle should be active
            let found = false;
            for (let i = 0; i < subtitles.length; i++) {
                if (currentTime >= subtitles[i].start && currentTime <= subtitles[i].end) {
                    console.log(`Found active subtitle ${i}: ${subtitles[i].start}-${subtitles[i].end}`);
                    found = true;
                    break;
                }
            }
            
            if (!found) {
                // Find nearest subtitle
                for (let i = 0; i < subtitles.length; i++) {
                    if (Math.abs(currentTime - subtitles[i].start) < 2) {
                        console.log(`Near subtitle ${i}: start=${subtitles[i].start}, current=${currentTime.toFixed(2)}, diff=${(currentTime - subtitles[i].start).toFixed(2)}`);
                    }
                }
            }
        }
        
        // Find the subtitle that matches current time
        for (let i = 0; i < subtitles.length; i++) {
            const subtitle = subtitles[i];
            if (currentTime >= subtitle.start && currentTime <= subtitle.end) {
                newIndex = i;
                break;
            }
        }
        
        // If no exact match, find the closest subtitle
        if (newIndex === -1 && subtitles.length > 0) {
            // Find the subtitle that just passed
            for (let i = subtitles.length - 1; i >= 0; i--) {
                if (currentTime >= subtitles[i].start) {
                    // Check if we're reasonably close (within 1 second after end)
                    if (currentTime - subtitles[i].end < 1) {
                        newIndex = i;
                    }
                    break;
                }
            }
        }
        
        // Update highlight if changed
        if (newIndex !== currentSubtitleIndex) {
            console.log(`Subtitle change: ${currentSubtitleIndex} -> ${newIndex} at time ${currentTime}`);
            
            // Remove previous highlight
            if (currentSubtitleIndex >= 0) {
                const prevElement = document.querySelector(`[data-subtitle-index="${currentSubtitleIndex}"]`);
                if (prevElement) {
                    prevElement.classList.remove('active');
                }
            }
            
            // Add new highlight and update past/future subtitles
            if (newIndex >= 0) {
                // Update all subtitles to mark past ones
                document.querySelectorAll('.subtitle-line').forEach((el, idx) => {
                    if (idx < newIndex) {
                        el.classList.add('past');
                    } else {
                        el.classList.remove('past');
                    }
                });
                
                const newElement = document.querySelector(`[data-subtitle-index="${newIndex}"]`);
                if (newElement) {
                    newElement.classList.add('active');
                    console.log('Added active class to subtitle', newIndex);
                    
                    // No need to scroll on mobile since past subtitles are hidden
                    // Only scroll on desktop
                    const isMobile = window.innerWidth <= 968;
                    
                    if (!isMobile) {
                        // On desktop: keep centered behavior
                        const container = document.querySelector('.transcript-section');
                        if (container) {
                            const elementRect = newElement.getBoundingClientRect();
                            const containerRect = container.getBoundingClientRect();
                            const elementCenter = elementRect.top + elementRect.height / 2;
                            const containerCenter = containerRect.top + containerRect.height / 2;
                            const scrollOffset = elementCenter - containerCenter;
                            
                            container.scrollBy({
                                top: scrollOffset,
                                behavior: 'smooth'
                            });
                        }
                    }
                }
            }
            
            currentSubtitleIndex = newIndex;
        }
    } catch (error) {
        console.error('Error updating subtitle:', error);
    }
}

// Display subtitles in the transcript section
function displaySubtitles() {
    const container = document.getElementById('transcriptContent');
    
    if (!subtitles || subtitles.length === 0) {
        showNoSubtitles();
        return;
    }
    
    // Debug: Log some subtitle data
    console.log('Displaying subtitles. First 5:', subtitles.slice(0, 5));
    
    // Create subtitle elements
    const subtitleElements = subtitles.map((subtitle, index) => {
        const div = document.createElement('div');
        div.className = 'subtitle-line';
        div.dataset.subtitleIndex = index;
        
        // Format time - use the actual start time
        const startTime = formatTime(subtitle.start);
        
        // Debug for first few
        if (index < 5) {
            console.log(`Display subtitle ${index}: start=${subtitle.start}s -> displayed as ${startTime}`);
        }
        
        div.innerHTML = `
            <span class="subtitle-time">${startTime}</span>
            <span class="subtitle-text">${subtitle.text}</span>
        `;
        
        // Click to seek
        div.addEventListener('click', () => {
            if (isPlayerReady && player.seekTo) {
                console.log(`Clicking subtitle ${index}, seeking to ${subtitle.start}`);
                player.seekTo(subtitle.start, true);
            }
        });
        
        return div;
    });
    
    // Clear container and add subtitles
    container.innerHTML = '';
    subtitleElements.forEach(el => container.appendChild(el));
}

// Format time in MM:SS format
function formatTime(seconds) {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

// Convert time to seconds (handles both numeric and string formats like "MM:SS" or "HH:MM:SS")
function convertToSeconds(time) {
    // If already a number, return it
    if (typeof time === 'number') {
        return time;
    }
    
    // If it's a string time format
    if (typeof time === 'string') {
        const parts = time.split(':').map(p => parseFloat(p));
        if (parts.length === 3) {
            // HH:MM:SS
            return parts[0] * 3600 + parts[1] * 60 + parts[2];
        } else if (parts.length === 2) {
            // MM:SS
            return parts[0] * 60 + parts[1];
        } else if (parts.length === 1) {
            // Just seconds
            return parts[0];
        }
    }
    
    return 0; // Default fallback
}

// Show no subtitles message
function showNoSubtitles() {
    const container = document.getElementById('transcriptContent');
    container.innerHTML = `
        <div class="no-subtitles">
            <p>Keine Untertitel für dieses Video verfügbar.</p>
        </div>
    `;
}

// Show error message
function showError(message) {
    const container = document.getElementById('transcriptContent');
    container.innerHTML = `
        <div class="no-subtitles">
            <p style="color: #dc3545;">${message}</p>
        </div>
    `;
}