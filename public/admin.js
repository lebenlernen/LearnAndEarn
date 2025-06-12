let currentEditUserId = null;
let availableRoles = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Check if user is admin
    const authData = await checkAuth();
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Update user header
    const userHeader = document.getElementById('userHeader');
    userHeader.style.display = 'flex';
    document.getElementById('userName').textContent = authData.user.username;
    
    // Handle multiple roles
    const roles = authData.user.roles || [authData.user.role || 'student'];
    const roleElement = document.getElementById('userRole');
    roleElement.textContent = roles.join(', ');
    
    if (!roles.includes('admin')) {
        alert('Access denied. Admin role required.');
        window.location.href = '/';
        return;
    }
    
    if (roles.includes('admin')) {
        roleElement.classList.add('admin');
    }
    
    // Load data
    await loadRoles();
    await loadUsers();
});

async function loadRoles() {
    try {
        const response = await fetch('/api/admin/roles', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load roles');
        }
        
        const data = await response.json();
        availableRoles = data.roles;
    } catch (error) {
        console.error('Error loading roles:', error);
        alert('Failed to load roles');
    }
}

async function loadUsers() {
    try {
        const response = await fetch('/api/admin/users', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load users');
        }
        
        const data = await response.json();
        displayUsers(data.users);
    } catch (error) {
        console.error('Error loading users:', error);
        document.getElementById('usersTableBody').innerHTML = 
            '<tr><td colspan="7" style="text-align: center; color: red;">Failed to load users</td></tr>';
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    tbody.innerHTML = '';
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center;">No users found</td></tr>';
        return;
    }
    
    users.forEach(user => {
        const tr = document.createElement('tr');
        
        // Format roles
        const userRoles = user.roles || [];
        const rolesHtml = userRoles.map(role => 
            `<span class="role-badge ${role}">${role}</span>`
        ).join('');
        
        // Format date
        const createdDate = new Date(user.created_at).toLocaleDateString();
        
        // Status
        const statusClass = user.is_active ? 'active' : 'inactive';
        const statusText = user.is_active ? 'Active' : 'Inactive';
        
        tr.innerHTML = `
            <td>${user.id}</td>
            <td>${user.username}</td>
            <td>${user.email}</td>
            <td>${rolesHtml || '<span class="role-badge">No roles</span>'}</td>
            <td><span class="status-badge ${statusClass}">${statusText}</span></td>
            <td>${createdDate}</td>
            <td>
                <div class="action-buttons">
                    <button class="btn-small btn-edit" onclick="editUserRoles(${user.id}, '${user.username}', ${JSON.stringify(userRoles).replace(/"/g, '&quot;')})">
                        Edit Roles
                    </button>
                    <button class="btn-small btn-toggle" onclick="toggleUserStatus(${user.id}, ${user.is_active})">
                        ${user.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                </div>
            </td>
        `;
        
        tbody.appendChild(tr);
    });
}

function editUserRoles(userId, username, currentRoles) {
    currentEditUserId = userId;
    document.getElementById('modalUsername').textContent = username;
    
    // Populate role checkboxes
    const container = document.getElementById('roleCheckboxes');
    container.innerHTML = '';
    
    availableRoles.forEach(role => {
        const div = document.createElement('div');
        div.className = 'role-checkbox';
        
        const isChecked = currentRoles.includes(role.name);
        
        div.innerHTML = `
            <input type="checkbox" id="role-${role.id}" value="${role.name}" ${isChecked ? 'checked' : ''}>
            <label for="role-${role.id}">
                <strong>${role.name}</strong>
                <div class="role-description">${role.description}</div>
            </label>
        `;
        
        container.appendChild(div);
    });
    
    // Show modal
    document.getElementById('roleModal').style.display = 'block';
}

function closeRoleModal() {
    document.getElementById('roleModal').style.display = 'none';
    currentEditUserId = null;
}

