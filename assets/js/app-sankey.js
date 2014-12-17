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
        this.relations = [];
        var self = this;
        // DATA to be filtered/grouped
        this.rigs = crossfilter();
        this.companies = crossfilter();

        /* Load data */

        d3.json(SITE_CONFIG.baseurl + "/data/rigs.json", function(error, data) {

            self.data = data;
            var uniqueCompanies = {};

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
                var relation = new Relation(company, obj.rig, obj.type);
                self.relations.push(relation);
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
            }

            self.rigs.add(self.entities.filter(function(obj) {return obj.type === "rig";}));
            self.companies.add(self.entities.filter(function(obj) {return obj.type === "company";}));
            $scope.$apply();

        });

    }]);

})();