// movieDetailModal.js
import { api, track } from 'lwc';
import LightningModal from 'lightning/modal';
import getMovieDetail from '@salesforce/apex/MovieController.getMovieDetail';

export default class MovieDetailModal extends LightningModal {
    @api imdbId; 
    @track movie;
    isLoading = true;
    fallbackPoster = 'https://placehold.co';

    connectedCallback() {
        this.loadMovieDetails();
    }

    loadMovieDetails() {
        this.isLoading = true;
        getMovieDetail({ imdbId: this.imdbId })
            .then(result => {
                if (result && result.Response === 'True') {
                    this.movie = {
                        ...result,
                        Poster: result.Poster !== 'N/A' ? result.Poster : this.fallbackPoster
                    };
                } else {
                    this.movie = null;
                }
            })
            .catch(error => {
                console.error('Error loading movie details:', error);
            })
            .finally(() => {
                this.isLoading = false;
            });
    }

    get modalTitle() {
        return this.movie ? this.movie.Title : 'Movie Details';
    }

    handleClose() {
        this.close();
    }
}
