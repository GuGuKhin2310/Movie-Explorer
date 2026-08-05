// movieSearch.js
import { LightningElement, track } from 'lwc';
import searchMovies from '@salesforce/apex/MovieController.searchMovies';
import getRecommendedMovies from '@salesforce/apex/MovieController.getRecommendedMovies';
import LightningAlert from 'lightning/alert';

export default class MovieSearch extends LightningElement {
    searchTerm = '';
    @track movies = [];
    isLoading = false;
    @track gridTitle = 'Recommended For You';
    
    // Track sort states choices profiles options descriptors variables fields
    sortValue = 'none';
    pageNumber = 1;
    totalResults = 0;
    totalPages = 1;
    fallbackPoster = 'https://placehold.co';

    get sortOptions() {
        return [
            { label: 'Default (Relevance)', value: 'none' },
            { label: 'Year: Newest First', value: 'newest' },
            { label: 'Year: Oldest First', value: 'oldest' }
        ];
    }

    connectedCallback() {
        this.loadRecommendations();
    }

    loadRecommendations() {
        this.isLoading = true;
        this.gridTitle = 'Recommended For You';
        getRecommendedMovies()
            .then(result => {
                if (result && result.length > 0) {
                    this.movies = result;
                    this.applyLocalSort();
                    this.totalResults = result.length;
                    this.totalPages = 1;
                }
            })
            .catch(error => {
                console.error('Error fetching recommendations:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    handleInputChange(event) {
        this.searchTerm = event.target.value;
        if (!this.searchTerm.trim()) {
            this.pageNumber = 1;
            this.sortValue = 'none';
            this.loadRecommendations();
        }
    }

    handleSortChange(event) {
        this.sortValue = event.detail.value;
        if (this.movies.length > 0) {
            this.applyLocalSort();
        }
    }

    applyLocalSort() {
        if (this.sortValue === 'none') return;
        
        this.movies = [...this.movies].sort((a, b) => {
            // Clean up string fields using regex loops extensions variables formulas parameters blocks
            const yearA = parseInt(a.Year ? a.Year.replace(/\D/g, '') : '0', 10);
            const yearB = parseInt(b.Year ? b.Year.replace(/\D/g, '') : '0', 10);
            return this.sortValue === 'newest' ? yearB - yearA : yearA - yearB;
        });
    }

    handleSearch() {
        if (!this.searchTerm.trim()) {
            LightningAlert.open({ message: 'Movie Title cannot be empty.', theme: 'error', label: 'Validation Error' });
            return;
        }
        this.pageNumber = 1;
        this.fetchMovies();
    }

    fetchMovies() {
        this.isLoading = true;
        this.gridTitle = `Search Results for "${this.searchTerm}"`;

        searchMovies({ searchTerm: this.searchTerm, pageNumber: this.pageNumber })
            .then(result => {
                if (result && result.Response === 'True') {
                    this.movies = result.Search;
                    this.applyLocalSort();
                    this.totalResults = parseInt(result.totalResults, 10);
                    this.totalPages = Math.ceil(this.totalResults / 10) || 1;
                } else {
                    this.movies = [];
                    this.totalPages = 1;
                    LightningAlert.open({ message: result.Error || 'Movie not found!', theme: 'warning', label: 'No Results' });
                }
            })
            .catch(error => {
                LightningAlert.open({ message: error.body?.message || 'API temporarily down.', theme: 'error', label: 'System Error' });
            })
            .finally(() => { this.isLoading = false; });
    }

    handlePrevious() { if (this.pageNumber > 1) { this.pageNumber--; this.fetchMovies(); } }
    handleNext() { if (this.pageNumber < this.totalPages) { this.pageNumber++; this.fetchMovies(); } }

    get isPreviousDisabled() { return this.pageNumber <= 1 || this.gridTitle === 'Recommended For You'; }
    get isNextDisabled() { return this.pageNumber >= this.totalPages || this.gridTitle === 'Recommended For You'; }

    handleGridImageError(event) {
        event.preventDefault();
        const imdbId = event.target.dataset.id;
        if (!imdbId) return;
        this.movies = this.movies.map(movie => {
            if (movie.imdbID === imdbId) { return { ...movie, Poster: this.fallbackPoster }; }
            return movie;
        });
    }

    handleDetailsClick(event) {
        const imdbId = event.currentTarget.dataset.id;
        if (!imdbId || imdbId === 'undefined') return;
        this.dispatchEvent(new CustomEvent('viewdetails', { detail: imdbId }));
    }

    handleFavoriteClick(event) {
        event.stopPropagation();
        const imdbId = event.currentTarget.dataset.id;
        const selectedMovie = this.movies.find(m => (m.imdbID || m.imdbId) === imdbId);
        if (selectedMovie) {
            this.dispatchEvent(new CustomEvent('addfavorite', { detail: selectedMovie }));
        }
    }
}
