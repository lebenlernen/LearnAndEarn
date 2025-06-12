document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authData = await checkAuth();
    
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Update header
    updateAuthUI();
    
    // Load user data
    loadUserProfile(authData.user);
    
    // Handle form submission
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
    
    // Handle video adding form if visible
    const addVideoForm = document.getElementById('addVideoForm');
    if (addVideoForm) {
        addVideoForm.addEventListener('submit', handleVideoAdd);
    }
});

// Load user profile data
const loadUserProfile = (user) => {
    // Display basic info
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userUsername').textContent = user.username;
    
    // Display roles
    const roles = user.roles || [user.role || 'student'];
    const rolesElement = document.getElementById('userRoles');
    rolesElement.innerHTML = roles.map(role => {
        let roleClass = '';
        if (role === 'admin') roleClass = 'admin';
        else if (role === 'teacher') roleClass = 'teacher';
        else if (role === 'student') roleClass = 'student';
        return `<span class="user-role ${roleClass}">${role}</span>`;
    }).join(' ');
    
    // Show teacher section if user is teacher or admin
    if (roles.includes('teacher') || roles.includes('admin')) {
        document.getElementById('teacherSection').style.display = 'block';
    }
    
    // Show admin section if user is admin
    if (roles.includes('admin')) {
        document.getElementById('adminSection').style.display = 'block';
    }
    
    // Set form values
    if (user.country) {
        document.getElementById('country').value = user.country;
    }
    if (user.mother_language) {
        document.getElementById('motherLanguage').value = user.mother_language;
    }
    if (user.timezone) {
        document.getElementById('timezone').value = user.timezone;
    }
    if (user.use_system_dictation !== undefined) {
        document.getElementById('useSystemDictation').checked = user.use_system_dictation;
    }
};

// Handle profile update
const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    // Hide messages
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    
    const formData = {
        country: document.getElementById('country').value,
        mother_language: document.getElementById('motherLanguage').value,
        timezone: document.getElementById('timezone').value,
        use_system_dictation: document.getElementById('useSystemDictation').checked
    };
    
    try {
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update profile');
        }
        
        const result = await response.json();
        
        // Show success message
        successMessage.textContent = 'Profil erfolgreich aktualisiert!';
        successMessage.style.display = 'block';
        
        // Scroll to top to show message
        window.scrollTo(0, 0);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        errorMessage.textContent = error.message || 'Fehler beim Aktualisieren des Profils';
        errorMessage.style.display = 'block';
        window.scrollTo(0, 0);
    }
};

// Handle video adding
const handleVideoAdd = async (e) => {
    e.preventDefault();
    
    const youtubeUrl = document.getElementById('youtubeUrl').value.trim();
    const videoPreview = document.getElementById('videoPreview');
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Hide previous messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    // Extract video ID from URL
    const videoId = extractVideoId(youtubeUrl);
    if (!videoId) {
        errorMessage.textContent = 'Ungültige YouTube URL';
        errorMessage.style.display = 'block';
        return;
    }
    
    // Show loading state
    videoPreview.innerHTML = '<div class="loading-spinner">Video wird geladen...</div>';
    videoPreview.style.display = 'block';
    
    try {
        // Fetch video information and transcript
        const response = await fetch('/api/videos/youtube/preview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId, url: youtubeUrl }),
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Fehler beim Laden des Videos');
        }
        
        const data = await response.json();
        
        // Display video preview
        displayVideoPreview(data);
        
    } catch (error) {
        console.error('Error loading video:', error);
        errorMessage.textContent = error.message || 'Fehler beim Laden des Videos';
        errorMessage.style.display = 'block';
        videoPreview.style.display = 'none';
    }
};

