
Ext.define('CustomApp', {
    extend: 'Rally.app.App',
    componentCls: 'app',
    projectOid:23112780161,
    tagOid:21580021389,
    tagRef: '/tag/21580021389',
    numberOfMonths: 5,
    intervals:[],
    tagAndCreationFilters:[],
    initialStore:null,
    createdAndTagged:[],
    launch: function() {
        this.getDates();
        this.createInitialFilters();
        this.makeInitialStore();
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
        for(var m=1; m <= this.numberOfMonths; m++){
            var firstDayOfNextMonth = new Date(howFarBack.getFullYear(), howFarBack.getMonth() + 1, 1);
            this.intervals.push({
                'from'  :   Rally.util.DateTime.format(howFarBack, 'Y-m-d'),          //howFarBack.toISOString(),           //or Rally.util.DateTime.format(howFarBack, 'Y-m-d'),
                'to'    :   Rally.util.DateTime.format(firstDayOfNextMonth, 'Y-m-d') //firstDayOfNextMonth.toISOString()   //Rally.util.DateTime.format(firstDayOfNextMonth, 'Y-m-d'),
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
    makeInitialStore:function(){
        this.initialStore = Ext.create('Rally.data.wsapi.Store',{
            model: 'Defect',
            fetch: ['ObjectID','FormattedID','ScheduleState','State','CreationDate','OpenedDate','ClosedDate','InProgressDate','AcceptedDate'],
            limit: Infinity
        });
        for (i=0; i < this.intervals.length; i++) {
            this.createdAndTagged.push([]);
        }
        this.applyFiltersToStore(0);
    },
    
    applyFiltersToStore:function(i){
        console.log('applyFiltersToStore', this.tagAndCreationFilters[i].toString());
        this.initialStore.addFilter(this.tagAndCreationFilters[i]);
        this.initialStore.load({
            scope: this,
            callback: function(records, operation) {
                if(operation.wasSuccessful()) {
                    console.log('records.length',records.length);
                    if (i<this.intervals.length) { 
                        _.each(records, function(record){
                            this.createdAndTagged[[i]].push({
                                '_ref':record.get('_ref'),
                                'ObjectID':record.get('ObjectID'),
                                'FormattedID':record.get('FormattedID'),
                                'ScheduleState': record.get('ScheduleState'),
                                'State': record.get('State'),
                                'CreationDate': Rally.util.DateTime.format(record.get('CreationDate'), 'Y-m-d'),
                                'OpenedDate': Rally.util.DateTime.format(record.get('OpenedDate'), 'Y-m-d'),
                                'ClosedDate': Rally.util.DateTime.format(record.get('ClosedDate'), 'Y-m-d'),
                                'InProgressDate': Rally.util.DateTime.format(record.get('InProgressDate'), 'Y-m-d'),
                                'AcceptedDate': Rally.util.DateTime.format(record.get('AcceptedDate'), 'Y-m-d')
                                
                            });
                        },this);
                    }
                    this.initialStore.clearFilter(records.length);
                    if (i < this.tagAndCreationFilters.length-1) { //if not done, call itself
                        this.applyFiltersToStore(i + 1);
                    }
                    else{
                        this.onInitialStoreLoaded();
                    }
                }
                else{
                    console.log('oh,noes!');
                }
            }
        });
    },
    onInitialStoreLoaded:function(){
        _.each(this.createdAndTagged, function(defectsPerInterval){
            console.log('........',defectsPerInterval.length);
            //_.each(defectsPerInterval, function(defect){
            //    console.log(defect);
            //});
            //this.getDataForInterval();
        },this);
        
        this.getDataForInterval(this.createdAndTagged[0]);
    },
    getDataForInterval:function(defectsPerInterval){
        var fromCreatedToOpen = [],
            fromOpenToProgress = [],
            fromSubmittedToProgress = []; //skipped Open State
            fromProgressToAccepted = [],
            
            minFromCreatedToOpen = 0,
            maxFromCreatedToOpen = 0,
            meanFromCreatedToOpen = 0,
            
            minFromSubmittedToProgress = 0,
            maxFromSubmittedToProgress = 0,
            meanFromSubmittedToProgress = 0,
            
            minFromOpenToProgress = 0,
            maxFromOpenToProgress = 0,
            meanFromOpenToProgress = 0,
            
            minFromProgressToAccepted = 0,
            maxFromProgressToAccepted = 0,
            meanFromProgressToAccepted = 0,
            
            notMovedFromCreatedToOpen = 0,
            notMovedFromOpenToProgress = 0,
            notMovedFromProgressToAccepted = 0,
            
            defectsWithoutStateChange = [];
            defectsSkippedOpen = [];
            defectsClosedinIdea = [];
        
        
        
        _.each(defectsPerInterval, function(defect){
            if (defect.OpenedDate !== '') {
                //console.log(defect.FormattedID);
                fromCreatedToOpen.push(Rally.util.DateTime.getDifference(Rally.util.DateTime.fromIsoString(defect.OpenedDate), Rally.util.DateTime.fromIsoString(defect.CreationDate), 'day'));
            }
            else{
                if (defect.ScheduleState === 'Idea' && defect.State === 'Submitted') {
                    defectsWithoutStateChange.push(defect);
                }
                else if (defect.ScheduleState === 'Idea' && defect.State === 'Closed') {
                    defectsClosedinIdea.push(defect);
                }
                else{
                    defectsSkippedOpen.push(defect);
                }
            }
            
            if (defect.InProgressDate !== '') {
                //console.log(defect.FormattedID);
                if (defect.OpenedDate !== '') {
                    fromOpenToProgress.push(Rally.util.DateTime.getDifference(Rally.util.DateTime.fromIsoString(defect.InProgressDate), Rally.util.DateTime.fromIsoString(defect.OpenedDate), 'day'));
                }
                else{
                    fromSubmittedToProgress.push(Rally.util.DateTime.getDifference(Rally.util.DateTime.fromIsoString(defect.InProgressDate), Rally.util.DateTime.fromIsoString(defect.CreationDate), 'day'));
                }
                
            }
            
            if (defect.AcceptedDate !== '') {
                //console.log(defect.FormattedID);
                //if (defect.OpenedDate !== '') {
                    fromProgressToAccepted.push(Rally.util.DateTime.getDifference(Rally.util.DateTime.fromIsoString(defect.AcceptedDate), Rally.util.DateTime.fromIsoString(defect.InProgressDate), 'day'));
                //}
                //else{
                    //fromSubmittedToProgress.push(Rally.util.DateTime.getDifference(Rally.util.DateTime.fromIsoString(defect.InProgressDate), Rally.util.DateTime.fromIsoString(defect.CreationDate), 'day'));
                //}
                
            }
        });
        
        console.log('fromCreatedToOpen', fromCreatedToOpen);
        console.log('defectsWithoutStateChange', defectsWithoutStateChange.length, defectsWithoutStateChange);
        console.log('defectsClosedinIdea', defectsClosedinIdea.length, defectsClosedinIdea);
        console.log('defectsSkippedOpen, captured in later transitions', defectsSkippedOpen.length, defectsSkippedOpen);
       
        var total = 0;
        _.each(fromCreatedToOpen, function(n){
            total += n;
        });
        meanFromCreatedToOpen = total/fromCreatedToOpen.length;
        maxFromCreatedToOpen = Math.max.apply(Math, fromCreatedToOpen);
        minFromCreatedToOpen = Math.min.apply(Math, fromCreatedToOpen);
        console.log('total', total, 'mean', meanFromCreatedToOpen, 'min', minFromCreatedToOpen, 'max', maxFromCreatedToOpen);
        
        console.log('fromOpenToProgress', fromOpenToProgress);
        var total2 = 0;
        _.each(fromOpenToProgress, function(n){
            total2 += n;
        });
        meanFromOpenToProgress = total2/fromOpenToProgress.length;
        maxFromOpenToProgress = Math.max.apply(Math, fromOpenToProgress);
        minFromOpenToProgress = Math.min.apply(Math, fromOpenToProgress);
        console.log('total2', total2, 'mean', meanFromOpenToProgress, 'min', minFromOpenToProgress, 'max', maxFromOpenToProgress);
        
        console.log('fromSubmittedToProgress', fromSubmittedToProgress);
        var total3 = 0;
        _.each(fromSubmittedToProgress, function(n){
            total3 += n;
        });
        meanFromSubmittedToProgress = total3/fromSubmittedToProgress.length;
        maxFromSubmittedToProgress = Math.max.apply(Math, fromSubmittedToProgress);
        minFromSubmittedToProgress = Math.min.apply(Math, fromSubmittedToProgress);
        console.log('total2', total2, 'mean', meanFromSubmittedToProgress, 'min', minFromSubmittedToProgress, 'max', maxFromSubmittedToProgress);
        
        console.log('fromProgressToAccepted', fromProgressToAccepted);
        var total3 = 0;
        _.each(fromSubmittedToProgress, function(n){
            total3 += n;
        });
        meanFromProgressToAccepted = total3/fromProgressToAccepted.length;
        maxFromProgressToAccepted = Math.max.apply(Math, fromProgressToAccepted);
        minFromProgressToAccepted = Math.min.apply(Math, fromProgressToAccepted);
        console.log('total2', total2, 'mean', meanFromProgressToAccepted, 'min', minFromProgressToAccepted, 'max', maxFromProgressToAccepted);
        
    }
});
