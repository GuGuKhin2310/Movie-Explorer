// MovieWrapper.cls
public with sharing class MovieWrapper {
    
    public class SearchResult {
        @AuraEnabled public List<MovieShort> Search { get; set; }
        @AuraEnabled public String totalResults { get; set; }
        @AuraEnabled public String Response { get; set; }
        @AuraEnabled public String Error { get; set; }
    }

    public class MovieShort {
        @AuraEnabled public String Title { get; set; }
        @AuraEnabled public String Year { get; set; }
        @AuraEnabled public String imdbID { get; set; }
        @AuraEnabled public String Type { get; set; }
        @AuraEnabled public String Poster { get; set; }
        @AuraEnabled public String imdbRating { get; set; }
        @AuraEnabled public String Genre { get; set; }
    }

    public class MovieDetail {
        @AuraEnabled public String Title { get; set; }
        @AuraEnabled public String Year { get; set; }
        @AuraEnabled public String Runtime { get; set; }
        @AuraEnabled public String Genre { get; set; }
        @AuraEnabled public String Director { get; set; }
        @AuraEnabled public String Actors { get; set; }
        @AuraEnabled public String Plot { get; set; }
        @AuraEnabled public String Language { get; set; }
        @AuraEnabled public String Country { get; set; }
        @AuraEnabled public String Awards { get; set; }
        @AuraEnabled public String Poster { get; set; }
        @AuraEnabled public String imdbRating { get; set; }
        @AuraEnabled public String imdbID { get; set; }
        @AuraEnabled public String Type { get; set; }
        @AuraEnabled public String Response { get; set; }
        @AuraEnabled public String Error { get; set; }
    }
}