async function saveRoles() {
    if (!currentEditUserId) return;
    
    // Get selected roles
    const checkboxes = document.querySelectorAll('#roleCheckboxes input[type="checkbox"]:checked');
    const selectedRoles = Array.from(checkboxes).map(cb => cb.value);
    
    try {
        const response = await fetch(`/api/admin/users/${currentEditUserId}/roles`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ roles: selectedRoles }),
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to update roles');
        }
        
        closeRoleModal();
        await loadUsers(); // Reload the table
        alert('Roles updated successfully');
    } catch (error) {
        console.error('Error updating roles:', error);
        alert('Failed to update roles');
    }
}

async function toggleUserStatus(userId, currentStatus) {
    const action = currentStatus ? 'deactivate' : 'activate';
    if (!confirm(`Are you sure you want to ${action} this user?`)) {
        return;
    }
    
    try {
        const response = await fetch(`/api/admin/users/${userId}/toggle-active`, {
            method: 'PUT',
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to toggle user status');
        }
        
        await loadUsers(); // Reload the table
    } catch (error) {
        console.error('Error toggling user status:', error);
        alert('Failed to toggle user status');
    }
}

// Close modal when clicking outside
window.onclick = function(event) {
    const modal = document.getElementById('roleModal');
    if (event.target === modal) {
        closeRoleModal();
    }
}

// Section switching
function showSection(section) {
    const usersSection = document.getElementById('usersSection');
    const configSection = document.getElementById('configSection');
    
    if (section === 'users') {
        usersSection.style.display = 'block';
        configSection.style.display = 'none';
    } else if (section === 'config') {
        usersSection.style.display = 'none';
        configSection.style.display = 'block';
        loadSystemConfig();
    }
}

// Load system configuration
async function loadSystemConfig() {
    try {
        const response = await fetch('/api/admin/config', {
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            throw new Error('Failed to load configuration');
        }
        
        const data = await response.json();
        displaySystemConfig(data.configs);
    } catch (error) {
        console.error('Error loading system config:', error);
        document.getElementById('configContainer').innerHTML = 
            '<div class="error">Failed to load system configuration</div>';
    }
}

// Display system configuration
function displaySystemConfig(configs) {
    const container = document.getElementById('configContainer');
    container.innerHTML = '';
    
    // Find question generation config
    const questionConfig = configs.find(c => c.key === 'question_generation_allowed');
    
    if (questionConfig) {
        const configItem = document.createElement('div');
        configItem.className = 'config-item';
        configItem.innerHTML = `
            <h3>Question Generation Permissions</h3>
            <p class="description">${questionConfig.description}</p>
            <div class="config-value">
                <div class="role-selector">
                    <label>
                        <input type="checkbox" value="user" ${questionConfig.value.includes('user') ? 'checked' : ''}>
                        User
                    </label>
                    <label>
                        <input type="checkbox" value="teacher" ${questionConfig.value.includes('teacher') ? 'checked' : ''}>
                        Teacher
                    </label>
                    <label>
                        <input type="checkbox" value="admin" ${questionConfig.value.includes('admin') ? 'checked' : ''}>
                        Admin
                    </label>
                </div>
                <button class="btn btn-primary" onclick="saveQuestionPermissions()">Save</button>
            </div>
        `;
        container.appendChild(configItem);
    }
}

// Save question generation permissions
async function saveQuestionPermissions() {
    const checkboxes = document.querySelectorAll('.role-selector input[type="checkbox"]:checked');
    const selectedRoles = Array.from(checkboxes).map(cb => cb.value);
    
    try {
        const response = await fetch('/api/admin/config/question_generation_allowed', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json'
            },
            credentials: 'same-origin',
            body: JSON.stringify({ value: selectedRoles })
        });
        
        if (!response.ok) {
            throw new Error('Failed to update configuration');
        }
        
        const result = await response.json();
        alert('Configuration updated successfully!');
        loadSystemConfig(); // Reload to show updated values
    } catch (error) {
        console.error('Error updating configuration:', error);
        alert('Failed to update configuration');
    }
} 