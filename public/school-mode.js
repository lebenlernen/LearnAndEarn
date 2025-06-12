class SchoolModeClient {
    constructor() {
        this.ws = null;
        this.isConnected = false;
        this.currentSession = null;
        this.isTeacher = false;
        this.userId = null;
        this.sessionBar = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
    }

    async initialize() {
        // Get user info from auth
        const authData = await checkAuth();
        if (!authData.authenticated) {
            console.log('User not authenticated');
            return;
        }

        this.userId = authData.user.id;
        this.isTeacher = authData.user.is_teacher || false;
        
        this.createSessionBar();
        this.connect();
    }

    connect() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}`;
        
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('WebSocket connected');
            this.isConnected = true;
            this.reconnectAttempts = 0;
            
            // Authenticate
            this.send('auth', {
                userId: this.userId,
                role: this.isTeacher ? 'teacher' : 'student'
            });
        };

        this.ws.onmessage = (event) => {
            try {
                const data = JSON.parse(event.data);
                this.handleMessage(data);
            } catch (error) {
                console.error('Error parsing WebSocket message:', error);
            }
        };

        this.ws.onclose = () => {
            console.log('WebSocket disconnected');
            this.isConnected = false;
            this.handleReconnect();
        };

        this.ws.onerror = (error) => {
            console.error('WebSocket error:', error);
        };
    }

    handleReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`Reconnecting... Attempt ${this.reconnectAttempts}`);
            setTimeout(() => this.connect(), 3000);
        }
    }

    send(type, payload) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type, payload }));
        }
    }

    handleMessage(data) {
        const { type, payload } = data;

        switch (type) {
            case 'authSuccess':
                console.log('Authentication successful');
                break;
            case 'navigateTo':
                if (!this.isTeacher) {
                    this.navigateToPage(payload);
                }
                break;
            case 'sessionStarted':
                this.updateSessionBar('active');
                break;
            case 'sessionEnded':
                this.handleSessionEnd();
                break;
            case 'userJoined':
                this.showNotification(`User joined the session`);
                break;
            case 'userLeft':
                this.showNotification(`User left the session`);
                break;
        }
    }

    joinSession(sessionId) {
        this.currentSession = sessionId;
        this.send('joinSession', { sessionId, userId: this.userId });
        this.updateSessionBar('joined');
        this.showSessionBar();
    }

    leaveSession() {
        if (this.currentSession) {
            this.send('leaveSession', { 
                sessionId: this.currentSession, 
                userId: this.userId 
            });
            this.currentSession = null;
            this.hideSessionBar();
        }
    }

    startSession(sessionId) {
        if (this.isTeacher) {
            this.currentSession = sessionId;
            this.send('startSession', { 
                sessionId, 
                teacherId: this.userId 
            });
            this.updateSessionBar('teaching');
            this.showSessionBar();
            this.startNavigationTracking();
        }
    }

    endSession() {
        if (this.isTeacher && this.currentSession) {
            this.send('endSession', { 
                sessionId: this.currentSession, 
                teacherId: this.userId 
            });
            this.stopNavigationTracking();
            this.handleSessionEnd();
        }
    }

    handleSessionEnd() {
        this.currentSession = null;
        this.hideSessionBar();
        if (!this.isTeacher) {
            this.showNotification('Die Unterrichtsstunde wurde beendet');
        }
    }

    startNavigationTracking() {
        // Track navigation to educational pages
        this.originalPushState = history.pushState;
        history.pushState = (...args) => {
            this.originalPushState.apply(history, args);
            this.trackNavigation();
        };

        window.addEventListener('popstate', this.trackNavigation.bind(this));
        
        // Track initial page
        this.trackNavigation();
    }

    stopNavigationTracking() {
        if (this.originalPushState) {
            history.pushState = this.originalPushState;
        }
        window.removeEventListener('popstate', this.trackNavigation.bind(this));
    }

    trackNavigation() {
        const currentPath = window.location.pathname;
        const pageData = this.getPageData(currentPath);
        
        if (pageData && this.currentSession && this.isTeacher) {
            this.send('teacherNavigation', {
                sessionId: this.currentSession,
                pageType: pageData.type,
                pageUrl: window.location.href,
                pageData: pageData.data
            });

            // Also save to database
            this.saveNavigationToDb(pageData);
        }
    }

    getPageData(path) {
        // Only track educational pages
        if (path.startsWith('/detail.html')) {
            const params = new URLSearchParams(window.location.search);
            const videoId = params.get('id');
            return {
                type: 'video',
                data: { videoId }
            };
        } else if (path.startsWith('/vocabulary.html')) {
            const params = new URLSearchParams(window.location.search);
            const videoId = params.get('videoId');
            return {
                type: 'vocabulary',
                data: { videoId }
            };
        } else if (path.includes('questions')) {
            return {
                type: 'questions',
                data: { url: window.location.href }
            };
        } else if (path.includes('cloze') || path.includes('luecken')) {
            return {
                type: 'cloze',
                data: { url: window.location.href }
            };
        }
        
        return null;
    }

    async saveNavigationToDb(pageData) {
        try {
            await fetch('/api/school/track-navigation', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    sessionId: this.currentSession,
                    pageType: pageData.type,
                    pageUrl: window.location.href,
                    pageData: pageData.data
                })
            });
        } catch (error) {
            console.error('Error saving navigation:', error);
        }
    }

    navigateToPage(payload) {
        const { pageUrl, pageType, pageData } = payload;
        
        // Show notification
        this.showNotification(`Der Lehrer navigiert zu: ${this.getPageTypeLabel(pageType)}`);
        
        // Navigate to the page
        window.location.href = pageUrl;
    }

    getPageTypeLabel(pageType) {
        const labels = {
            'video': 'Video',
            'vocabulary': 'Vokabeln',
            'questions': 'Fragen',
            'cloze': 'Lückentexte'
        };
        return labels[pageType] || pageType;
    }

    createSessionBar() {
        this.sessionBar = document.createElement('div');
        this.sessionBar.id = 'schoolModeBar';
        this.sessionBar.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #2c3e50;
            color: white;
            padding: 10px 20px;
            display: none;
            z-index: 10000;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
        `;
        
        this.sessionBar.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; max-width: 1200px; margin: 0 auto;">
                <div>
                    <span id="sessionStatus">Unterrichtsmodus</span>
                    <span id="sessionInfo" style="margin-left: 20px; font-size: 0.9em;"></span>
                </div>
                <button id="leaveSessionBtn" style="background: #e74c3c; color: white; border: none; padding: 5px 15px; border-radius: 4px; cursor: pointer;">
                    Unterricht verlassen
                </button>
            </div>
        `;
        
        document.body.appendChild(this.sessionBar);
        
        // Add click handler
        document.getElementById('leaveSessionBtn').addEventListener('click', () => {
            if (this.isTeacher) {
                if (confirm('Möchten Sie die Unterrichtsstunde wirklich beenden?')) {
                    this.endSession();
                }
            } else {
                this.leaveSession();
            }
        });
    }

    showSessionBar() {
        if (this.sessionBar) {
            this.sessionBar.style.display = 'block';
            // Adjust page content
            document.body.style.paddingTop = '50px';
        }
    }

    hideSessionBar() {
        if (this.sessionBar) {
            this.sessionBar.style.display = 'none';
            document.body.style.paddingTop = '0';
        }
    }

    updateSessionBar(status) {
        const statusElement = document.getElementById('sessionStatus');
        const infoElement = document.getElementById('sessionInfo');
        const leaveBtn = document.getElementById('leaveSessionBtn');
        
        switch (status) {
            case 'teaching':
                statusElement.textContent = '🔴 Live-Unterricht';
                infoElement.textContent = 'Ihre Navigation wird an Schüler übertragen';
                leaveBtn.textContent = 'Unterricht beenden';
                break;
            case 'joined':
                statusElement.textContent = '📚 Im Unterricht';
                infoElement.textContent = 'Sie folgen dem Lehrer';
                leaveBtn.textContent = 'Unterricht verlassen';
                break;
            case 'active':
                infoElement.textContent = 'Unterricht läuft';
                break;
        }
    }

    showNotification(message) {
        const notification = document.createElement('div');
        notification.style.cssText = `
            position: fixed;
            top: 70px;
            right: 20px;
            background: #3498db;
            color: white;
            padding: 15px 20px;
            border-radius: 4px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 10001;
            animation: slideIn 0.3s ease-out;
        `;
        notification.textContent = message;
        
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.style.animation = 'slideOut 0.3s ease-in';
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }
}

// Add CSS animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);

// Initialize school mode when DOM is loaded
let schoolMode = null;
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize on educational pages
    const path = window.location.pathname;
    if (path.includes('detail.html') || path.includes('vocabulary') || 
        path.includes('questions') || path.includes('cloze') || 
        path.includes('luecken')) {
        schoolMode = new SchoolModeClient();
        schoolMode.initialize();
    }
});

// Export for use in other scripts
window.schoolMode = schoolMode;