document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsContainer = document.getElementById('resultsContainer');
    const paginationContainer = document.getElementById('paginationContainer');
    const searchInfo = document.getElementById('searchInfo');
    const categoryFilter = document.getElementById('categoryFilter');
    const subtitleQualityFilter = document.getElementById('subtitleQualityFilter');
    
    let currentPage = 1;
    let totalPages = 1;
    let lastSearchQuery = '';
    let selectedCategory = '';
    
    
    // Check authentication and update UI
    async function updateAuthUI() {
        const authData = await checkAuth();
        const userHeader = document.getElementById('userHeader');
        const authPrompt = document.getElementById('authPrompt');
        
        if (authData.authenticated) {
            if (userHeader) {
                userHeader.style.display = 'flex';
            }
            if (authPrompt) {
                authPrompt.style.display = 'none';
            }
            
            const userNameElement = document.getElementById('userName');
            if (userNameElement) {
                userNameElement.textContent = authData.user.username;
            }
            
            // Handle multiple roles
            const roles = authData.user.roles || [authData.user.role || 'student'];
            const roleElement = document.getElementById('userRole');
            if (roleElement) {
                roleElement.textContent = roles.join(', ');
                
                // Check if user has admin role
                if (roles.includes('admin')) {
                    roleElement.classList.add('admin');
                    const adminLink = document.getElementById('adminLink');
                    if (adminLink) {
                        adminLink.style.display = 'inline-block';
                    }
                }
            }
        } else {
            if (userHeader) {
                userHeader.style.display = 'none';
            }
            if (authPrompt) {
                authPrompt.style.display = 'block';
            }
        }
    }
    
    // Initialize auth UI
    updateAuthUI();
    
    // Fetch and populate categories
    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/categories');
            if (response.ok) {
                const categories = await response.json();
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category;
                    option.textContent = category;
                    categoryFilter.appendChild(option);
                });
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };
    
    fetchCategories();
    
    // Search function
    const performSearch = async (page = 1) => {
        const query = searchInput.value.trim();
        
        if (!query && !selectedCategory) {
            searchInfo.textContent = 'Please enter a search term or select a category.';
            resultsContainer.innerHTML = '';
            paginationContainer.innerHTML = '';
            return;
        }
        
        currentPage = page;
        lastSearchQuery = query;
        
        // Get the selected search scope
        const searchScope = document.querySelector('input[name="searchScope"]:checked').value;
        
        try {
            const params = new URLSearchParams({
                query: query,
                category: selectedCategory,
                page: currentPage,
                searchScope: searchScope,
                subtitleQuality: subtitleQualityFilter ? subtitleQualityFilter.value : ''
            });
            
            
            const response = await fetch(`/api/videos/search?${params}`);
            if (!response.ok) {
                throw new Error('Search failed');
            }
            
            const data = await response.json();
            displayResults(data);
        } catch (error) {
            console.error('Search error:', error);
            searchInfo.textContent = 'An error occurred while searching. Please try again.';
            resultsContainer.innerHTML = '';
        }
    };
    
    // Display search results
    const displayResults = (data) => {
        const { videos, totalCount, currentPage: page, totalPages: pages } = data;
        
        totalPages = pages;
        currentPage = page;
        
        // Update search info
        if (totalCount === 0) {
            searchInfo.textContent = 'No videos found.';
            resultsContainer.innerHTML = '';
            paginationContainer.innerHTML = '';
            return;
        }
        
        const start = (currentPage - 1) * 25 + 1;
        const end = Math.min(currentPage * 25, totalCount);
        searchInfo.textContent = `Showing ${start}-${end} of ${totalCount} results`;
        
        // Display videos
        resultsContainer.innerHTML = '';
        videos.forEach(video => {
            const videoCard = createVideoCard(video);
            resultsContainer.appendChild(videoCard);
        });
        
        // Update pagination
        updatePagination();
    };
    
    // Create video card
    const createVideoCard = (video) => {
        const card = document.createElement('div');
        card.className = 'video-card';
        card.style.cursor = 'pointer';
        
        // Decode the title and description properly
        const decodedTitle = decodeURIComponent(video.title || '').replace(/\+/g, ' ');
        const decodedDescription = decodeURIComponent(video.description || '').replace(/\+/g, ' ');
        
        // Add subtitle quality indicator
        // sub_manual is stored as string in database: '1' = auto, '2' = manual
        const subtitleBadge = video.sub_manual === '1' 
            ? '<span class="subtitle-badge auto-generated" title="Automatisch generierte Untertitel">🤖 Auto</span>'
            : '<span class="subtitle-badge manual" title="Manuelle Untertitel">✍️ Manuell</span>';
        
        card.innerHTML = `
            <div class="video-card-content">
                <h3>${decodedTitle}</h3>
                <p>${decodedDescription.substring(0, 150)}${decodedDescription.length > 150 ? '...' : ''}</p>
                <div class="video-channel">${video.channel || 'Unknown Channel'}</div>
                <div class="video-metadata">
                    ${video._type ? `<span class="video-category">${video._type}</span>` : ''}
                    ${subtitleBadge}
                </div>
            </div>
        `;
        
        // Make card clickable
        card.addEventListener('click', () => {
            window.location.href = `/detail.html?id=${video.id}`;
        });
        
        return card;
    };
    
    // Update pagination controls
    const updatePagination = () => {
        paginationContainer.innerHTML = '';
        
        if (totalPages <= 1) return;
        
        // Previous button
        const prevButton = document.createElement('button');
        prevButton.textContent = '← Previous';
        prevButton.className = 'pagination-button';
        prevButton.disabled = currentPage === 1;
        prevButton.addEventListener('click', () => performSearch(currentPage - 1));
        paginationContainer.appendChild(prevButton);
        
        // Page info
        const pageInfo = document.createElement('span');
        pageInfo.className = 'pagination-info';
        pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
        paginationContainer.appendChild(pageInfo);
        
        // Next button
        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next →';
        nextButton.className = 'pagination-button';
        nextButton.disabled = currentPage === totalPages;
        nextButton.addEventListener('click', () => performSearch(currentPage + 1));
        paginationContainer.appendChild(nextButton);
    };
    
    // Event listeners
    searchButton.addEventListener('click', () => performSearch(1));
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            performSearch(1);
        }
    });
    
    categoryFilter.addEventListener('change', (e) => {
        selectedCategory = e.target.value;
        if (lastSearchQuery || selectedCategory) {
            performSearch(1);
        }
    });
    
    // Search scope radio buttons listener
    const searchScopeRadios = document.querySelectorAll('input[name="searchScope"]');
    searchScopeRadios.forEach(radio => {
        radio.addEventListener('change', () => {
            if (lastSearchQuery || selectedCategory) {
                performSearch(1);
            }
        });
    });
    
    // Subtitle quality filter listener
    if (subtitleQualityFilter) {
        subtitleQualityFilter.addEventListener('change', () => {
            if (lastSearchQuery || selectedCategory) {
                performSearch(1);
            }
        });
    }
    
    
    // Perform initial search if there's a query in the input
    if (searchInput.value.trim()) {
        performSearch(1);
    }
});