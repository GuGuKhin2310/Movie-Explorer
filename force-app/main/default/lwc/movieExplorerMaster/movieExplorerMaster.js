// movieExplorerMaster.js
import { LightningElement } from 'lwc';
import addMovieToFavorites from '@salesforce/apex/MovieController.addMovieToFavorites';
import movieDetailModal from 'c/movieDetailModal';
import LightningAlert from 'lightning/alert';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class MovieExplorerMaster extends LightningElement {

    async handleOpenDetailsModal(event) {
        const imdbId = event.detail; 
        try {
            await movieDetailModal.open({
                size: 'medium',
                imdbId: imdbId 
            });
        } catch (error) {
            console.error('Error opening detail modal window component:', error);
        }
    }

    handleCreateFavoriteRecord(event) {
        const movie = event.detail;
        if (!movie) return;

        // FIXED 1: Safely detects relative paths from recommendations and fixes them with absolute URL tracking paths
        let absolutePosterUrl = movie.Poster;
        if (absolutePosterUrl && absolutePosterUrl.startsWith('/sfc/')) {
            absolutePosterUrl = window.location.origin + absolutePosterUrl;
        }

        // FIXED 2: Correctly checks both movie property case mapping outcomes (imdbID and imdbId)
        const verifiedImdbId = movie.imdbID || movie.imdbId;

        // FIXED 3: Changed the invalid Java/Apex Decimal statement to use standard native JavaScript parseFloat() parsing signatures!
        let processedImdbRating = null;
        if (movie.imdbRating && movie.imdbRating !== 'N/A') {
            processedImdbRating = parseFloat(movie.imdbRating);
        }

        const favoriteRecord = {
            sobjectType: 'Favorite_Movie__c',
            Movie_ID__c: verifiedImdbId,
            Movie_Title__c: movie.Title,
            Release_Year__c: isNaN(parseInt(movie.Year, 10)) ? null : parseInt(movie.Year, 10),
            Poster_URL__c: absolutePosterUrl,
            Movie_Type__c: movie.Type,
            IMDb_Rating__c: processedImdbRating 
        };

        addMovieToFavorites({ movieRecord: favoriteRecord })
            .then(() => {
                this.dispatchEvent(
                    new ShowToastEvent({
                        title: 'Success',
                        message: `"${movie.Title}" has been added to your favorites!`,
                        variant: 'success'
                    })
                );
                
                // Triggers structural array updates inside subcomponent node templates instantly on click
                const favoritesCmp = this.template.querySelector('.favorites-list-cmp');
                if (favoritesCmp) {
                    favoritesCmp.refreshList();
                }
            })
            .catch(error => {
                LightningAlert.open({
                    message: error.body?.message || 'Database execution rules rejected your statement record input.',
                    theme: 'error',
                    label: 'Save Error'
                });
            });
    }
}
