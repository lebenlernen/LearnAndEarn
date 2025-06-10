// Activity Monitor for LearnAndEarn
// Tracks user activity, idle time, and learning activities

class ActivityMonitor {
    constructor() {
        this.startTime = Date.now();
        this.lastActivity = Date.now();
        this.currentPage = window.location.pathname;
        this.currentSessionId = null;
        this.isIdle = false;
        this.idleTimeout = 2 * 60 * 1000; // 2 minutes
        this.heartbeatInterval = 30000; // 30 seconds
        this.idleCheckInterval = 10000; // 10 seconds
        this.activityQueue = [];
        this.isTabActive = true;
        
        // Activity types
        this.ActivityTypes = {
            // Learning Activities
            VOCABULARY_PRACTICE: 'vocabulary_practice',
            SENTENCE_PRACTICE: 'sentence_practice', 
            WORD_SELECTION: 'word_selection',
            CLOZE_TEST: 'cloze_test',
            VIDEO_WATCH: 'video_watch',
            DICTATION: 'dictation',
            
            // Passive Activities
            PAGE_VIEW: 'page_view',
            SUMMARY_READ: 'summary_read',
            BROWSE_VIDEOS: 'browse_videos',
            VIEW_PROGRESS: 'view_progress',
            
            // System Events
            SESSION_START: 'session_start',
            SESSION_END: 'session_end',
            IDLE_START: 'idle_start',
            IDLE_END: 'idle_end',
            TAB_FOCUS: 'tab_focus',
            TAB_BLUR: 'tab_blur'
        };
        
        this.initializeSession();
        this.initializeEventListeners();
        this.startHeartbeat();
        this.startIdleChecker();
    }
    
    async initializeSession() {
        try {
            const response = await fetch('/api/activity/session/start', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    page: this.currentPage,
                    timestamp: new Date().toISOString()
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                this.currentSessionId = data.sessionId;
                console.log('Activity session started:', this.currentSessionId);
            }
        } catch (error) {
            console.error('Failed to start activity session:', error);
        }
    }
    
