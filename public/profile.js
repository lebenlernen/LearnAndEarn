document.addEventListener('DOMContentLoaded', async () => {
    // Check authentication
    const authData = await checkAuth();
    
    if (!authData.authenticated) {
        window.location.href = '/login.html';
        return;
    }
    
    // Update header
    updateAuthUI();
    
    // Load user data
    loadUserProfile(authData.user);
    
    // Handle form submission
    document.getElementById('profileForm').addEventListener('submit', handleProfileUpdate);
});

// Load user profile data
const loadUserProfile = (user) => {
    // Display basic info
    document.getElementById('userEmail').textContent = user.email;
    document.getElementById('userUsername').textContent = user.username;
    
    // Set form values
    if (user.country) {
        document.getElementById('country').value = user.country;
    }
    if (user.mother_language) {
        document.getElementById('motherLanguage').value = user.mother_language;
    }
    if (user.timezone) {
        document.getElementById('timezone').value = user.timezone;
    }
};

// Handle profile update
const handleProfileUpdate = async (e) => {
    e.preventDefault();
    
    const successMessage = document.getElementById('successMessage');
    const errorMessage = document.getElementById('errorMessage');
    
    // Hide messages
    successMessage.style.display = 'none';
    errorMessage.style.display = 'none';
    
    const formData = {
        country: document.getElementById('country').value,
        mother_language: document.getElementById('motherLanguage').value,
        timezone: document.getElementById('timezone').value
    };
    
    try {
        const response = await fetch('/api/auth/profile', {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData),
            credentials: 'same-origin'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Failed to update profile');
        }
        
        const result = await response.json();
        
        // Show success message
        successMessage.textContent = 'Profil erfolgreich aktualisiert!';
        successMessage.style.display = 'block';
        
        // Scroll to top to show message
        window.scrollTo(0, 0);
        
        // Hide success message after 3 seconds
        setTimeout(() => {
            successMessage.style.display = 'none';
        }, 3000);
        
    } catch (error) {
        console.error('Error updating profile:', error);
        errorMessage.textContent = error.message || 'Fehler beim Aktualisieren des Profils';
        errorMessage.style.display = 'block';
        window.scrollTo(0, 0);
    }
}; 