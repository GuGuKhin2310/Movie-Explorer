import { LightningElement, wire, track } from 'lwc';
import { loadScript } from 'lightning/platformResourceLoader';
import D3 from '@salesforce/resourceUrl/d3js';
import getDashboardData from '@salesforce/apex/OpportunityAnalyticsController.getDashboardData';
import getOpportunityList from '@salesforce/apex/OpportunityAnalyticsController.getOpportunityList';

const COLUMNS = [
    { label: 'Opportunity Name', fieldName: 'Name', type: 'text', sortable: true },
    { label: 'Account Name', fieldName: 'AccountName', type: 'text', sortable: true },
    { label: 'Stage', fieldName: 'StageName', type: 'text', sortable: true },
    { label: 'Amount', fieldName: 'Amount', type: 'currency', sortable: true },
    { label: 'Close Date', fieldName: 'CloseDate', type: 'date', sortable: true },
    { label: 'Owner', fieldName: 'OwnerName', type: 'text', sortable: true }
];

export default class SalesAnalyticsDashboard extends LightningElement {
    d3Initialized = false;

    // Filter values
    @track selectedStage = '';
    @track selectedOwner = '';
    @track selectedYear = null;

    // KPI Values
    totalOps = 0;
    totalPipeline = 0;
    wonAmount = 0;
    avgAmount = 0;

    // Raw Chart Data
    pipelineByStageData = [];
    leadSourceData = [];
    monthlyRevenueData = [];
    topOwnersData = [];

    // Datatable & Pagination Properties
    @track allOpportunityData = [];
    @track displayedOpportunityData = [];
    columns = COLUMNS;
    sortBy = 'CloseDate';
    sortDirection = 'desc';

    // Pagination Settings (10 records per page)
    pageSize = 10;
    pageNumber = 1;

    // Dropdown options
    stageOptions = [
        { label: 'All Stages', value: '' },
        { label: 'Prospecting', value: 'Prospecting' },
        { label: 'Qualification', value: 'Qualification' },
        { label: 'Needs Analysis', value: 'Needs Analysis' },
        { label: 'Proposal', value: 'Proposal' },
        { label: 'Negotiation', value: 'Negotiation' },
        { label: 'Closed Won', value: 'Closed Won' },
        { label: 'Closed Lost', value: 'Closed Lost' }
    ];

    yearOptions = [
        { label: 'All Years', value: null },
        { label: '2026', value: 2026 },
        { label: '2025', value: 2025 },
        { label: '2024', value: 2024 }
    ];

    // Wire Dashboard Data
    @wire(getDashboardData, { stage: '$selectedStage', ownerName: '$selectedOwner', closeYear: '$selectedYear' })
    wiredDashboardData({ error, data }) {
        if (data) {
            this.totalOps = data.totalOps || 0;
            this.totalPipeline = data.totalPipeline || 0;
            this.wonAmount = data.wonAmount || 0;
            this.avgAmount = data.avgAmount || 0;

            this.pipelineByStageData = data.pipelineByStage || [];
            this.leadSourceData = data.leadSourceData || [];
            this.monthlyRevenueData = data.monthlyRevenue || [];
            this.topOwnersData = data.topOwners || [];

            if (this.d3Initialized) {
                this.renderAllCharts();
            }
        } else if (error) {
            console.error('Error fetching dashboard metrics:', error);
        }
    }

    // Wire Opportunity List Data
    @wire(getOpportunityList, { stage: '$selectedStage', ownerName: '$selectedOwner', closeYear: '$selectedYear' })
    wiredOpportunities({ error, data }) {
        if (data) {
            this.allOpportunityData = data.map(record => ({
                ...record,
                AccountName: record.Account ? record.Account.Name : '',
                OwnerName: record.Owner ? record.Owner.Name : ''
            }));
            // Reset to page 1 whenever filters change
            this.pageNumber = 1;
            this.updatePaginatedData();
        } else if (error) {
            console.error('Error fetching opportunity list:', error);
        }
    }

    renderedCallback() {
        if (this.d3Initialized) return;

        loadScript(this, D3)
            .then(() => {
                this.d3Initialized = true;
                this.renderAllCharts();
            })
            .catch(error => {
                console.error('Error loading D3 library:', error);
            });
    }

    // Pagination Getters
    get totalRecords() {
        return this.allOpportunityData.length;
    }

