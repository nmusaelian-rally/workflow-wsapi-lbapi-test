//localhost:1337/App-debug.html?apiKey=_37kqhjoDRf6fnZ6T1IiYXrrjcpVbTk7Llx2r7omTMQ&project=/project/23112780161
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    projectOid:23112780161,
    tagOid:21580021389,
    tagRef: '/tag/21580021389',
    numberOfMonths: 5,
    intervals:[],
    tagAndCreationFilters:[],
    store:null,
    createdAndTagged:[],
    launch: function() {
        this.getDates();
        this.createInitialFilters();
        this.makeWsapiStore();
    },
    getDates:function(){
        var now = new Date();
        var firstDayOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        //console.log('firstDayOfThisMonth',firstDayOfThisMonth); 
        Date.prototype.calcFullMonths = function(monthOffset) {
            var d = new Date(firstDayOfThisMonth); 
            d.setMonth(d.getMonth() - monthOffset);
            return d;
        };
        var howFarBack = (new Date()).calcFullMonths(this.numberOfMonths);
        
        //Rally.util.DateTime.format(prevSaturday, 'Y-m-d')
        for(var m=1; m <= this.numberOfMonths; m++){
            var firstDayOfNextMonth = new Date(howFarBack.getFullYear(), howFarBack.getMonth() + 1, 1);
            //this.intervals.push({
            //    'from'  :   howFarBack.toISOString(),
            //    'to'    :   firstDayOfNextMonth.toISOString()
            //});
            this.intervals.push({
                'from'  :   Rally.util.DateTime.format(howFarBack, 'Y-m-d'),
                'to'    :   Rally.util.DateTime.format(firstDayOfNextMonth, 'Y-m-d'),
            });
            howFarBack = firstDayOfNextMonth;
        }
        //console.log('intervals', this.intervals);
    },
    createInitialFilters:function(){
        var tagFilter = Ext.create('Rally.data.wsapi.Filter', {
             property : 'Tags',
             operator: 'contains',
             value: this.tagRef
        });
        
        _.each(this.intervals, function(interval){
            var creationDateFilter = Rally.data.wsapi.Filter.and([
                {
                    property : 'CreationDate',
                    operator : '>=',
                    value : interval.from
                },
                {
                    property : 'CreationDate',
                    operator : '<',
                    value : interval.to
                }
            ]);
            this.tagAndCreationFilters.push(tagFilter.and(creationDateFilter));
        },this);
        
        //_.each(this.tagAndCreationFilters, function(filter){
        //    console.log(filter.toString());
        //});
    },
    makeWsapiStore:function(){
        this.store = Ext.create('Rally.data.wsapi.Store',{
            model: 'Defect',
            //fetch: ['ObjectID','FormattedID','ScheduledState','State','CreationDate','ClosedDate','InProgressDate','AcceptedDate','Prject'],
            limit: Infinity
        });
        for (i=0; i < this.intervals.length; i++) {
            this.createdAndTagged.push([]);
        }
        this.applyFiltersToStore(0);
    },
    
    applyFiltersToStore:function(i){
        console.log('applyFiltersToStore', this.tagAndCreationFilters[i].toString());
        this.store.addFilter(this.tagAndCreationFilters[i]);
        this.store.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    console.log('records.length',records.length);
                    if (i<this.intervals.length) { 
                        _.each(records, function(record){
                            this.createdAndTagged[[i]].push(record.get('_ref'));
                        },this);
                    }
                    this.store.clearFilter(records.length);
                    if (i < this.tagAndCreationFilters.length-1) { //if not done, call itself
                        this.applyFiltersToStore(i + 1);
                    }
                    else{
                        this.onDefectsLoaded();
                    }
                }
                else{
                    console.log('error');
                }
            }
        });
    },
    onDefectsLoaded:function(){
        console.log('onDefectsLoaded');
        _.each(this.createdAndTagged, function(defectsPerInterval){
            console.log('........',defectsPerInterval.length);
            _.each(defectsPerInterval, function(defect){
                console.log(defect);
            });
        });
        
        
    }
    
});
