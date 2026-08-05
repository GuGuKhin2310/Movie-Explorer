// movieFavoritesList.js
import { LightningElement, track, api } from 'lwc';
import getFavoriteMovies from '@salesforce/apex/MovieController.getFavoriteMovies';
import deleteFavoriteMovie from '@salesforce/apex/MovieController.deleteFavoriteMovie';
import updateFavorites from '@salesforce/apex/MovieController.updateFavorites';
import LightningConfirm from 'lightning/confirm';
import LightningAlert from 'lightning/alert';
import LightningPrompt from 'lightning/prompt';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class MovieFavoritesList extends LightningElement {
    @track favorites = [];
    isLoading = false;

    searchKey = '';
    sortBy = 'Favorite_Date__c';
    sortDirection = 'DESC';

    sortSelectionValue = 'Favorite_Date__c:DESC';
    pageNumber = 1;
    pageSize = 5; 
    totalRecords = 0;
    totalPages = 1;
    fallbackPoster = 'https://placehold.co';

    connectedCallback() {
        this.loadFavorites();
    }

    @api
    refreshList() {
        this.loadFavorites();
    }

    loadFavorites() {
        this.isLoading = true;
        getFavoriteMovies({
            searchKey: this.searchKey,
            sortBy: this.sortBy,
            sortDirection: this.sortDirection,
            pageSize: this.pageSize,
            pageNumber: this.pageNumber
        })
        .then(result => {
            if (result) {
                // Decorate backend data arrays with dynamic layout state metadata properties
                this.favorites = result.records.map(fav => {
                    const currentRating = fav.My_Rating__c || 0;
                    const starsArray = [];
                    for (let i = 1; i <= 5; i++) {
                        starsArray.push({
                            value: i,
                            className: i <= currentRating ? 'star-glyph active-filled-star' : 'star-glyph empty-star-slot'
                        });
                    }
                    return {
                        ...fav,
                        Poster_URL__c: fav.Poster_URL__c || this.fallbackPoster,
                        stars: starsArray
                    };
                });
                this.totalRecords = result.totalRecords;
                this.totalPages = Math.ceil(this.totalRecords / this.pageSize) || 1;
            }
        })
        .catch(error => {
            console.error('Error fetching favorites:', error);
        })
        .finally(() => {
            this.isLoading = false;
        });
    }
        
    get favSortOptions() {
        return [
            { label: 'Date Added: Newest First', value: 'Favorite_Date__c:DESC' },
            { label: 'Year: Newest First', value: 'Release_Year__c:DESC' },
            { label: 'Year: Oldest First', value: 'Release_Year__c:ASC' },
            { label: 'Title: A-Z', value: 'Movie_Title__c:ASC' }
        ];
    }

    
    handleFavSortChange(event) {
        const selectedSortValue = event.detail.value;
        this.sortSelectionValue = selectedSortValue;
        
        if (selectedSortValue) {
            // Splits our composite text value string "Release_Year__c:DESC" into operational parts
            const sortingParts = selectedSortValue.split(':');
            this.sortBy = sortingParts[0];       // e.g., 'Release_Year__c'
            this.sortDirection = sortingParts[1]; // e.g., 'DESC'
            
            this.pageNumber = 1;  // Resets the page index pointers back to 1
            this.loadFavorites(); // Instantly queries the Salesforce database with our sorted parameters!
        }
    }


    handleSearchChange(event) {
        this.searchKey = event.target.value;
        this.pageNumber = 1;
        this.loadFavorites();
    }

    handleFavImageError(event) {
        event.preventDefault();
        const recordId = event.target.dataset.id;
        if (!recordId) return;
        this.favorites = this.favorites.map(fav => {
            if (fav.Id === recordId) {
                return { ...fav, Poster_URL__c: this.fallbackPoster };
            }
            return fav;
        });
    }

    // Handles inline interactive star calculations and posts records updates to Apex dynamically
    handleStarClick(event) {
        const recordId = event.target.dataset.id;
        const newRatingValue = parseInt(event.target.dataset.value, 10);
        
        this.isLoading = true;
        const recordUpdateInput = [{
            Id: recordId,
            My_Rating__c: newRatingValue
        }];

        updateFavorites({ recordsToUpdate: recordUpdateInput })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Rating Updated',
                        message: `Successfully set rating to ${newRatingValue} stars.`,
                        variant: 'success'
                    })
                );
                this.loadFavorites();
            })
            .catch(error => {
                this.isLoading = false;
                LightningAlert.open({
                    message: error.body?.message || 'Failed to capture structural database inline metrics.',
                    theme: 'error',
                    label: 'Database Update Error'
                });
            });
    }

    // Captures custom text reviews from users via native secure platform input prompt popups
    async handleManageNotesClick(event) {
        event.stopPropagation();
        const recordId = event.currentTarget.dataset.id;
        const currentTargetMovie = this.favorites.find(f => f.Id === recordId);
        const existingNotesContent = currentTargetMovie.Notes__c && currentTargetMovie.Notes__c !== 'undefined' 
        ? currentTargetMovie.Notes__c 
        : '';

        const selectedNotesInput = await LightningPrompt.open({
            message: `Update your personal notes for "${currentTargetMovie.Movie_Title__c}":`,
            label: 'Movie Notes',
            defaultValue: existingNotesContent,
            placeholder: 'Type your notes here (Max 500 characters)...'
        });

        // If the user did not press cancel, handle the string transaction
        if (selectedNotesInput !== null) {
            if (selectedNotesInput.length > 500) {
                LightningAlert.open({
                    message: 'Custom notes cannot exceed the maximum of 500 characters.',
                    theme: 'error',
                    label: 'Validation Conflict'
                });
                return;
            }

            this.isLoading = true;
            const recordUpdateInput = [{
                Id: recordId,
                Notes__c: selectedNotesInput
            }];

            updateFavorites({ recordsToUpdate: recordUpdateInput })
                .then(() => {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Notes Saved',
                            message: 'Successfully noted.',
                            variant: 'success'
                        })
                    );
                    this.loadFavorites();
                })
                .catch(error => {
                    this.isLoading = false;
                    LightningAlert.open({
                        message: error.body?.message || 'Database update transactions rejected your string parameters block input.',
                        theme: 'error',
                        label: 'Save Error'
                    });
                });
        }
    }

    
    handleViewDetailsClick(event) {
        event.stopPropagation();
        const movieImdbId = event.currentTarget.dataset.id;
        if(movieImdbId) {
            this.dispatchEvent(new CustomEvent('viewdetails', { 
                bubbles: true,
                composed: true,
                detail: movieImdbId 
            }));
        }
    }


    async handleRemoveFavorite(event) {
        const recordId = event.target.dataset.id;
        const targetMovie = this.favorites.find(f => f.Id === recordId);
        const titleName = targetMovie ? targetMovie.Movie_Title__c : 'this movie';

        const confirmed = await LightningConfirm.open({
            message: `Are you sure you want to remove "${titleName}"?`,
            label: 'Confirm Removal',
            theme: 'warning'
        });

        if (confirmed) {
            this.isLoading = true;
            deleteFavoriteMovie({ recordId: recordId })
                .then(() => {
                    this.dispatchEvent(
                        new ShowToastEvent({
                            title: 'Success',
                            message: 'Movie successfully removed from favorites.',
                            variant: 'success'
                        })
                    );
                    if (this.favorites.length === 1 && this.pageNumber > 1) {
                        this.pageNumber--;
                    }
                    this.loadFavorites();
                })
                .catch(error => {
                    LightningAlert.open({
                        message: error.body?.message || 'Delete transaction was rejected by backend validation dependencies.',
                        theme: 'error',
                        label: 'Delete Conflict'
                    });
                })
                .finally(() => {
                    this.isLoading = false;
                });
        }
    }

    handlePrevious() {
        if (this.pageNumber > 1) {
            this.pageNumber--;
            this.loadFavorites();
        }
    }

    handleNext() {
        if (this.pageNumber < this.totalPages) {
            this.pageNumber++;
            this.loadFavorites();
        }
    }

    get isPreviousDisabled() {
        return this.pageNumber <= 1;
    }

    get isNextDisabled() {
        return this.pageNumber >= this.totalPages;
    }
}
