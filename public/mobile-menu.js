// Mobile menu functionality
document.addEventListener('DOMContentLoaded', function() {
    // Wait for auth to load first
    setTimeout(function() {
        createMobileMenu();
    }, 100);
    
    // Handle window resize
    let resizeTimer;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(function() {
            // Remove mobile elements if switching to desktop
            if (window.innerWidth > 768) {
                const hamburger = document.querySelector('.mobile-menu-toggle');
                const overlay = document.querySelector('.mobile-menu-overlay');
                const navLinks = document.querySelector('.nav-links');
                
                if (hamburger) {
                    hamburger.classList.remove('active');
                    navLinks.classList.remove('active');
                    overlay.classList.remove('active');
                    document.body.style.overflow = '';
                }
            } else {
                // Re-add user actions if switching to mobile
                addUserActionsToMenu();
            }
        }, 250);
    });
});

function createMobileMenu() {
    const userHeader = document.getElementById('userHeader');
    if (!userHeader) return;
    
    // Check if hamburger already exists
    if (document.querySelector('.mobile-menu-toggle')) return;
    
    // Create hamburger button
    const hamburger = document.createElement('button');
    hamburger.className = 'mobile-menu-toggle';
    hamburger.innerHTML = `
        <span></span>
        <span></span>
        <span></span>
    `;
    
    // Add to header
    userHeader.insertBefore(hamburger, userHeader.firstChild);
    
    // Get nav links
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    
    // Always add user actions to mobile menu (they'll only show on mobile via CSS)
    addUserActionsToMenu();
    
    // Create overlay
    const overlay = document.createElement('div');
    overlay.className = 'mobile-menu-overlay';
    document.body.appendChild(overlay);
    
    // Toggle menu on click
    hamburger.addEventListener('click', function(e) {
        e.stopPropagation();
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
        overlay.classList.toggle('active');
        document.body.style.overflow = navLinks.classList.contains('active') ? 'hidden' : '';
    });
    
    // Close menu when clicking overlay
    overlay.addEventListener('click', function() {
        hamburger.classList.remove('active');
        navLinks.classList.remove('active');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
    });
    
    // Close menu when clicking a link
    const links = navLinks.querySelectorAll('.nav-link');
    links.forEach(link => {
        link.addEventListener('click', function() {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
            overlay.classList.remove('active');
            document.body.style.overflow = '';
        });
    });
}

function addUserActionsToMenu() {
    const navLinks = document.querySelector('.nav-links');
    if (!navLinks) return;
    
    // Check if already added
    if (document.querySelector('.mobile-user-section')) return;
    
    // Create separator
    const separator = document.createElement('div');
    separator.className = 'mobile-menu-separator';
    separator.style.cssText = 'height: 1px; background: #e0e0e0; margin: 20px 0;';
    navLinks.appendChild(separator);
    
    // Create user section
    const userSection = document.createElement('div');
    userSection.className = 'mobile-user-section';
    userSection.style.cssText = 'padding: 0;';
    
    // Add profile link
    const profileLink = document.createElement('a');
    profileLink.href = '/profile.html';
    profileLink.className = 'nav-link mobile-profile-link';
    profileLink.textContent = 'Mein Profil';
    profileLink.style.cssText = 'display: block; padding: 15px 20px; text-decoration: none; color: #333; border-bottom: 1px solid #f0f0f0;';
    userSection.appendChild(profileLink);
    
    // Add logout button
    const logoutBtn = document.createElement('button');
    logoutBtn.className = 'nav-link mobile-logout-btn';
    logoutBtn.textContent = 'Abmelden';
    logoutBtn.onclick = function() { logout(); };
    logoutBtn.style.cssText = 'display: block; width: 100%; text-align: left; padding: 15px 20px; background: none; border: none; color: #dc3545; font-size: 1em; cursor: pointer; font-family: inherit;';
    userSection.appendChild(logoutBtn);
    
    navLinks.appendChild(userSection);
}