document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authData = await checkAuth();
    const userHeader = document.getElementById('userHeader');
    const authRequired = document.getElementById('authRequired');
    const progressContent = document.getElementById('progressContent');
    
    if (!authData.authenticated) {
        authRequired.style.display = 'block';
        progressContent.style.display = 'none';
        return;
    }
    
    // Show user header
    userHeader.style.display = 'flex';
    document.getElementById('userName').textContent = authData.user.username;
    document.getElementById('userRole').textContent = authData.user.role;
    
    if (authData.user.role === 'admin') {
        document.getElementById('userRole').classList.add('admin');
                        document.getElementById('adminLink').style.display = 'inline-block';
    }
    
    // Show progress content
    progressContent.style.display = 'block';
    
    // Load user profile data
    loadUserProfile();
    
    // Load statistics
    loadUserStatistics();
});

// Load user profile data
const loadUserProfile = async () => {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        
        // Update profile display - data is nested under 'user' property
        if (data.user) {
            document.getElementById('userCountry').textContent = data.user.country || '-';
            document.getElementById('userMotherLanguage').textContent = data.user.mother_language || '-';
            document.getElementById('userTimezone').textContent = data.user.timezone || '-';
        }
        
    } catch (error) {
        console.error('Error loading profile:', error);
        // Keep default values if profile loading fails
    }
};

// Format time from seconds to readable format
const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}h ${minutes}m`;
    } else {
        return `${minutes}m`;
    }
};

// Load user statistics
const loadUserStatistics = async () => {
    try {
        const response = await fetch('/api/progress/stats', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load statistics');
        }
        
        const data = await response.json();
        displayStatistics(data);
    } catch (error) {
        console.error('Error loading statistics:', error);
        document.getElementById('progressContent').innerHTML = 
            '<p class="error">Failed to load progress data. Please try again later.</p>';
    }
};

// Display statistics
const displayStatistics = (data) => {
    const { totalStats, topVideos, recentActivity, problemSentences } = data;
    
    // Overall statistics
    document.getElementById('videosPracticed').textContent = totalStats.videos_practiced || 0;
    document.getElementById('totalTime').textContent = formatTime(totalStats.total_time_seconds || 0);
    document.getElementById('totalSessions').textContent = totalStats.total_practices || 0;
    document.getElementById('avgAccuracy').textContent = 
        totalStats.overall_accuracy ? `${Math.round(totalStats.overall_accuracy)}%` : '0%';
    
    // Recent activity chart
    displayRecentActivity(recentActivity);
    
    // Top videos
    displayTopVideos(topVideos);
    
    // Problem sentences
    displayProblemSentences(problemSentences);
};

// Display recent activity as a simple bar chart
const displayRecentActivity = (activities) => {
    const chartContainer = document.getElementById('recentActivityChart');
    
    if (!activities || activities.length === 0) {
        chartContainer.innerHTML = '<p class="no-data">No recent activity</p>';
        return;
    }
    
    // Create simple bar chart
    let maxSessions = Math.max(...activities.map(a => a.sessions));
    maxSessions = maxSessions || 1; // Avoid division by zero
    
    chartContainer.innerHTML = activities.map(activity => {
        const date = new Date(activity.practice_date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
        const barHeight = (activity.sessions / maxSessions) * 100;
        
        return `
            <div class="activity-bar-container">
                <div class="activity-bar" style="height: ${barHeight}%">
                    <span class="activity-count">${activity.sessions}</span>
                </div>
                <div class="activity-label">${dayName}</div>
                <div class="activity-accuracy">${Math.round(activity.avg_accuracy)}%</div>
            </div>
        `;
    }).join('');
};

// Display top videos
const displayTopVideos = (videos) => {
    const container = document.getElementById('topVideosList');
    
    if (!videos || videos.length === 0) {
        container.innerHTML = '<p class="no-data">No videos practiced yet</p>';
        return;
    }
    
    container.innerHTML = videos.map(video => {
        const title = decodeURIComponent(video.title || '').replace(/\+/g, ' ');
        return `
            <div class="video-progress-card">
                <div class="video-info">
                    <h4>${title}</h4>
                    <p class="video-category">${video.category || 'Uncategorized'}</p>
                </div>
                <div class="video-stats">
                    <div class="stat-item">
                        <span class="stat-label">Sessions:</span>
                        <span class="stat-value">${video.total_practices}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Time:</span>
                        <span class="stat-value">${formatTime(video.total_time_seconds)}</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Best:</span>
                        <span class="stat-value">${Math.round(video.best_accuracy)}%</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-label">Avg:</span>
                        <span class="stat-value">${Math.round(video.average_accuracy)}%</span>
                    </div>
                </div>
                <a href="/detail.html?id=${video.video_id}" class="view-video-link">View Video →</a>
            </div>
        `;
    }).join('');
};

// Display problem sentences
const displayProblemSentences = (sentences) => {
    const container = document.getElementById('problemSentencesList');
    
    if (!sentences || sentences.length === 0) {
        container.innerHTML = '<p class="no-data">Great! No problem sentences found.</p>';
        return;
    }
    
    container.innerHTML = sentences.map(sentence => {
        const videoTitle = decodeURIComponent(sentence.video_title || '').replace(/\+/g, ' ');
        return `
            <div class="problem-sentence-card">
                <p class="sentence-text">"${sentence.sentence_text}"</p>
                <div class="sentence-info">
                    <span class="video-title">From: ${videoTitle}</span>
                    <span class="practice-count">Practiced ${sentence.practice_count} times</span>
                    <span class="accuracy-score ${getAccuracyClass(sentence.average_accuracy)}">
                        Avg: ${Math.round(sentence.average_accuracy)}%
                    </span>
                </div>
            </div>
        `;
    }).join('');
};

// Get CSS class based on accuracy
const getAccuracyClass = (accuracy) => {
    if (accuracy >= 80) return 'accuracy-good';
    if (accuracy >= 60) return 'accuracy-medium';
    return 'accuracy-poor';
}; 