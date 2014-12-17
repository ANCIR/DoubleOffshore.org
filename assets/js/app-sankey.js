(function(){
    var app = angular
        .module("doubleoffshore", [])
        .config(function($interpolateProvider) {
            $interpolateProvider.startSymbol('{[').endSymbol(']}');
        });

    var Relation = function(source, target, type) {
        this.source = source;
        this.target = target;
        this.type = type;
    };

    var Entity = function(name, type) {
        this.name = name;
        this.type = type;

        this.getLabel = function() {
            return this.name;
        };

        this.setSize = function(w, h) {
            this.width = w;
            this.height = h;
        };
        this.setSize(60, 60);
    };


    app.controller("SankeyController", ['$scope', function($scope) {

        this.entities = [];
        var self = this;
        // DATA to be filtered
        this.rigs = crossfilter();
        // DIMENSIONS
        this.rigsByLocation = this.rigs.dimension(function(d) {return d.raw_country;});
        // ACTIVE ENTITIES
        $scope.activeCompanies = [];
        $scope.activeFlags = [];
        $scope.activeLocations = [];
        $scope.activeRigs = [];

        /* Load data */

        d3.json(SITE_CONFIG.baseurl + "/data/rigs.json", function(error, data) {

            self.data = data;
            var uniqueCompanies = {};
            var uniqueFlags = {};
            var uniqueLocations = {};

            var clean = function(data) {
                for (var key in data)
                    if (data[key] && typeof data[key] === "string")
                        data[key] = data[key].trim();
            };

            var processCompanies = function(obj) {
                if (!obj.name)
                    return;
                var company;
                // add the company
                if (!uniqueCompanies[obj.name]) {
                    company = new Entity(obj.name, "company");
                    company.setSize(50, 50);
                    uniqueCompanies[obj.name] = company;
                    self.entities.push(company);
                }
                else
                    company = uniqueCompanies[obj.name];
                // add the related company directly to the rig entity
                obj.rig[obj.type] = company;
            };

            for (var i = 0; i < data.length; i++) {
                var entDat = data[i];
                // trim some strings
                clean(entDat);
                // add the rig
                var rig = new Entity(entDat.name, "rig");
                self.entities.push(rig);
                // add all attributes prefixed with 'raw_'
                for (var key in entDat)
                    rig['raw_' + key] = entDat[key];
                // add the controlling companies
                var companies = [
                    {name: entDat.owner, type: "owner", rig: rig},
                    {name: entDat.operator, type: "operator", rig: rig},
                    {name: entDat.manager, type: "manager", rig: rig}
                ];
                companies.forEach(processCompanies);
                // add the flag
                if (entDat.flag) {
                    var flag;
                    if (!uniqueFlags[entDat.flag]) {
                        flag = new Entity(entDat.flag, "flag");
                        uniqueFlags[entDat.flag] = flag;
                        self.entities.push(flag);
                    }
                    else
                        flag = uniqueFlags[entDat.flag];
                    rig.flag = flag;
                }
                // add the location
                if (entDat.country) {
                    var location;
                    if (!uniqueLocations[entDat.country]) {
                        location = new Entity(entDat.country, "location");
                        uniqueLocations[entDat.country] = location;
                        self.entities.push(location);
                    }
                    else
                        location = uniqueLocations[entDat.country];
                    rig.location = location;
                }
            }

            self.rigs.add(self.entities.filter(function(o) {return o.type === "rig";}));

            self.selectAllActiveEntities();

        });

        this.selectAllActiveEntities = function(country) {
            if (country === undefined) {
                country = window.location.hash ? window.location.hash : 'Nigeria';
            }

            this.rigsByLocation.filterAll();
            var rigs = this.rigsByLocation.filterExact(country).top(Infinity);
            var relations = [];
            var entities = [];
            var flags = {};
            var companies = {};

            var entityAttrs = [
                ['flag', 'is flag of', true, flags],
                ['owner', 'is owned by', false, companies],
                ['manager', 'is managed by', false, companies],
                ['operator', 'is operated by', false, companies],
            ];

            function addEntityAndRelation(arr) {
                var attrName = arr[0];
                var relationType = arr[1];
                var relationDir = arr[2];
                var added = arr[3];
                var ent = this[attrName];
                if (!ent)
                    return;
                if (!added[ent]) {
                    // add to active entities
                    added[ent.name] = ent;
                    entities.push(ent);
                }
                var relation;
                if (relationDir)
                    relation = new Relation(ent, this, relationType);
                else
                    relation = new Relation(this, ent, relationType);
                relations.push(relation);
            }

            rigs.forEach(function(obj) {
                entities.push(obj);
                entityAttrs.forEach(addEntityAndRelation, obj);
            });

            $scope.activeRigs = rigs;
            $scope.activeLocations = [rigs[0].location];
            $scope.activeFlags = Object.keys(flags).map(function(k) {return flags[k];});
            $scope.activeCompanies = Object.keys(companies).map(function(k) {return companies[k];});
            $scope.$apply();

            return {
                'entities': entities,
                'relations': relations
            };

        };

    }]);

})();