// Extract YouTube video ID from various URL formats
const extractVideoId = (url) => {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
        /youtube\.com\/v\/([^&\n?#]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    return null;
};

// Display video preview with transcript options
const displayVideoPreview = (data) => {
    const videoPreview = document.getElementById('videoPreview');
    
    let transcriptOptions = '';
    if (data.transcripts && data.transcripts.length > 0) {
        transcriptOptions = `
            <div class="language-select">
                <label>Verfügbare Untertitel:</label>
                <select id="transcriptLanguage" class="form-control">
                    ${data.transcripts.map(t => 
                        `<option value="${t.language_code}" ${t.is_generated ? '(auto)' : ''}>
                            ${t.language} ${t.is_generated ? '(automatisch generiert)' : '(manuell)'}
                        </option>`
                    ).join('')}
                </select>
            </div>
        `;
    }
    
    videoPreview.innerHTML = `
        <div class="video-preview-container">
            <div class="video-info">
                <h5>${data.title}</h5>
                <p><strong>Kanal:</strong> ${data.channel}</p>
                <p><strong>Dauer:</strong> ${data.duration}</p>
                ${data.description ? `<p><strong>Beschreibung:</strong> ${data.description.substring(0, 200)}...</p>` : ''}
            </div>
            
            ${transcriptOptions}
            
            ${data.transcript ? `
                <div class="transcript-preview">
                    <strong>Transkript-Vorschau:</strong><br>
                    ${data.transcript.substring(0, 500)}...
                </div>
            ` : '<p style="color: #dc3545;">Keine Untertitel verfügbar</p>'}
            
            ${data.transcripts && data.transcripts.length > 0 ? `
                <div style="margin-top: 20px; display: flex; gap: 10px;">
                    <button type="button" class="btn-save" onclick="saveVideo('${data.videoId}')">
                        Video speichern
                    </button>
                    ${data.videoExists ? `
                        <button type="button" class="btn-save" style="background: #f39c12;" onclick="updateVideo('${data.videoId}')">
                            ✓ Video aktualisieren
                        </button>
                    ` : ''}
                </div>
            ` : '<p style="color: #dc3545;">Keine Untertitel verfügbar - Video kann nicht hinzugefügt werden</p>'}
        </div>
    `;
};

// Save video to database
window.saveVideo = async (videoId) => {
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    const transcriptLanguage = document.getElementById('transcriptLanguage')?.value || 'de';
    
    try {
        const response = await fetch('/api/videos/youtube/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                videoId,
                language: transcriptLanguage
            }),
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Fehler beim Speichern des Videos');
        }
        
        const result = await response.json();
        
        // Show success message
        successMessage.textContent = 'Video erfolgreich hinzugefügt!';
        successMessage.style.display = 'block';
        
        // Clear form and preview
        document.getElementById('youtubeUrl').value = '';
        document.getElementById('videoPreview').style.display = 'none';
        
        // Redirect to the new video after a short delay
        if (result.videoId) {
            setTimeout(() => {
                window.location.href = `/detail.html?id=${result.videoId}`;
            }, 2000);
        }
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        console.error('Error saving video:', error);
        let errorText = error.message || 'Fehler beim Speichern des Videos';
        
        // Add helpful hints for common errors
        if (errorText.includes('transcript') || errorText.includes('XML')) {
            errorText += '\n\nHinweis: Dieses Video hat möglicherweise fehlerhafte automatisch generierte Untertitel. Bitte versuchen Sie ein anderes Video oder eines mit manuellen Untertiteln.';
        } else if (errorText.includes('already exists') || errorText.includes('bereits vorhanden')) {
            errorText = 'Dieses Video ist bereits in der Datenbank vorhanden.';
        }
        
        errorMessage.textContent = errorText;
        errorMessage.style.display = 'block';
        errorMessage.style.whiteSpace = 'pre-line'; // Allow line breaks
        window.scrollTo(0, 0);
    }
};

// Update existing video (regenerate AI summary)
window.updateVideo = async (videoId) => {
    const errorMessage = document.getElementById('errorMessage');
    const successMessage = document.getElementById('successMessage');
    
    // Hide previous messages
    errorMessage.style.display = 'none';
    successMessage.style.display = 'none';
    
    try {
        // Show loading message
        successMessage.textContent = 'AI-Zusammenfassung wird aktualisiert...';
        successMessage.style.display = 'block';
        
        const response = await fetch('/api/videos/youtube/update', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ videoId }),
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.message || 'Fehler beim Aktualisieren des Videos');
        }
        
        const result = await response.json();
        
        // Show success message
        successMessage.textContent = 'Video-Update wurde gestartet! Die AI-Zusammenfassung wird im Hintergrund generiert.';
        successMessage.style.display = 'block';
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Hide success message after 5 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 5000);
        
    } catch (error) {
        console.error('Error updating video:', error);
        errorMessage.textContent = error.message || 'Fehler beim Aktualisieren des Videos';
        errorMessage.style.display = 'block';
        window.scrollTo(0, 0);
    }
};