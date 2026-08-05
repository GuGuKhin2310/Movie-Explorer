public with sharing class OpportunityAnalyticsController {

    @AuraEnabled(cacheable=true)
    public static Map<String, Object> getDashboardData(String stage, String ownerName, Integer closeYear) {
        Map<String, Object> result = new Map<String, Object>();

        // Build Dynamic WHERE Clause
        List<String> conditions = new List<String>();
        if (String.isNotBlank(stage)) {
            conditions.add('StageName = :stage');
        }
        if (String.isNotBlank(ownerName)) {
            String formattedOwner = '%' + ownerName + '%';
            conditions.add('Owner.Name LIKE :formattedOwner');
        }
        if (closeYear != null) {
            conditions.add('CALENDAR_YEAR(CloseDate) = :closeYear');
        }

        String whereClause = conditions.isEmpty() ? '' : ' WHERE ' + String.join(conditions, ' AND ');

        // 1. KPI Aggregates
        String kpiQuery = 'SELECT COUNT(Id) totalCount, SUM(Amount) totalPipeline, AVG(Amount) avgAmount FROM Opportunity' + whereClause;
        AggregateResult kpiRes = ((List<AggregateResult>) Database.query(kpiQuery))[0];

        // Closed Won Specific KPI
        List<String> wonConditions = new List<String>(conditions);
        wonConditions.add('StageName = \'Closed Won\'');
        String wonWhereClause = ' WHERE ' + String.join(wonConditions, ' AND ');

        AggregateResult wonRes = ((List<AggregateResult>) Database.query('SELECT SUM(Amount) wonAmount FROM Opportunity' + wonWhereClause))[0];

        result.put('totalOps', kpiRes.get('totalCount'));
        result.put('totalPipeline', kpiRes.get('totalPipeline') != null ? kpiRes.get('totalPipeline') : 0);
        result.put('avgAmount', kpiRes.get('avgAmount') != null ? kpiRes.get('avgAmount') : 0);
        result.put('wonAmount', wonRes.get('wonAmount') != null ? wonRes.get('wonAmount') : 0);

        // 2. Pipeline by Stage
        String stageQuery = 'SELECT StageName label, SUM(Amount) value FROM Opportunity' + whereClause + ' GROUP BY StageName';
        result.put('pipelineByStage', Database.query(stageQuery));

        // 3. Lead Source Distribution
        String leadSourceQuery = 'SELECT LeadSource label, COUNT(Id) value FROM Opportunity' + whereClause + ' GROUP BY LeadSource';
        result.put('leadSourceData', Database.query(leadSourceQuery));

        // 4. Monthly Closed Won Revenue
        String monthlyQuery = 'SELECT CALENDAR_MONTH(CloseDate) monthNum, SUM(Amount) value FROM Opportunity' + wonWhereClause + ' GROUP BY CALENDAR_MONTH(CloseDate) ORDER BY CALENDAR_MONTH(CloseDate)';
        result.put('monthlyRevenue', Database.query(monthlyQuery));

        // 5. Top 10 Owners
        String ownerQuery = 'SELECT Owner.Name label, SUM(Amount) value FROM Opportunity' + whereClause + ' GROUP BY Owner.Name ORDER BY SUM(Amount) DESC LIMIT 10';
        result.put('topOwners', Database.query(ownerQuery));

        return result;
    }

    @AuraEnabled(cacheable=true)
    public static List<Opportunity> getOpportunityList(String stage, String ownerName, Integer closeYear) {
        String query = 'SELECT Id, Name, Account.Name, StageName, Amount, CloseDate, Owner.Name FROM Opportunity';
        List<String> conditions = new List<String>();

        if (String.isNotBlank(stage)) conditions.add('StageName = :stage');
        if (String.isNotBlank(ownerName)) {
            String formattedOwner = '%' + ownerName + '%';
            conditions.add('Owner.Name LIKE :formattedOwner');
        }
        if (closeYear != null) conditions.add('CALENDAR_YEAR(CloseDate) = :closeYear');

        if (!conditions.isEmpty()) {
            query += ' WHERE ' + String.join(conditions, ' AND ');
        }
        query += ' ORDER BY CloseDate DESC LIMIT 200';

        return Database.query(query);
    }
}