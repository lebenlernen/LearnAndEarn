document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabs = document.querySelectorAll('.auth-tab');
    const forms = document.querySelectorAll('.auth-form');
    const switchLinks = document.querySelectorAll('.switch-tab');
    
    function switchTab(tabName) {
        tabs.forEach(tab => {
            tab.classList.toggle('active', tab.dataset.tab === tabName);
        });
        forms.forEach(form => {
            form.classList.toggle('active', form.id === `${tabName}Form`);
        });
    }
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });
    
    switchLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            switchTab(link.dataset.tab);
        });
    });
    
    // Login form
    const loginForm = document.getElementById('loginForm');
    const loginError = document.getElementById('loginError');
    
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        loginError.textContent = '';
        
        const formData = new FormData(loginForm);
        const email = formData.get('email');
        const password = formData.get('password');
        
        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, password }),
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Redirect to home page or previous page
                const redirectUrl = new URLSearchParams(window.location.search).get('redirect') || '/';
                window.location.href = redirectUrl;
            } else {
                loginError.textContent = data.error || 'Login failed. Please try again.';
            }
        } catch (error) {
            console.error('Login error:', error);
            loginError.textContent = 'An error occurred. Please try again.';
        }
    });
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    const registerError = document.getElementById('registerError');
    
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        registerError.textContent = '';
        
        const formData = new FormData(registerForm);
        const email = formData.get('email');
        const username = formData.get('username');
        const password = formData.get('password');
        
        // Client-side validation
        if (password.length < 6) {
            registerError.textContent = 'Password must be at least 6 characters long.';
            return;
        }
        
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email, username, password }),
                credentials: 'same-origin'
            });
            
            const data = await response.json();
            
            if (response.ok && data.success) {
                // Auto-login after registration
                window.location.href = '/';
            } else {
                registerError.textContent = data.error || 'Registration failed. Please try again.';
            }
        } catch (error) {
            console.error('Registration error:', error);
            registerError.textContent = 'An error occurred. Please try again.';
        }
    });
});

// Check authentication status
async function checkAuth() {
    try {
        const response = await fetch('/api/auth/me', {
            credentials: 'same-origin'
        });
        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Auth check error:', error);
        return { authenticated: false };
    }
}

// Logout function
async function logout() {
    try {
        const response = await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'same-origin'
        });
        
        if (response.ok) {
            window.location.href = '/';
        }
    } catch (error) {
        console.error('Logout error:', error);
    }
} 