    initializeEventListeners() {
        // User activity events
        const activityEvents = [
            'mousedown', 'mousemove', 'keypress', 'keydown',
            'scroll', 'touchstart', 'click', 'wheel'
        ];
        
        activityEvents.forEach(event => {
            document.addEventListener(event, () => this.handleUserActivity(), { passive: true });
        });
        
        // Page visibility change
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                this.handleTabBlur();
            } else {
                this.handleTabFocus();
            }
        });
        
        // Window focus/blur
        window.addEventListener('focus', () => this.handleTabFocus());
        window.addEventListener('blur', () => this.handleTabBlur());
        
        // Before unload - save any pending activities
        window.addEventListener('beforeunload', () => {
            this.flushActivityQueue();
            this.endSession();
        });
        
        // Track page navigation
        window.addEventListener('popstate', () => this.handlePageChange());
    }
    
    handleUserActivity() {
        const now = Date.now();
        
        // If was idle, record idle end
        if (this.isIdle) {
            this.recordActivity(this.ActivityTypes.IDLE_END, {
                idleDuration: now - this.lastActivity
            });
            this.isIdle = false;
        }
        
        this.lastActivity = now;
    }
    
    handleTabBlur() {
        this.isTabActive = false;
        this.recordActivity(this.ActivityTypes.TAB_BLUR);
    }
    
    handleTabFocus() {
        this.isTabActive = true;
        this.recordActivity(this.ActivityTypes.TAB_FOCUS);
        this.handleUserActivity(); // Reset idle timer
    }
    
    handlePageChange() {
        const newPage = window.location.pathname;
        if (newPage !== this.currentPage) {
            this.recordActivity(this.ActivityTypes.PAGE_VIEW, {
                fromPage: this.currentPage,
                toPage: newPage
            });
            this.currentPage = newPage;
        }
    }
    
    startHeartbeat() {
        setInterval(() => {
            if (this.isTabActive && !this.isIdle) {
                this.sendHeartbeat();
            }
            
            // Flush activity queue periodically
            if (this.activityQueue.length > 0) {
                this.flushActivityQueue();
            }
        }, this.heartbeatInterval);
    }
    
    startIdleChecker() {
        setInterval(() => {
            this.checkIdleStatus();
        }, this.idleCheckInterval);
    }
    
    checkIdleStatus() {
        const now = Date.now();
        const idleTime = now - this.lastActivity;
        
        if (idleTime > this.idleTimeout && !this.isIdle && this.isTabActive) {
            this.isIdle = true;
            this.recordActivity(this.ActivityTypes.IDLE_START, {
                lastActivityTime: this.lastActivity
            });
        }
    }
    
    async sendHeartbeat() {
        try {
            await fetch('/api/activity/heartbeat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    timestamp: new Date().toISOString(),
                    isActive: !this.isIdle,
                    currentPage: this.currentPage
                })
            });
        } catch (error) {
            console.error('Heartbeat failed:', error);
        }
    }
    
    recordActivity(type, detail = {}) {
        const activity = {
            sessionId: this.currentSessionId,
            activity_type: type,
            activity_detail: {
                ...detail,
                page: this.currentPage,
                isTabActive: this.isTabActive,
                userAgent: navigator.userAgent
            },
            timestamp: new Date().toISOString()
        };
        
        this.activityQueue.push(activity);
        
        // Flush queue if it gets too large
        if (this.activityQueue.length >= 10) {
            this.flushActivityQueue();
        }
    }
    
    async flushActivityQueue() {
        if (this.activityQueue.length === 0) return;
        
        const activities = [...this.activityQueue];
        this.activityQueue = [];
        
        try {
            await fetch('/api/activity/log', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ activities })
            });
        } catch (error) {
            console.error('Failed to flush activity queue:', error);
            // Re-add activities to queue on failure
            this.activityQueue = activities.concat(this.activityQueue);
        }
    }
    
    async endSession() {
        try {
            await fetch('/api/activity/session/end', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId: this.currentSessionId,
                    timestamp: new Date().toISOString()
                })
            });
        } catch (error) {
            console.error('Failed to end session:', error);
        }
    }
    
    // Public methods for tracking specific learning activities
    trackVocabularyPractice(word, mode, duration) {
        this.recordActivity(this.ActivityTypes.VOCABULARY_PRACTICE, {
            word,
            mode,
            duration
        });
    }
    
    trackSentencePractice(sentence, word, attempts, duration) {
        this.recordActivity(this.ActivityTypes.SENTENCE_PRACTICE, {
            sentence,
            targetWord: word,
            attempts,
            duration
        });
    }
    
    trackWordSelection(word, attempts, duration) {
        this.recordActivity(this.ActivityTypes.WORD_SELECTION, {
            word,
            attempts,
            duration
        });
    }
    
    trackVideoWatch(videoId, videoTitle, watchDuration) {
        this.recordActivity(this.ActivityTypes.VIDEO_WATCH, {
            videoId,
            videoTitle,
            watchDuration
        });
    }
    
    trackClozeTest(testId, score, duration) {
        this.recordActivity(this.ActivityTypes.CLOZE_TEST, {
            testId,
            score,
            duration
        });
    }
    
    trackSummaryRead(videoId, scrollDepth, duration) {
        this.recordActivity(this.ActivityTypes.SUMMARY_READ, {
            videoId,
            scrollDepth,
            duration
        });
    }
}

// Initialize activity monitor when DOM is ready
let activityMonitor;

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        activityMonitor = new ActivityMonitor();
        window.activityMonitor = activityMonitor; // Make it globally accessible
    });
} else {
    activityMonitor = new ActivityMonitor();
    window.activityMonitor = activityMonitor;
}