// Learning Time Analytics Dashboard

let currentPeriod = 'today';
let userRole = 'student';

// Initialize dashboard
document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const user = await checkAuth();
    if (!user) {
        window.location.href = '/login.html';
        return;
    }
    
    userRole = user.role;
    
    // Show appropriate view based on role
    if (userRole === 'student') {
        document.getElementById('studentView').style.display = 'block';
        initializeStudentView();
    } else if (userRole === 'teacher') {
        document.getElementById('teacherView').style.display = 'block';
        initializeTeacherView();
    } else if (userRole === 'admin') {
        document.getElementById('adminView').style.display = 'block';
        initializeAdminView();
    }
    
    // Setup period filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentPeriod = e.target.dataset.period;
            updateDashboard();
        });
    });
});

// Format time duration
function formatDuration(seconds) {
    if (!seconds || seconds === 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}:${minutes.toString().padStart(2, '0')}h`;
    } else {
        return `${minutes}m`;
    }
}

// Student View Functions
async function initializeStudentView() {
    await loadStudentData();
    setInterval(loadStudentData, 60000); // Refresh every minute
}

async function loadStudentData() {
    try {
        const response = await fetch(`/api/activity/summary?period=${currentPeriod}`);
        const data = await response.json();
        
        if (data.success) {
            updateStudentMetrics(data.summary, data.periodData);
            updateActivityBreakdown(data.summary);
            // Load daily trend if available
            loadDailyTrend();
        }
    } catch (error) {
        console.error('Error loading student data:', error);
    }
}

function updateStudentMetrics(summary, periodData) {
    // Update time cards
    document.getElementById('totalLearningTime').textContent = 
        formatDuration(periodData.learning_time || summary.total_learning_time_seconds);
    
    document.getElementById('totalPlatformTime').textContent = 
        formatDuration(periodData.total_time || summary.total_platform_time_seconds);
    
    // Calculate average session time
    const avgSession = periodData.total_sessions > 0 
        ? (periodData.total_time / periodData.total_sessions) 
        : 0;
    document.getElementById('avgSessionTime').textContent = formatDuration(avgSession);
    
    document.getElementById('activeDays').textContent = periodData.active_days || '0';
}

function updateActivityBreakdown(summary) {
    const activities = [
        { name: 'Vocabulary Practice', time: summary.vocabulary_practice_time || 0, color: '#667eea' },
        { name: 'Sentence Practice', time: summary.sentence_practice_time || 0, color: '#764ba2' },
        { name: 'Word Selection', time: summary.word_selection_time || 0, color: '#f093fb' },
        { name: 'Cloze Tests', time: summary.cloze_test_time || 0, color: '#4facfe' },
        { name: 'Video Watching', time: summary.video_watching_time || 0, color: '#00f2fe' },
        { name: 'Reading', time: summary.summary_reading_time || 0, color: '#43e97b' }
    ];
    
    const totalTime = activities.reduce((sum, act) => sum + act.time, 0);
    const activityChart = document.getElementById('activityChart');
    
    activityChart.innerHTML = activities.map(activity => {
        const percentage = totalTime > 0 ? (activity.time / totalTime * 100).toFixed(1) : 0;
        const width = totalTime > 0 ? (activity.time / totalTime * 100) : 0;
        
        return `
            <div class="activity-bar">
                <div class="activity-name">${activity.name}</div>
                <div class="activity-progress">
                    <div class="activity-fill" style="width: ${width}%; background: ${activity.color};">
                        ${activity.time > 0 ? `<span class="activity-time">${formatDuration(activity.time)}</span>` : ''}
                    </div>
                </div>
                <div class="activity-percent">${percentage}%</div>
            </div>
        `;
    }).join('');
}

async function loadDailyTrend() {
    try {
        const days = currentPeriod === 'today' ? 7 : currentPeriod === 'week' ? 7 : 30;
        const response = await fetch(`/api/activity/history?limit=1000`);
        const data = await response.json();
        
        if (data.success && data.activities.length > 0) {
            // Group by day and calculate totals
            const dailyData = {};
            const today = new Date();
            
            for (let i = 0; i < days; i++) {
                const date = new Date(today);
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                dailyData[dateStr] = 0;
            }
            
            data.activities.forEach(activity => {
                const date = activity.timestamp.split('T')[0];
                if (dailyData.hasOwnProperty(date)) {
                    dailyData[date] += activity.duration_seconds || 0;
                }
            });
            
            // Render simple text chart
            renderDailyChart(dailyData);
        }
    } catch (error) {
        console.error('Error loading daily trend:', error);
    }
}

function renderDailyChart(dailyData) {
    const chartContainer = document.getElementById('dailyChart');
    const dates = Object.keys(dailyData).sort();
    const maxTime = Math.max(...Object.values(dailyData));
    
    const chartHTML = `
        <div style="display: flex; height: 250px; align-items: flex-end; justify-content: space-around;">
            ${dates.map(date => {
                const height = maxTime > 0 ? (dailyData[date] / maxTime * 200) : 0;
                const dayName = new Date(date).toLocaleDateString('de-DE', { weekday: 'short' });
                
                return `
                    <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                        <div style="background: linear-gradient(to top, #667eea, #764ba2); 
                                    width: 40px; 
                                    height: ${height}px; 
                                    border-radius: 4px 4px 0 0;
                                    position: relative;">
                            ${dailyData[date] > 0 ? `
                                <span style="position: absolute; 
                                           top: -20px; 
                                           left: 50%; 
                                           transform: translateX(-50%); 
                                           font-size: 0.8em; 
                                           color: #666;">
                                    ${formatDuration(dailyData[date])}
                                </span>
                            ` : ''}
                        </div>
                        <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                            ${dayName}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
    `;
    
    chartContainer.innerHTML = chartHTML;
}

// Teacher View Functions
async function initializeTeacherView() {
    await loadTeacherData();
    setInterval(loadTeacherData, 60000); // Refresh every minute
}

async function loadTeacherData() {
    try {
        const response = await fetch('/api/activity/students');
        const data = await response.json();
        
        if (data.success) {
            updateTeacherMetrics(data.students);
            renderStudentList(data.students);
        }
    } catch (error) {
        console.error('Error loading teacher data:', error);
    }
}

function updateTeacherMetrics(students) {
    const activeToday = students.filter(s => s.activity_status === 'Active' || s.activity_status === 'Today').length;
    const totalTime = students.reduce((sum, s) => sum + (s.total_learning_time_seconds || 0), 0);
    const avgTime = students.length > 0 ? totalTime / students.length : 0;
    
    document.getElementById('activeStudentsToday').textContent = activeToday;
    document.getElementById('totalClassTime').textContent = formatDuration(totalTime);
    document.getElementById('avgStudentTime').textContent = formatDuration(avgTime);
}

function renderStudentList(students) {
    const studentList = document.getElementById('studentList');
    
    studentList.innerHTML = students.map(student => {
        const statusClass = student.activity_status === 'Active' ? 'active' : 
                          student.activity_status === 'Today' ? 'today' : 'inactive';
        
        return `
            <div class="student-item">
                <div class="student-name">
                    <span class="activity-indicator ${statusClass}"></span>
                    ${student.username}
                </div>
                <div class="student-stats">
                    <span>Learning: ${formatDuration(student.total_learning_time_seconds)}</span>
                    <span>Platform: ${formatDuration(student.total_platform_time_seconds)}</span>
                    <span>Last active: ${new Date(student.last_active).toLocaleDateString()}</span>
                </div>
            </div>
        `;
    }).join('');
}

// Admin View Functions
async function initializeAdminView() {
    await loadAdminData();
    setInterval(loadAdminData, 60000); // Refresh every minute
}

async function loadAdminData() {
    try {
        const response = await fetch('/api/activity/analytics');
        const data = await response.json();
        
        if (data.success) {
            updateAdminMetrics(data.analytics);
            renderPlatformChart(data.dailyTrend);
        }
    } catch (error) {
        console.error('Error loading admin data:', error);
    }
}

function updateAdminMetrics(analytics) {
    document.getElementById('dailyActiveUsers').textContent = analytics.daily_active_users || 0;
    document.getElementById('weeklyActiveUsers').textContent = analytics.weekly_active_users || 0;
    document.getElementById('platformTotalTime').textContent = formatDuration(analytics.total_platform_time);
    document.getElementById('avgLearningTime').textContent = formatDuration(analytics.avg_learning_time_per_user);
}

function renderPlatformChart(dailyTrend) {
    const chartContainer = document.getElementById('platformChart');
    
    if (!dailyTrend || dailyTrend.length === 0) {
        chartContainer.innerHTML = '<p style="text-align: center; color: #999;">No data available</p>';
        return;
    }
    
    // Similar to student daily chart but with platform-wide data
    const maxUsers = Math.max(...dailyTrend.map(d => d.active_users));
    
    const chartHTML = `
        <div style="display: flex; height: 250px; align-items: flex-end; justify-content: space-around;">
            ${dailyTrend.slice(-7).map(day => {
                const height = maxUsers > 0 ? (day.active_users / maxUsers * 200) : 0;
                const date = new Date(day.activity_date);
                const dayName = date.toLocaleDateString('de-DE', { weekday: 'short' });
                
                return `
                    <div style="display: flex; flex-direction: column; align-items: center; flex: 1;">
                        <div style="background: linear-gradient(to top, #28a745, #20c997); 
                                    width: 40px; 
                                    height: ${height}px; 
                                    border-radius: 4px 4px 0 0;
                                    position: relative;">
                            <span style="position: absolute; 
                                       top: -20px; 
                                       left: 50%; 
                                       transform: translateX(-50%); 
                                       font-size: 0.8em; 
                                       color: #666;">
                                ${day.active_users}
                            </span>
                        </div>
                        <div style="margin-top: 10px; font-size: 0.9em; color: #666;">
                            ${dayName}
                        </div>
                    </div>
                `;
            }).join('')}
        </div>
        <p style="text-align: center; margin-top: 20px; color: #666; font-size: 0.9em;">
            Active Users per Day
        </p>
    `;
    
    chartContainer.innerHTML = chartHTML;
}

// Update dashboard based on current period
async function updateDashboard() {
    if (userRole === 'student') {
        await loadStudentData();
    } else if (userRole === 'teacher') {
        await loadTeacherData();
    } else if (userRole === 'admin') {
        await loadAdminData();
    }
}