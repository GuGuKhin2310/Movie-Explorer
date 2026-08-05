// MovieController.cls
public with sharing class MovieController {

    @AuraEnabled(cacheable=false)
    public static MovieWrapper.SearchResult searchMovies(String searchTerm, Integer pageNumber) {
        MovieWrapper.SearchResult result = MovieService.searchMovies(searchTerm, pageNumber);
        if (result != null && result.Search != null) {
            for (MovieWrapper.MovieShort movie : result.Search) {
                try {
                // Fetch deep metadata payload to extract the true IMDb Rating string
                MovieWrapper.MovieDetail deepDetail = MovieService.getMovieDetail(movie.imdbID);
                if (deepDetail != null && String.isNotBlank(deepDetail.imdbRating)) {
                    movie.imdbRating = deepDetail.imdbRating;
                    movie.Genre = deepDetail.Genre;
                }
            } catch (Exception e) {
                movie.imdbRating = 'N/A';
            }

            if (String.isNotBlank(movie.Poster) && movie.Poster != 'N/A') {
                movie.Poster = fetchAndSaveRemotePoster(movie.imdbID, movie.Poster);
            }
            
        }
    }
        return result;
    }

    @AuraEnabled(cacheable=true)
    public static MovieWrapper.MovieDetail getMovieDetail(String imdbId) {
        MovieWrapper.MovieDetail details = MovieService.getMovieDetail(imdbId);
        if (details != null && String.isNotBlank(details.imdbID)) {
            String titleSearchName = 'MoviePoster_' + details.imdbID;
            List<ContentVersion> localFiles = [
                SELECT Id FROM ContentVersion 
                WHERE Title = :titleSearchName AND IsLatest = true LIMIT 1
            ];
            if (!localFiles.isEmpty()) {
                details.Poster = '/sfc/servlet.shepherd/version/download/' + localFiles[0].Id;
            }
        }
        return details;
    }

    @AuraEnabled(cacheable=false)
    public static List<MovieWrapper.MovieShort> getRecommendedMovies() {
        List<String> recommendationIds = new List<String>{
            'tt1375666', 'tt0816692', 'tt4633694', 'tt1160419', 'tt0468569', 'tt1877830',
            'tt0111161', 'tt0133093', 'tt6751668', 'tt0109830'
        };
        List<MovieWrapper.MovieShort> recommendedList = new List<MovieWrapper.MovieShort>();
        for (String imdbId : recommendationIds) {
            try {
                MovieWrapper.MovieDetail details = MovieService.getMovieDetail(imdbId);
                if (details != null && details.Response == 'True') {
                    MovieWrapper.MovieShort shortMovie = new MovieWrapper.MovieShort();
                    shortMovie.Title = details.Title;
                    shortMovie.Year = details.Year;
                    shortMovie.imdbID = details.imdbID;
                    shortMovie.Type = details.Type;
                    if (String.isNotBlank(details.Poster) && details.Poster != 'N/A') {
                        shortMovie.Poster = fetchAndSaveRemotePoster(details.imdbID, details.Poster);
                    } else {
                        shortMovie.Poster = 'https://placehold.co';
                    }
                    shortMovie.imdbRating = details.imdbRating;
                    recommendedList.add(shortMovie);
                }
            } catch (Exception e) {
                System.debug('Skipping recommendation ID due to failure: ' + e.getMessage());
            }
        }
        return recommendedList;
    }

    @AuraEnabled
    public static void addMovieToFavorites(Favorite_Movie__c movieRecord) {
        if (movieRecord.My_Rating__c != null && (movieRecord.My_Rating__c < 1 || movieRecord.My_Rating__c > 5)) {
            throw new AuraHandledException('Rating must be between 1 and 5.');
        }
        if (movieRecord.Notes__c != null && movieRecord.Notes__c.length() > 500) {
            throw new AuraHandledException('Notes maximum limit is 500 characters.');
        }
        Integer count = [SELECT COUNT() FROM Favorite_Movie__c WHERE Movie_ID__c = :movieRecord.Movie_ID__c LIMIT 1];
        if (count > 0) {
            throw new AuraHandledException('This movie is already in your favorites.');
        }
        try {
            if (movieRecord.IMDb_Rating__c == null && String.isNotBlank(movieRecord.Movie_ID__c)) {
                MovieWrapper.MovieDetail details = MovieService.getMovieDetail(movieRecord.Movie_ID__c);
                if (details != null && String.isNotBlank(details.imdbRating) && details.imdbRating != 'N/A') {
                    movieRecord.IMDb_Rating__c = Decimal.valueOf(details.imdbRating);
                }
            }
            movieRecord.Favorite_Date__c = Date.today();
            movieRecord.Is_Favorite__c = true;
            if (Schema.sObjectType.Favorite_Movie__c.isCreateable()) {
                insert movieRecord;
            } else {
                throw new AuraHandledException('You do not have permission to insert favorite movies.');
            }
        } catch (Exception e) {
            throw new AuraHandledException('Save failed: ' + e.getMessage());
        }
    }

    @AuraEnabled(cacheable=false)
    public static FavoriteMoviePagedResult getFavoriteMovies(String searchKey, String sortBy, String sortDirection, Integer pageSize, Integer pageNumber) {
        Integer offset = (pageNumber - 1) * pageSize;
        String querySelect = 'SELECT Id, Movie_ID__c, Movie_Title__c, Release_Year__c, Poster_URL__c, Movie_Type__c, IMDb_Rating__c, My_Rating__c, Notes__c, Favorite_Date__c FROM Favorite_Movie__c ';
        String queryWhere = 'WHERE Is_Favorite__c = true ';

        if (String.isNotBlank(searchKey)) {
            String key = '%' + String.escapeSingleQuotes(searchKey) + '%';
            queryWhere += 'AND Movie_Title__c LIKE :key ';
        }

        String orderBy = 'ORDER BY ';
        String safeSortBy = 'Favorite_Date__c';
        String safeDirection = 'DESC';

        Set<String> allowedFields = new Set<String>{ 'movie_title__c', 'imdb_rating__c', 'release_year__c', 'my_rating__c', 'favorite_date__c' };
        if (String.isNotBlank(sortBy) && allowedFields.contains(sortBy.toLowerCase())) {
            safeSortBy = sortBy;
        }
        if (String.isNotBlank(sortDirection) && (sortDirection.toUpperCase() == 'ASC' || sortDirection.toUpperCase() == 'DESC')) {
            safeDirection = sortDirection.toUpperCase();
        }
        orderBy += safeSortBy + ' ' + safeDirection;

        String countQuery = 'SELECT COUNT() FROM Favorite_Movie__c ' + queryWhere;
        Integer totalRecords = Database.countQuery(countQuery);

        String finalQuery = querySelect + queryWhere + orderBy + ' LIMIT :pageSize OFFSET :offset';
        List<Favorite_Movie__c> records = Database.query(finalQuery);

        return new FavoriteMoviePagedResult(totalRecords, records);
    }

    @AuraEnabled
    public static void updateFavorites(List<Favorite_Movie__c> recordsToUpdate) {
        for (Favorite_Movie__c movie : recordsToUpdate) {
            if (movie.My_Rating__c != null && (movie.My_Rating__c < 1 || movie.My_Rating__c > 5)) {
                throw new AuraHandledException('Rating must be between 1 and 5.');
            }
            if (movie.Notes__c != null && movie.Notes__c.length() > 500) {
                throw new AuraHandledException('Notes maximum limit is 500 characters.');
            }
        }
        try {
            if (Schema.sObjectType.Favorite_Movie__c.isUpdateable()) {
                update recordsToUpdate;
            } else {
                throw new AuraHandledException('You do not have permission to update favorite movies.');
            }
        } catch (Exception e) {
            throw new AuraHandledException('Update failed: ' + e.getMessage());
        }
    }

    @AuraEnabled
    public static void deleteFavoriteMovie(Id recordId) {
        try {
            if (Schema.sObjectType.Favorite_Movie__c.isDeletable()) {
                Favorite_Movie__c record = [SELECT Id FROM Favorite_Movie__c WHERE Id = :recordId LIMIT 1];
                delete record;
            } else {
                throw new AuraHandledException('You do not have permission to delete favorite movies.');
            }
        } catch (Exception e) {
            throw new AuraHandledException('Delete failed: ' + e.getMessage());
        }
    }

    private static String fetchAndSaveRemotePoster(String imdbId, String imageUrl) {
        try {
            String titleSearchName = 'MoviePoster_' + imdbId;
            List<ContentVersion> existingFiles = [
                SELECT Id FROM ContentVersion 
                WHERE Title = :titleSearchName AND IsLatest = true LIMIT 1
            ];
            if (!existingFiles.isEmpty()) {
                return '/sfc/servlet.shepherd/version/download/' + existingFiles[0].Id;
            }

            Http http = new Http();
            HttpRequest request = new HttpRequest();
            request.setEndpoint(imageUrl.replace('http://', 'https://'));
            request.setMethod('GET');
            request.setTimeout(60000);
            
            HttpResponse response = http.send(request);
            if (response.getStatusCode() == 200) {
                Blob imageBlob = response.getBodyAsBlob();
                ContentVersion cv = new ContentVersion();
                cv.Title = titleSearchName;
                cv.PathOnClient = imdbId + '.jpg';
                cv.VersionData = imageBlob;
                cv.IsMajorVersion = true;
                
                if (Schema.sObjectType.ContentVersion.isCreateable()) {
                    insert cv;
                    ContentVersion insertedCv = [SELECT Id FROM ContentVersion WHERE Id = :cv.Id LIMIT 1];
                    return '/sfc/servlet.shepherd/version/download/' + insertedCv.Id;
                }
            }
        } catch (Exception e) {
            System.debug('Salesforce internal poster processing failed: ' + e.getMessage());
        }
        return 'https://placehold.co';
    }

    public class FavoriteMoviePagedResult {
        @AuraEnabled public Integer totalRecords { get; set; }
        @AuraEnabled public List<Favorite_Movie__c> records { get; set; }
        public FavoriteMoviePagedResult(Integer totalRecords, List<Favorite_Movie__c> records) {
            this.totalRecords = totalRecords;
            this.records = records;
        }
    }
}
