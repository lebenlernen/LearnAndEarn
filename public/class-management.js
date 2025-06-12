// Class Management functionality
let classId = null;
let classData = null;
let classMembers = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Get class ID from URL
    const params = new URLSearchParams(window.location.search);
    classId = params.get('id');
    
    if (!classId) {
        alert('Keine Klassen-ID gefunden');
        window.location.href = '/teacher-dashboard.html';
        return;
    }
    
    // Check authentication
    const authData = await checkAuth();
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Load class data
    await loadClassData();
    
    // Generate and display class code
    displayClassCode();
});

async function loadClassData() {
    try {
        const response = await fetch(`/api/school/classes/${classId}`);
        if (!response.ok) throw new Error('Failed to load class');
        
        const data = await response.json();
        classData = data.class;
        classMembers = data.members;
        
        // Update UI
        document.getElementById('className').textContent = classData.name;
        document.getElementById('userName').textContent = classData.teacher_name;
        
        displayMembers();
        
    } catch (error) {
        console.error('Error loading class:', error);
        alert('Fehler beim Laden der Klasse');
    }
}

function displayClassCode() {
    // Generate a simple code based on class ID (in production, use a proper code system)
    const code = `KLS-${classId.toString().padStart(4, '0')}`;
    document.getElementById('classCode').textContent = code;
}

function copyCode() {
    const code = document.getElementById('classCode').textContent;
    navigator.clipboard.writeText(code).then(() => {
        alert('Code wurde in die Zwischenablage kopiert!');
    });
}

function displayMembers() {
    const container = document.getElementById('membersList');
    
    if (classMembers.length === 0) {
        container.innerHTML = '<p class="empty-state">Noch keine Schüler in dieser Klasse</p>';
        return;
    }
    
    container.innerHTML = classMembers.map(member => `
        <div class="member-item">
            <div class="student-info">
                <strong>${member.username}</strong><br>
                <span style="color: #666; font-size: 0.9em;">${member.email}</span>
            </div>
            <button class="remove-btn" onclick="removeMember(${member.id})">
                Entfernen
            </button>
        </div>
    `).join('');
}

async function searchStudents() {
    const searchTerm = document.getElementById('studentSearch').value.trim();
    if (!searchTerm) return;
    
    try {
        const response = await fetch(`/api/school/search-students?q=${encodeURIComponent(searchTerm)}`);
        if (!response.ok) throw new Error('Search failed');
        
        const students = await response.json();
        displaySearchResults(students);
        
    } catch (error) {
        console.error('Error searching students:', error);
        alert('Fehler bei der Suche');
    }
}

function displaySearchResults(students) {
    const container = document.getElementById('searchResults');
    
    if (students.length === 0) {
        container.innerHTML = '<div class="student-item">Keine Schüler gefunden</div>';
        container.style.display = 'block';
        return;
    }
    
    // Filter out already enrolled students
    const memberIds = classMembers.map(m => m.id);
    const availableStudents = students.filter(s => !memberIds.includes(s.id));
    
    if (availableStudents.length === 0) {
        container.innerHTML = '<div class="student-item">Alle gefundenen Schüler sind bereits in der Klasse</div>';
        container.style.display = 'block';
        return;
    }
    
    container.innerHTML = availableStudents.map(student => `
        <div class="student-item">
            <div class="student-info">
                <strong>${student.username}</strong>
                <span style="color: #666; margin-left: 10px;">${student.email}</span>
            </div>
            <button class="add-student-btn" onclick="addStudent(${student.id})">
                Hinzufügen
            </button>
        </div>
    `).join('');
    
    container.style.display = 'block';
}

async function addStudent(studentId) {
    try {
        const response = await fetch(`/api/school/classes/${classId}/members`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentIds: [studentId] })
        });
        
        if (!response.ok) throw new Error('Failed to add student');
        
        // Reload class data
        await loadClassData();
        
        // Clear search
        document.getElementById('studentSearch').value = '';
        document.getElementById('searchResults').style.display = 'none';
        
        alert('Schüler erfolgreich hinzugefügt!');
        
    } catch (error) {
        console.error('Error adding student:', error);
        alert('Fehler beim Hinzufügen des Schülers');
    }
}

async function removeMember(studentId) {
    if (!confirm('Möchten Sie diesen Schüler wirklich aus der Klasse entfernen?')) {
        return;
    }
    
    try {
        const response = await fetch(`/api/school/classes/${classId}/members/${studentId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) throw new Error('Failed to remove student');
        
        // Reload class data
        await loadClassData();
        
        alert('Schüler wurde entfernt');
        
    } catch (error) {
        console.error('Error removing student:', error);
        alert('Fehler beim Entfernen des Schülers');
    }
}

// Handle Enter key in search
document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && e.target.id === 'studentSearch') {
        searchStudents();
    }
});