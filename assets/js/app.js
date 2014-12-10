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

        this.resetCoordinates = function() {
            this.x = 0.0;
            this.y = 0.0;
        };

        this.setSize = function(w, h) {
            this.width = w;
            this.height = h;
        };
        this.setSize(60, 60);
    };

    function renderEntities(entities, svg, _cola) {
        var entity = svg.selectAll(".entity");
        var label = svg.selectAll(".label");
        entity
            .data(entities)
            .enter()
            .append("rect")
            .attr("class", function (d) {return "entity entity-" + d.type;})
            .attr("width", function (d) {return d.width;})
            .attr("height", function (d) {return d.height;})
            .attr("rx", 5).attr("ry", 5)
            .call(_cola.drag);
        label
            .data(entities)
            .enter()
            .append("text")
            .attr("class", "label")
            .text(function (d) {return d.getLabel();})
            .call(_cola.drag);
        _cola.start(30, 30, 30);
    }

    function renderRelations(relations, svg, _cola) {
        var relation = svg.selectAll(".relation");
        relation
            .data(relations)
            .enter()
            .append("line")
            .attr("class", function (d) {return "relation relation-" + d.type;});
        _cola.start();
    }

    function renderMapConnections(connections, svg) {
        var connection = svg.selectAll(".connection");
        var marker1 = svg.selectAll(".marker1");
        var marker2 = svg.selectAll(".marker2");
        connection
            .data(connections)
            .enter()
            .append("line")
            .attr("class", "connection")
            .attr("x1", function (d) {return d.x1;})
            .attr("y1", function (d) {return d.y1;})
            .attr("x2", function (d) {return d.x2;})
            .attr("y2", function (d) {return d.y2;});
        marker1
            .data(connections)
            .enter()
            .append("image")
            .attr("class", "marker1")
            .attr("xlink:href","img/map_marker.svg")
            .attr("width", 12)
            .attr("height", 12)
            .attr("x", function (d) {return d.x1 - 6;})
            .attr("y", function (d) {return d.y1 - 10;});
        marker2
            .data(connections)
            .enter()
            .append("image")
            .attr("class", "marker2")
            .attr("xlink:href","img/map_marker.svg")
            .attr("width", 12)
            .attr("height", 12)
            .attr("x", function (d) {return d.x2 - 6;})
            .attr("y", function (d) {return d.y2 - 10;});
    }

    function createSVG(el, startTranslation, startScale) {
        var width = $(el).width();
        var height = 500;

        var svg = d3.select(el).append('svg')
            .attr("height", height)
            .attr("width", "100%")
            .attr("pointer-events", "all");

        // set up zoom
        var zoomer = d3.behavior.zoom();
        var zoomhandle = svg.append("rect")
            .attr("class", "background")
            .attr("width", "100%")
            .attr("height", "100%")
            .call(zoomer.on("zoom", function(){
                svg.attr("transform", "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
            }));
        svg = svg.append("g");
        zoomer
            .translate(startTranslation ? startTranslation : [width / 2, height / 2])
            .scale(startScale ? startScale : 0.3)
            .event(zoomhandle);

        return [svg, [width, height]];
    }


    app.controller("NetworkController", ['$scope', function($scope) {

        this.entities = [];
        this.relations = [];
        var self = this;
        // DATA to be filtered/grouped
        this.rigs = crossfilter();
        this.companies = crossfilter();
        // DIMENSIONS
        this.rigsByFlag = this.rigs.dimension(function(d) {return d.raw_flag;});
        this.rigsByLocation = this.rigs.dimension(function(d) {return d.raw_country;});
        this.rigsByManager = this.rigs.dimension(function(d) {return d.manager;});
        this.rigsByOperator = this.rigs.dimension(function(d) {return d.operator;});
        this.rigsByOwner = this.rigs.dimension(function(d) {return d.owner;});
        // FILTER VALUES
        $scope.flagValues = [];
        $scope.locationValues = [];
        $scope.managerValues = [];
        $scope.operatorValues = [];
        $scope.ownerValues = [];
        $scope.currentFlag = "";
        $scope.currentLocation = "";
        $scope.currentManager = "";
        $scope.currentOperator = "";
        $scope.currentOwner = "";
        $scope.companies = {};

        /* Network canvas setup */

        var svgGraph = createSVG($("#canvas")[0]);
        var sizeGraph = svgGraph[1];
        svgGraph = svgGraph[0];

        var _cola = cola.d3adaptor()
            .linkDistance(120)
            .avoidOverlaps(true)
            .size(sizeGraph);

        _cola.on("tick", function() {
            var entity = svgGraph.selectAll(".entity");
            var relation = svgGraph.selectAll(".relation");
            var label = svgGraph.selectAll(".label");

            relation.attr("x1", function (d) {return d.source.x;})
                .attr("y1", function (d) {return d.source.y;})
                .attr("x2", function (d) {return d.target.x;})
                .attr("y2", function (d) {return d.target.y;});

            entity.attr("x", function (d) {return d.x - d.width / 2;})
                .attr("y", function (d) {return d.y - d.height / 2;});

            label.attr("x", function (d) {return d.x;})
                 .attr("y", function (d) {
                     var h = this.getBBox().height;
                     return d.y + h/4;
                 });
        });

        /* Map setup */

        var svgMap = createSVG($("#map")[0], [-87, 0], 1.15);
        var sizeMap = svgMap[1];
        svgMap = svgMap[0];
        var projection = d3.geo.mercator()
            .scale((sizeMap[0] + 1) / 2 / Math.PI)
            .translate([sizeMap[0] / 2, sizeMap[1] / 2])
            .precision(0.1);

        /* Load data */

        d3.json("data/rigs.json", function(error, data) {

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
                    company.setSize(40, 40);
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
            $scope.flagValues = self.rigsByFlag.group().all();
            $scope.locationValues = self.rigsByLocation.group().all();
            $scope.managerValues = self.rigsByManager.group().all();
            $scope.operatorValues = self.rigsByOperator.group().all();
            $scope.ownerValues = self.rigsByOwner.group().all();
            $scope.$apply();

        });

        d3.json("data/world-50m.json", function(error, data) {
            var path = d3.geo.path()
                .projection(projection);

            svgMap.append("path")
                .datum(topojson.feature(data, data.objects.land))
                .attr("class", "land")
                .attr("d", path);

            svgMap.append("path")
                .datum(topojson.mesh(data, data.objects.countries,
                                     function(a, b) {return a !== b;}))
                .attr("class", "boundary")
                .attr("d", path);
        });

        d3.json("data/country_centroids.json", function(error, data){
            // swap coordinates around to be [longitude, latitude]
            for (var loc in data) {
                var coords = data[loc];
                data[loc] = [coords[1], coords[0]];
            }
            self.country_centroids = data;
        });

        /* Functions to manipulate relations and entities */

        this.lockEntities = function() {
            this.entities.forEach(function(obj) {obj.fixed = true;});
        };

        this.unlockEntities = function() {
            this.entities.forEach(function(obj) {obj.fixed = false;});
        };

        this.createNetwork = function() {
            this.clearNetwork();

            var filterByCompany;
            var filterByLocation;
            var filterByFlag;
            if ($scope.currentCompany) {
                filterByCompany = function(obj) {return obj.owner === $scope.currentCompany.entity.name;};
            }
            else
                filterByCompany = function(obj) {return true;};
            if ($scope.currentLocation) {
                filterByLocation = function(obj) {return $scope.currentLocation[obj.id] ? true : false;};
            }
            else
                filterByLocation = function(obj) {return true;};
            if ($scope.currentFlag) {
                filterByFlag = function(obj) {return $scope.currentFlag[obj.id] ? true : false;};
            }
            else
                filterByFlag = function(obj) {return true;};

            var entityMap = {};
            var entities = [];
            this.entities.forEach(function(obj) {
                if (obj.type === "rig" && filterByLocation(obj) &&
                    filterByCompany(obj) && filterByFlag(obj)) {
                    entities.push(obj);
                    obj.resetCoordinates();
                    entityMap[obj.id] = true;
                    var companies = [
                        $scope.companies[obj.owner],
                        $scope.companies[obj.manager],
                        $scope.companies[obj.operator]
                    ];
                    companies.forEach(function(comp) {
                        if (comp === undefined)
                            return;
                        if (!entityMap[comp.entity.name]) {
                            entityMap[comp.entity.name] = true;
                            comp.entity.resetCoordinates();
                            entities.push(comp.entity);
                        }
                    });
                }
            });
            var relations = this.relations.filter(function(obj) {
                return entityMap[obj.source.name] && entityMap[obj.target.id];
            });

            _cola
                .nodes(entities)
                .links(relations);
            renderRelations(relations, svgGraph, _cola);
            renderEntities(entities, svgGraph, _cola);
        };

        this.clearNetwork = function() {
            svgGraph.selectAll('.relation').remove();
            svgGraph.selectAll('.entity').remove();
            svgGraph.selectAll('.label').remove();
            _cola
                .nodes([])
                .links([])
                .groups([])
                .constraints([]);
        };

        this.createMapConnections = function() {
            this.clearMapConnections();

            var connections = {};
            _cola.nodes().forEach(function(obj) {
                if (!obj.location || !obj.flag)
                    return;
                if (!connections[obj.location])
                    connections[obj.location] = {};
                if (!connections[obj.location][obj.flag])
                    connections[obj.location][obj.flag] = 0;
                connections[obj.location][obj.flag]++;
            });

            var flattened = [];
            for (var loc in connections) {
                for (var flag in connections[loc]) {
                    var coords1 = projection(this.country_centroids[loc]);
                    var coords2 = projection(this.country_centroids[flag]);
                    flattened.push({
                        total: connections[loc][flag],
                        x1: coords1[0],
                        y1: coords1[1],
                        x2: coords2[0],
                        y2: coords2[1]
                    });
                }
            }

            renderMapConnections(flattened, svgMap);
        };

        this.clearMapConnections = function() {
            svgMap.selectAll('.connection').remove();
            svgMap.selectAll('.marker1').remove();
            svgMap.selectAll('.marker2').remove();
        };

        this.createViews = function() {
            this.createNetwork();
            this.createMapConnections();
        };

        this.groupByLocation = function() {
            var locations = {};
            _cola.nodes().forEach(function(obj, i) {
                if (!obj.location)
                    return;
                if (!locations[obj.location])
                    locations[obj.location] = [];
                locations[obj.location].push(i);
                obj.resetCoordinates();
            });
            var groups = [];
            for (var loc in locations)
                groups.push({leaves: locations[loc]});
            _cola
                .groups(groups)
                .start(30, 30, 30);
        };

        this.groupByFlags = function() {
            var flags = {};
            _cola.nodes().forEach(function(obj, i) {
                if (!obj.flag)
                    return;
                if (!flags[obj.flag])
                    flags[obj.flag] = [];
                flags[obj.flag].push(i);
                obj.resetCoordinates();
            });
            var groups = [];
            for (var loc in flags)
                groups.push({leaves: flags[loc]});
            _cola
                .groups(groups)
                .start(30, 30, 30);
        };

    }]);

})();
