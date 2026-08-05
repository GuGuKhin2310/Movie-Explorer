// MovieService.cls
public with sharing class MovieService {
    private static final String API_KEY = '43a0ea87';
    private static final String BASE_URL = 'https://omdbapi.com';

    public static MovieWrapper.SearchResult searchMovies(String searchTerm, Integer pageNumber) {
        if (String.isBlank(searchTerm)) {
            throw new AuraHandledException('Search term cannot be empty.');
        }
        String url = BASE_URL + '?apikey=' + API_KEY + '&s=' + EncodingUtil.urlEncode(searchTerm, 'UTF-8') + '&page=' + pageNumber;
        return (MovieWrapper.SearchResult) sendGetRequest(url, MovieWrapper.SearchResult.class);
    }

    public static MovieWrapper.MovieDetail getMovieDetail(String imdbId) {
        if (String.isBlank(imdbId)) {
            throw new AuraHandledException('Invalid Movie ID.');
        }
        String url = BASE_URL + '?apikey=' + API_KEY + '&i=' + imdbId + '&plot=full';
        return (MovieWrapper.MovieDetail) sendGetRequest(url, MovieWrapper.MovieDetail.class);
    }

    private static Object sendGetRequest(String url, Type targetType) {
        Http http = new Http();
        HttpRequest request = new HttpRequest();
        request.setEndpoint(url);
        request.setMethod('GET');
        try {
            HttpResponse response = http.send(request);
            if (response.getStatusCode() == 200) {
                return JSON.deserialize(response.getBody(), targetType);
            } else {
                throw new AuraHandledException('OMDb API Error Status: ' + response.getStatusCode());
            }
        } catch (Exception e) {
            throw new AuraHandledException('API Connection Error: ' + e.getMessage());
        }
    }
}
