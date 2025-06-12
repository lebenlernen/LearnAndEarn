// Teacher Dashboard functionality
let currentUser = null;
let userClasses = [];
let upcomingSessions = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is authenticated and is a teacher
    const authData = await checkAuth();
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Load school info to check if teacher
    try {
        const response = await fetch('/api/school/info');
        if (!response.ok) throw new Error('Failed to load school info');
        
        const data = await response.json();
        currentUser = data.user;
        
        if (!currentUser.is_teacher) {
            alert('Diese Seite ist nur für Lehrer zugänglich');
            window.location.href = '/home.html';
            return;
        }
        
        // Update UI with user info
        document.getElementById('userName').textContent = currentUser.username;
        
        // Load classes and sessions
        userClasses = data.classes;
        displayClasses();
        loadUpcomingSessions();
        
    } catch (error) {
        console.error('Error loading teacher data:', error);
        alert('Fehler beim Laden der Daten');
    }
    
    // Set up form handlers
    document.getElementById('createClassForm').addEventListener('submit', handleCreateClass);
    document.getElementById('createSessionForm').addEventListener('submit', handleCreateSession);
});

function displayClasses() {
    const container = document.getElementById('classesList');
    
    if (userClasses.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Klassen erstellt</p>';
        return;
    }
    
    container.innerHTML = userClasses.map(cls => `
        <div class="class-card">
            <h3>${cls.name}</h3>
            <p>${cls.description || 'Keine Beschreibung'}</p>
            <div class="class-actions">
                <button class="btn btn-sm" onclick="viewClass(${cls.id})">
                    Details anzeigen
                </button>
                <button class="btn btn-sm btn-primary" onclick="startQuickSession(${cls.id}, '${cls.name}')">
                    Unterricht starten
                </button>
            </div>
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
    const container = document.getElementById('sessionsList');
    
    if (upcomingSessions.length === 0) {
        container.innerHTML = '<p class="empty-state">Keine bevorstehenden Stunden</p>';
        return;
    }
    
    container.innerHTML = upcomingSessions.map(session => {
        const startTime = new Date(session.scheduled_start);
        const endTime = new Date(session.scheduled_end);
        
        return `
            <div class="session-card ${session.status === 'active' ? 'active' : ''}">
                <h3>${session.title}</h3>
                <p class="session-class">${session.class_name || 'Einzelstunde'}</p>
                <p class="session-time">
                    ${startTime.toLocaleDateString('de-DE')} 
                    ${startTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })} - 
                    ${endTime.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                </p>
                <div class="session-actions">
                    ${session.status === 'scheduled' ? `
                        <button class="btn btn-sm btn-primary" onclick="startSession(${session.id})">
                            Jetzt starten
                        </button>
                    ` : ''}
                    ${session.status === 'active' ? `
                        <button class="btn btn-sm btn-danger" onclick="endSession(${session.id})">
                            Beenden
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
    }).join('');
}

function showCreateClassModal() {
    document.getElementById('createClassModal').style.display = 'block';
}

function closeCreateClassModal() {
    document.getElementById('createClassModal').style.display = 'none';
    document.getElementById('createClassForm').reset();
}

function showCreateSessionModal() {
    const select = document.getElementById('sessionClass');
    select.innerHTML = '<option value="">Klasse auswählen...</option>' +
        userClasses.map(cls => `<option value="${cls.id}">${cls.name}</option>`).join('');
    
    // Set default times (next hour)
    const now = new Date();
    now.setHours(now.getHours() + 1, 0, 0, 0);
    const start = now.toISOString().slice(0, 16);
    
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    const endStr = end.toISOString().slice(0, 16);
    
    document.getElementById('sessionStart').value = start;
    document.getElementById('sessionEnd').value = endStr;
    
    document.getElementById('createSessionModal').style.display = 'block';
}

function closeCreateSessionModal() {
    document.getElementById('createSessionModal').style.display = 'none';
    document.getElementById('createSessionForm').reset();
}

async function handleCreateClass(e) {
    e.preventDefault();
    
    const name = document.getElementById('className').value;
    const description = document.getElementById('classDescription').value;
    
    try {
        const response = await fetch('/api/school/classes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, description })
        });
        
        if (!response.ok) throw new Error('Failed to create class');
        
        const newClass = await response.json();
        userClasses.push(newClass);
        displayClasses();
        closeCreateClassModal();
        
        alert('Klasse erfolgreich erstellt!');
        
    } catch (error) {
        console.error('Error creating class:', error);
        alert('Fehler beim Erstellen der Klasse');
    }
}

async function handleCreateSession(e) {
    e.preventDefault();
    
    const classId = document.getElementById('sessionClass').value;
    const title = document.getElementById('sessionTitle').value;
    const description = document.getElementById('sessionDescription').value;
    const scheduledStart = new Date(document.getElementById('sessionStart').value).toISOString();
    const scheduledEnd = new Date(document.getElementById('sessionEnd').value).toISOString();
    
    try {
        const response = await fetch('/api/school/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classId: classId || null,
                title,
                description,
                scheduledStart,
                scheduledEnd,
                sessionType: classId ? 'class' : 'invitation'
            })
        });
        
        if (!response.ok) throw new Error('Failed to create session');
        
        closeCreateSessionModal();
        loadUpcomingSessions();
        
        alert('Unterrichtsstunde erfolgreich geplant!');
        
    } catch (error) {
        console.error('Error creating session:', error);
        alert('Fehler beim Planen der Stunde');
    }
}

async function startSession(sessionId) {
    try {
        const response = await fetch(`/api/school/sessions/${sessionId}/start`, {
            method: 'POST'
        });
        
        if (!response.ok) throw new Error('Failed to start session');
        
        // Initialize WebSocket connection for this session
        if (window.schoolMode) {
            window.schoolMode.startSession(sessionId);
        }
        
        // Navigate to a teaching page
        window.location.href = '/search.html';
        
    } catch (error) {
        console.error('Error starting session:', error);
        alert('Fehler beim Starten der Stunde');
    }
}

async function startQuickSession(classId, className) {
    // Create and immediately start a session
    const now = new Date();
    const end = new Date(now);
    end.setHours(end.getHours() + 1);
    
    try {
        // Create session
        const createResponse = await fetch('/api/school/sessions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                classId,
                title: `${className} - Live-Unterricht`,
                description: 'Spontaner Unterricht',
                scheduledStart: now.toISOString(),
                scheduledEnd: end.toISOString(),
                sessionType: 'class'
            })
        });
        
        if (!createResponse.ok) throw new Error('Failed to create session');
        const session = await createResponse.json();
        
        // Start session
        await startSession(session.id);
        
    } catch (error) {
        console.error('Error starting quick session:', error);
        alert('Fehler beim Starten des Unterrichts');
    }
}

function viewClass(classId) {
    // Navigate to class management page
    window.location.href = `/class-management.html?id=${classId}`;
}

// Modal close on outside click
window.onclick = function(event) {
    if (event.target.className === 'modal') {
        event.target.style.display = 'none';
    }
};