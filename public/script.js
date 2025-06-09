document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('searchInput');
    const searchButton = document.getElementById('searchButton');
    const resultsContainer = document.getElementById('resultsContainer');
    const paginationContainer = document.getElementById('paginationContainer');
    const searchInfo = document.getElementById('searchInfo');
    const categoryFilter = document.getElementById('categoryFilter');
    
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
            userHeader.style.display = 'flex';
            authPrompt.style.display = 'none';
            
            document.getElementById('userName').textContent = authData.user.username;
            document.getElementById('userRole').textContent = authData.user.role;
            
            if (authData.user.role === 'admin') {
                document.getElementById('userRole').classList.add('admin');
                document.getElementById('adminLink').style.display = 'block';
            }
        } else {
            userHeader.style.display = 'none';
            authPrompt.style.display = 'block';
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
        
        try {
            const params = new URLSearchParams({
                q: query,
                category: selectedCategory,
                page: currentPage
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
        
        card.innerHTML = `
            <div class="video-card-content">
                <h3>${decodedTitle}</h3>
                <p>${decodedDescription.substring(0, 150)}${decodedDescription.length > 150 ? '...' : ''}</p>
                ${video._type ? `<span class="video-category">${video._type}</span>` : ''}
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
    
    // Perform initial search if there's a query in the input
    if (searchInput.value.trim()) {
        performSearch(1);
    }
});