    get totalPages() {
        return Math.ceil(this.totalRecords / this.pageSize) || 1;
    }

    get isFirstPage() {
        return this.pageNumber <= 1;
    }

    get isLastPage() {
        return this.pageNumber >= this.totalPages;
    }

    // Slice 10 items per page
    updatePaginatedData() {
        const start = (this.pageNumber - 1) * this.pageSize;
        const end = this.pageNumber * this.pageSize;
        this.displayedOpportunityData = this.allOpportunityData.slice(start, end);
    }

    handlePreviousPage() {
        if (!this.isFirstPage) {
            this.pageNumber--;
            this.updatePaginatedData();
        }
    }

    handleNextPage() {
        if (!this.isLastPage) {
            this.pageNumber++;
            this.updatePaginatedData();
        }
    }

    // Formatted Currency Getters
    get formattedTotalPipeline() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(this.totalPipeline);
    }
    get formattedWonAmount() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(this.wonAmount);
    }
    get formattedAvgAmount() {
        return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(this.avgAmount);
    }

    // Handlers
    handleStageChange(event) {
        this.selectedStage = event.detail.value;
    }
    handleOwnerChange(event) {
        this.selectedOwner = event.detail.value;
    }
    handleYearChange(event) {
        this.selectedYear = event.detail.value ? parseInt(event.detail.value, 10) : null;
    }
    clearStageFilter() {
        this.selectedStage = '';
    }

    // Render Master
    renderAllCharts() {
        this.renderStageBarChart();
        this.renderLeadPieChart();
        this.renderRevenueLineChart();
        this.renderOwnerBarChart();
    }

    // 1. D3 Bar Chart: Pipeline by Stage (Interactive Drill-Down)
    renderStageBarChart() {
        const container = this.template.querySelector('.stage-bar-chart');
        if (!container) return;
        container.innerHTML = '';

        const margin = { top: 20, right: 20, bottom: 60, left: 60 };
        const width = container.clientWidth - margin.left - margin.right || 350;
        const height = 260 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(this.pipelineByStageData.map(d => d.label || 'Unknown'))
            .range([0, width])
            .padding(0.3);

        const y = d3.scaleLinear()
            .domain([0, d3.max(this.pipelineByStageData, d => d.value) || 100])
            .range([height, 0]);

        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .attr('transform', 'rotate(-25)')
            .style('text-anchor', 'end');

        svg.append('g').call(d3.axisLeft(y).ticks(5));

        svg.selectAll('.bar')
            .data(this.pipelineByStageData)
            .enter()
            .append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d.label || 'Unknown'))
            .attr('width', x.bandwidth())
            .attr('y', height)
            .attr('height', 0)
            .attr('fill', '#0070d2')
            .attr('cursor', 'pointer')
            .on('click', (event, d) => {
                this.selectedStage = d.label;
            })
            .transition()
            .duration(750)
            .attr('y', d => y(d.value))
            .attr('height', d => height - y(d.value));
    }

    // 2. D3 Pie Chart: Lead Source (With Distinct Colors & Legend)
    renderLeadPieChart() {
        const container = this.template.querySelector('.lead-pie-chart');
        if (!container) return;
        container.innerHTML = '';

        const totalWidth = container.clientWidth || 400;
        const totalHeight = 280;
        const chartWidth = totalWidth * 0.52; // Reserve right side for legend
        const radius = Math.min(chartWidth, totalHeight) / 2 - 20;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', totalWidth)
            .attr('height', totalHeight);

        // Expanded palette with distinct colors for each Lead Source
        const color = d3.scaleOrdinal()
            .domain(['Web', 'Phone Inquiry', 'Partner Referral', 'Purchased List', 'Other', 'Employee Referral', 'Public Relations'])
            .range(['#0070d2', '#04844b', '#ffb75d', '#dddbda', '#9050e9', '#00c6b7', '#e52d3b']);

        const pie = d3.pie()
            .value(d => d.value)
            .sort(null);

        const arc = d3.arc()
            .innerRadius(0)
            .outerRadius(radius);

        const pieGroup = svg.append('g')
            .attr('transform', `translate(${chartWidth / 2},${totalHeight / 2})`);

        const pieData = pie(this.leadSourceData);

        // Render Slices
        const arcs = pieGroup.selectAll('.arc')
            .data(pieData)
            .enter()
            .append('g')
            .attr('class', 'arc');

        arcs.append('path')
            .attr('d', arc)
            .attr('fill', d => color(d.data.label || 'Other'))
            .attr('stroke', '#ffffff')
            .style('stroke-width', '2px')
            .transition()
            .duration(750);

        // Slice Annotations (Display numeric counts inside slices)
        arcs.append('text')
            .attr('transform', d => `translate(${arc.centroid(d)})`)
            .attr('dy', '0.35em')
            .style('text-anchor', 'middle')
            .style('font-size', '11px')
            .style('font-weight', 'bold')
            .style('fill', '#ffffff')
            .text(d => d.data.value > 0 ? d.data.value : '');

        // --- LEGEND SECTION (Right Side) ---
        const legendX = chartWidth + 5;
        const legendGroup = svg.append('g')
            .attr('transform', `translate(${legendX}, 25)`);

        const legendItems = legendGroup.selectAll('.legend-item')
            .data(this.leadSourceData)
            .enter()
            .append('g')
            .attr('class', 'legend-item')
            .attr('transform', (d, i) => `translate(0, ${i * 22})`);

        // Color Squares
        legendItems.append('rect')
            .attr('width', 13)
            .attr('height', 13)
            .attr('rx', 3)
            .attr('fill', d => color(d.label || 'Other'));

        // Category Text Labels
        legendItems.append('text')
            .attr('x', 20)
            .attr('y', 11)
            .style('font-size', '12px')
            .style('fill', '#3e3e3c')
            .text(d => `${d.label || 'Unassigned'} (${d.value})`);
    }

    // 3. D3 Line Chart: Monthly Closed Won Revenue
    renderRevenueLineChart() {
        const container = this.template.querySelector('.revenue-line-chart');
        if (!container) return;
        container.innerHTML = '';

        const margin = { top: 20, right: 20, bottom: 40, left: 60 };
        const width = container.clientWidth - margin.left - margin.right || 350;
        const height = 260 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scalePoint()
            .domain(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'])
            .range([0, width]);

        const y = d3.scaleLinear()
            .domain([0, d3.max(this.monthlyRevenueData, d => d.value) || 100])
            .range([height, 0]);

        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x));

        svg.append('g').call(d3.axisLeft(y).ticks(5));

        const line = d3.line()
            .x(d => x(['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.monthNum - 1]))
            .y(d => y(d.value));

        svg.append('path')
            .datum(this.monthlyRevenueData)
            .attr('fill', 'none')
            .attr('stroke', '#4bca81')
            .attr('stroke-width', 3)
            .attr('d', line);
    }

    // 4. D3 Horizontal Bar Chart: Top 10 Owners
    renderOwnerBarChart() {
        const container = this.template.querySelector('.owner-bar-chart');
        if (!container) return;
        container.innerHTML = '';

        const margin = { top: 20, right: 20, bottom: 40, left: 100 };
        const width = container.clientWidth - margin.left - margin.right || 350;
        const height = 260 - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom)
            .append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const y = d3.scaleBand()
            .domain(this.topOwnersData.map(d => d.label || 'Unknown'))
            .range([0, height])
            .padding(0.2);

        const x = d3.scaleLinear()
            .domain([0, d3.max(this.topOwnersData, d => d.value) || 100])
            .range([0, width]);

        svg.append('g').call(d3.axisLeft(y));
        svg.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x).ticks(5));

        svg.selectAll('.bar')
            .data(this.topOwnersData)
            .enter()
            .append('rect')
            .attr('y', d => y(d.label || 'Unknown'))
            .attr('height', y.bandwidth())
            .attr('x', 0)
            .attr('width', d => x(d.value))
            .attr('fill', '#ffb75d');
    }

    // Datatable Sorting
    handleSort(event) {
        this.sortBy = event.detail.fieldName;
        this.sortDirection = event.detail.sortDirection;
        this.sortData(this.sortBy, this.sortDirection);
    }

    sortData(fieldname, direction) {
        let parseData = [...this.allOpportunityData];
        let keyValue = (a) => a[fieldname];
        let isReverse = direction === 'asc' ? 1 : -1;
        
        parseData.sort((x, y) => {
            x = keyValue(x) ? keyValue(x) : '';
            y = keyValue(y) ? keyValue(y) : '';
            return isReverse * ((x > y) - (y > x));
        });
        this.allOpportunityData = parseData;
        this.updatePaginatedData();
    }
}