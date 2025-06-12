// Student Sessions functionality
let currentUser = null;
let myClasses = [];
let upcomingSessions = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated
    const authData = await checkAuth();
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Load school info
    try {
        const response = await fetch('/api/school/info');
        if (!response.ok) throw new Error('Failed to load school info');
        
        const data = await response.json();
        currentUser = data.user;
        myClasses = data.classes;
        
        // Update UI with user info
        document.getElementById('userName').textContent = currentUser.username;
        
        // Display classes and load sessions
        displayClasses();
        loadUpcomingSessions();
        
    } catch (error) {
        console.error('Error loading student data:', error);
    }
});

function displayClasses() {
    const container = document.getElementById('myClasses');
    
    if (myClasses.length === 0) {
        container.innerHTML = '<p class="empty-state">Sie sind noch keiner Klasse beigetreten</p>';
        return;
    }
    
    container.innerHTML = myClasses.map(cls => `
        <div class="class-card">
            <h3>${cls.name}</h3>
            <p>${cls.description || 'Keine Beschreibung'}</p>
            <p class="teacher-name">Lehrer: ${cls.teacher_name}</p>
        </div>
    `).join('');
}

async function loadUpcomingSessions() {
    try {
        const response = await fetch('/api/school/sessions/upcoming');
        if (!response.ok) throw new Error('Failed to load sessions');
        
        upcomingSessions = await response.json();
        displaySessions();
        
    } catch (error) {
        console.error('Error loading sessions:', error);
    }
}

function displaySessions() {
    const container = document.getElementById('upcomingSessions');
    
    if (upcomingSessions.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine bevorstehenden Stunden</p>';
        return;
    }
    
    // Separate active and scheduled sessions
    const activeSessions = upcomingSessions.filter(s => s.status === 'active');
    const scheduledSessions = upcomingSessions.filter(s => s.status === 'scheduled');
    
    let html = '';
    
    // Show active sessions first
    if (activeSessions.length > 0) {
        html += '<h3 class="session-status-header">🔴 Live jetzt</h3>';
        html += activeSessions.map(session => createSessionCard(session, true)).join('');
    }
    
    // Show scheduled sessions
    if (scheduledSessions.length > 0) {
        if (activeSessions.length > 0) {
            html += '<h3 class="session-status-header">📅 Geplant</h3>';
        }
        html += scheduledSessions.map(session => createSessionCard(session, false)).join('');
    }
    
    container.innerHTML = html;
}

function createSessionCard(session, isActive) {
    const startTime = new Date(session.scheduled_start);
    const endTime = new Date(session.scheduled_end);
    
    return `
        <div class="session-card ${isActive ? 'active' : ''}">
            <h3>${session.title}</h3>
            <p class="session-teacher">Lehrer: ${session.teacher_name}</p>
            <p class="session-class">${session.class_name || 'Einzelstunde'}</p>
            <p class="session-time">
                ${startTime.toLocaleDateString('de-DE')} 
                ${startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - 
                ${endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
            </p>
            <div class="session-actions">
                ${isActive ? `
                    <button class="btn btn-primary" onclick="joinSession(${session.id})">
                        Jetzt teilnehmen
                    </button>
                ` : `
                    <span class="session-countdown" data-start="${session.scheduled_start}">
                        Beginnt in ${getTimeUntil(session.scheduled_start)}
                    </span>
                `}
            </div>
        </div>
    `;
}

function getTimeUntil(dateString) {
    const now = new Date();
    const target = new Date(dateString);
    const diff = target - now;
    
    if (diff < 0) return 'Vergangen';
    
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
        const days = Math.floor(hours / 24);
        return `${days} Tag${days !== 1 ? 'en' : ''}`;
    } else if (hours > 0) {
        return `${hours} Stunde${hours !== 1 ? 'n' : ''}`;
    } else {
        return `${minutes} Minute${minutes !== 1 ? 'n' : ''}`;
    }
}

async function joinSession(sessionId) {
    try {
        // Record joining the session
        const response = await fetch(`/api/school/sessions/${sessionId}/join`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to join session');
        
        // Initialize WebSocket and join session
        if (window.schoolMode) {
            window.schoolMode.joinSession(sessionId);
        }
        
        // Navigate to search page to start following teacher
        window.location.href = '/search.html';
        
    } catch (error) {
        console.error('Error joining session:', error);
        alert('Fehler beim Beitreten zur Stunde');
    }
}

// Update countdown timers every minute
setInterval(() => {
    document.querySelectorAll('.session-countdown').forEach(el => {
        const startTime = el.getAttribute('data-start');
        el.textContent = `Beginnt in ${getTimeUntil(startTime)}`;
    });
}, 60000);