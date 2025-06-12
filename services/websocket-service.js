const WebSocket = require('ws');

class WebSocketService {
    constructor() {
        this.wss = null;
        this.sessions = new Map(); // sessionId -> Set of ws connections
        this.userConnections = new Map(); // userId -> ws connection
        this.teacherSessions = new Map(); // teacherId -> active sessionId
    }

    initialize(server) {
        this.wss = new WebSocket.Server({ server });

        this.wss.on('connection', (ws, req) => {
            console.log('New WebSocket connection');

            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMessage(ws, data);
                } catch (error) {
                    console.error('WebSocket message error:', error);
                }
            });

            ws.on('close', () => {
                this.handleDisconnect(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
            });
        });
    }

    handleMessage(ws, data) {
        const { type, payload } = data;

        switch (type) {
            case 'auth':
                this.handleAuth(ws, payload);
                break;
            case 'joinSession':
                this.handleJoinSession(ws, payload);
                break;
            case 'leaveSession':
                this.handleLeaveSession(ws, payload);
                break;
            case 'teacherNavigation':
                this.handleTeacherNavigation(ws, payload);
                break;
            case 'startSession':
                this.handleStartSession(ws, payload);
                break;
            case 'endSession':
                this.handleEndSession(ws, payload);
                break;
            default:
                console.log('Unknown message type:', type);
        }
    }

    handleAuth(ws, payload) {
        const { userId, role } = payload;
        ws.userId = userId;
        ws.role = role;
        this.userConnections.set(userId, ws);
        
        ws.send(JSON.stringify({
            type: 'authSuccess',
            payload: { userId, role }
        }));
    }

    handleJoinSession(ws, payload) {
        const { sessionId, userId } = payload;
        
        if (!this.sessions.has(sessionId)) {
            this.sessions.set(sessionId, new Set());
        }
        
        this.sessions.get(sessionId).add(ws);
        ws.sessionId = sessionId;
        
        // Send current teacher position if available
        const currentPosition = this.getTeacherPosition(sessionId);
        if (currentPosition) {
            ws.send(JSON.stringify({
                type: 'navigateTo',
                payload: currentPosition
            }));
        }
        
        // Notify others in session
        this.broadcastToSession(sessionId, {
            type: 'userJoined',
            payload: { userId }
        }, ws);
    }

    handleLeaveSession(ws, payload) {
        const { sessionId, userId } = payload;
        
        if (this.sessions.has(sessionId)) {
            this.sessions.get(sessionId).delete(ws);
            
            if (this.sessions.get(sessionId).size === 0) {
                this.sessions.delete(sessionId);
            }
        }
        
        ws.sessionId = null;
        
        // Notify others in session
        this.broadcastToSession(sessionId, {
            type: 'userLeft',
            payload: { userId }
        }, ws);
    }

    handleTeacherNavigation(ws, payload) {
        const { sessionId, pageType, pageUrl, pageData } = payload;
        
        // Only teachers can send navigation updates
        if (ws.role !== 'teacher') {
            return;
        }
        
        // Store current position for late joiners
        this.setTeacherPosition(sessionId, { pageType, pageUrl, pageData });
        
        // Broadcast to all students in session
        this.broadcastToSession(sessionId, {
            type: 'navigateTo',
            payload: { pageType, pageUrl, pageData }
        }, ws);
    }

    handleStartSession(ws, payload) {
        const { sessionId, teacherId } = payload;
        
        if (ws.role !== 'teacher') {
            return;
        }
        
        this.teacherSessions.set(teacherId, sessionId);
        
        // Notify all participants
        this.broadcastToSession(sessionId, {
            type: 'sessionStarted',
            payload: { sessionId, teacherId }
        });
    }

    handleEndSession(ws, payload) {
        const { sessionId, teacherId } = payload;
        
        if (ws.role !== 'teacher') {
            return;
        }
        
        this.teacherSessions.delete(teacherId);
        
        // Notify all participants
        this.broadcastToSession(sessionId, {
            type: 'sessionEnded',
            payload: { sessionId }
        });
        
        // Clean up session
        this.sessions.delete(sessionId);
    }

    handleDisconnect(ws) {
        if (ws.userId) {
            this.userConnections.delete(ws.userId);
        }
        
        if (ws.sessionId && this.sessions.has(ws.sessionId)) {
            this.sessions.get(ws.sessionId).delete(ws);
            
            // Notify others in session
            this.broadcastToSession(ws.sessionId, {
                type: 'userDisconnected',
                payload: { userId: ws.userId }
            }, ws);
        }
    }

    broadcastToSession(sessionId, message, excludeWs = null) {
        if (!this.sessions.has(sessionId)) {
            return;
        }
        
        const messageStr = JSON.stringify(message);
        
        this.sessions.get(sessionId).forEach(ws => {
            if (ws !== excludeWs && ws.readyState === WebSocket.OPEN) {
                ws.send(messageStr);
            }
        });
    }

    // Helper methods for tracking teacher position
    teacherPositions = new Map(); // sessionId -> current position
    
    setTeacherPosition(sessionId, position) {
        this.teacherPositions.set(sessionId, position);
    }
    
    getTeacherPosition(sessionId) {
        return this.teacherPositions.get(sessionId);
    }
}

module.exports = new WebSocketService();