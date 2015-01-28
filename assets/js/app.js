(function(){
    var app = angular
        .module("doubleoffshore", ["multi-select"])
        .config(function($interpolateProvider) {
            $interpolateProvider.startSymbol('{[').endSymbol(']}');
        });

    function slugify(s) {
        // good enough for our small dataset
        return s.replace(/[^A-Za-z0-9-]+/g, '-');
    }

    function createDrawnObject(model) {
        return {
            m: model,
            width: 60,
            height: 60,
            setSize: function(w, h) {this.width = w; this.height = h;},
            getLabel: function() {return this.m.name;},
            resetCoordinates: function() {this.x = 0.0; this.y = 0.0;},
        };
    }

    var Relation = function(source, target, type) {
        this.source = source;
        this.target = target;
        this.type = type;
    };

    var Entity = function(name, type) {
        this.name = name;
        this.type = type;
        this.slug = slugify(name);
    };

    app.directive("flagPopup", function() {
        return {
            restrict: "E",
            replace: true,
            templateUrl: SITE_CONFIG.baseurl + "/flag.html",
            scope: {
                data: "=data",
            },
        };
    });


    app.factory("model", ['$location', '$q', function($location, $q) {

        var allEntities = [];
        // DATA to be filtered
        var rigs = crossfilter();
        // DIMENSIONS
        var rigsByLocation = rigs.dimension(function(d) {return d.raw_country;});
        // ACTIVE ENTITIES
        var activeLocation = $location.search()['country'];
        if (activeLocation === undefined)
            activeLocation = 'Nigeria';
        var activeNetwork = $q.defer();
        // DATA SOURCES
        var companyData = $q.defer();
        var rigData = $q.defer();

        /* Load data */

        d3.csv(SITE_CONFIG.baseurl + '/data/companies.csv', function(error, data) {
            var dat = {};
            data.forEach(function(row){dat[row['Company'].trim()] = row;});
            companyData.resolve(dat);
        });

        d3.json(SITE_CONFIG.baseurl + "/data/rigs.json", function(error, data) {
            rigData.resolve(data);
        });

        /* Process data */

        $q.all([rigData.promise, companyData.promise]).then(function(values) {

            var data = values[0];
            var extra = values[1];
            var uniqueCompanies = {};
            var uniqueRigFlags = {};
            var uniqueLocations = {};
            var uniqueCompanyFlags = {};

            function clean(data) {
                for (var key in data)
                    if (data[key] && typeof data[key] === "string")
                        data[key] = data[key].trim();
            }

            function processCompanyFlag(company) {
                if (!extra[company.name])
                    return;
                var flagName = (extra[company.name]['Based'] ||
                                extra[company.name]['Ultimate Owner Jurisdiction']);
                if (!flagName)
                    return;
                // add the company flag
                var flag;
                if (!uniqueCompanyFlags[flagName]) {
                    flag = new Entity(flagName, "cflag");
                    uniqueCompanyFlags[flagName] = flag;
                    allEntities.push(flag);
                }
                else
                    flag = uniqueCompanyFlags[flagName];
                company.flag = flag;
            }

            function processCompanies(obj) {
                if (!obj.name)
                    return;
                var company;
                // add the company
                if (!uniqueCompanies[obj.name]) {
                    company = new Entity(obj.name, "company");
                    uniqueCompanies[obj.name] = company;
                    allEntities.push(company);
                    processCompanyFlag(company);
                }
                else
                    company = uniqueCompanies[obj.name];
                // add the related company directly to the rig entity
                obj.rig[obj.type] = company;
            }

            for (var i = 0; i < data.length; i++) {
                var entDat = data[i];
                // trim some strings
                clean(entDat);
                // add the rig
                var rig = new Entity(entDat.name, "rig");
                allEntities.push(rig);
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
                    if (!uniqueRigFlags[entDat.flag]) {
                        flag = new Entity(entDat.flag, "rflag");
                        uniqueRigFlags[entDat.flag] = flag;
                        allEntities.push(flag);
                    }
                    else
                        flag = uniqueRigFlags[entDat.flag];
                    rig.flag = flag;
                }
                // add the location
                if (entDat.country) {
                    var location;
                    if (!uniqueLocations[entDat.country]) {
                        location = new Entity(entDat.country, "location");
                        uniqueLocations[entDat.country] = location;
                        allEntities.push(location);
                    }
                    else
                        location = uniqueLocations[entDat.country];
                    rig.location = location;
                }
            }

            rigs.add(allEntities.filter(function(o) {return o.type === "rig";}));
            selectActiveEntities(activeLocation);

        });

        function selectActiveEntities(country) {

            rigsByLocation.filterAll();
            var activeRigs = rigsByLocation.filterExact(country).top(Infinity);
            var relations = [];
            var entities = [];
            var rflags = {};
            var cflags = {};
            var companies = {};

            var entityAttrs = [
                ['flag', 'is flag of', true, rflags],
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
                if (!added[ent.name]) {
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

            activeRigs.forEach(function(obj) {
                entities.push(obj);
                entityAttrs.forEach(addEntityAndRelation, obj);
            });

            for (var key in companies) {
                var company = companies[key];
                var flag = company.flag;
                if (!flag)
                    continue;
                if (!cflags[flag.name]) {
                    cflags[flag.name] = company.flag;
                    entities.push(flag);
                }
                relations.push(new Relation(company, flag, "is based in"));
            }

            activeNetwork.resolve({
                'rigs': activeRigs,
                'rflags': Object.keys(rflags).map(function(k) {return rflags[k];}),
                'cflags': Object.keys(cflags).map(function(k) {return cflags[k];}),
                'companies': Object.keys(companies).map(function(k) {return companies[k];}),
                'entities': entities,
                'relations': relations
            });

        }

        return {
            'activeNetwork': activeNetwork.promise,
            'activeLocation': activeLocation,
        };

    }]);


    app.controller("SankeyController", ['model', '$compile', '$scope', function($model, $compile, $scope) {

        /* Get data */

        $scope.activeLocation = $model.activeLocation;
        $scope.flagData = {};

        d3.csv(SITE_CONFIG.baseurl + '/data/countries.csv', function(error, data) {
            data.forEach(function(row){
                $scope.flagData[row['Flag country'].trim()] = row;
            });
        });

        $model.activeNetwork.then(function(network) {
            updateSankey(network);
        });

        /* Set up sankey */

        var heightSK = 900;
        var marginSK = {top: 6, right: 1, bottom: 6, left: 1};
        var svgSK = d3.select("#sankey-container")
            .append("svg")
            .attr("width", "100%")
            .attr("height", heightSK + marginSK.top + marginSK.bottom)
            .append("g")
            .attr("transform", "translate(" + marginSK.left + "," + marginSK.top + ")");
        // don't want to hardcode the width
        var widthSK = $("#sankey-container > svg").width() - marginSK.left - marginSK.right;
        var sankey = d3.sankey()
            .nodeWidth(15)
            .nodePadding(10)
            .size([widthSK, heightSK]);
        var pathGeneratorSK = sankey.link();
        var colorSK = d3.scale.category20();

        function updateSankey(network) {
            /*
            Add dud flag and company relations for rigs and companies
            that don't have those. This is to get flag, rig and company
            entities aligned.
            */
            var entities = network.entities.map(function(ent) {
                var obj = createDrawnObject(ent);
                ent._drawnObject = obj;
                return obj;
            });
            var relations = network.relations.map(function(rel) {
                var obj = createDrawnObject(rel);
                obj.source = rel.source._drawnObject;
                obj.target = rel.target._drawnObject;
                obj.value = 1.0;
                return obj;
            });
            network.rigs.forEach(function(obj) {
                var dudEntity;
                var dudRelation;
                if (!obj.flag) {
                    dudEntity = createDrawnObject("dud");
                    entities.push(dudEntity);
                    dudRelation = createDrawnObject("dud");
                    dudRelation.source = dudEntity;
                    dudRelation.target = obj._drawnObject;
                    dudRelation.value = 1.0;
                    relations.push(dudRelation);
                }
                if (!obj.owner && !obj.manager && !obj.operator) {
                    dudEntity = createDrawnObject("dud");
                    entities.push(dudEntity);
                    dudRelation = createDrawnObject("dud");
                    dudRelation.source = obj._drawnObject;
                    dudRelation.target = dudEntity;
                    dudRelation.value = 1.0;
                    relations.push(dudRelation);
                }
            });
            network.companies.forEach(function(obj) {
                if (obj.flag)
                    return;
                var dudEntity = createDrawnObject("dud");
                entities.push(dudEntity);
                var dudRelation = createDrawnObject("dud");
                dudRelation.source = obj._drawnObject;
                dudRelation.target = dudEntity;
                dudRelation.value = 1.0;
                relations.push(dudRelation);
            });

            sankey
                .nodes(entities)
                .links(relations)
                .layout(32);

            // remove duds after doing layout
            function isNotDud(obj) {return obj.m !== "dud";}
            entities = entities.filter(isNotDud);
            relations = relations.filter(isNotDud);

            svgSK.selectAll("*").remove();

            var relation = svgSK.append("g")
                .attr("class", "relations")
                .selectAll(".relation")
                .data(relations)
                .enter()
                .append("path")
                .attr("class", function(d) {return "relation " + d.m.type.replace(/ /g, "");})
                .attr("d", pathGeneratorSK)
                .style("stroke-width", function(d) {return Math.max(1, d.dy);})
                .sort(function(a, b) {return b.dy - a.dy;});

            relation.append("title")
                .text(function(d) {return d.source.m.name + " → " + d.target.m.name;});

            var entity = svgSK.append("g")
                .attr("class", "entities")
                .selectAll(".entity")
                .data(entities)
                .enter()
                .append("g")
                .attr("class", function(d) {return "entity " + d.m.type.replace(/ /g, "");})
                .attr("transform", function(d) {return "translate(" + d.x + "," + d.y + ")";});

            entity.append("rect")
                .attr("height", function(d) {return d.dy;})
                .attr("width", sankey.nodeWidth())
                .on("mouseover", mouseover)
                .on("mouseout", mouseout)
                .append("title")
                .text(function(d) {return d.m.name;});

            entity.selectAll('.cflag > rect, .rflag > rect')
                .each(function(d) {
                    $(this).popover({
                        title: d.m.name,
                        content: function() {
                            return $compile('<flag-popup data="flagData[\'' + d.m.name + '\']"></flag-popup>')($scope);
                        },
                        html: true,
                        container: $("body")
                    });
                });

            entity.append("text")
                .attr("x", -6)
                .attr("y", function(d) {return d.dy / 2;})
                .attr("dy", ".35em")
                .attr("text-anchor", "end")
                .attr("transform", null)
                .text(function(d) {return d.m.name;})
                .filter(function(d) {return d.x < widthSK / 2;})
                .attr("x", 6 + sankey.nodeWidth())
                .attr("text-anchor", "start");

            function setSelected(el, d) {
                d3.select(el)
                    .attr("class", "selected relation " + d.m.type.replace(/ /g, ""));
            }

            function mouseover(ent) {
                d3.select(this.parentNode)
                    .attr("class", "selected entity " + ent.m.type.replace(/ /g, ""));

                var rigs = {};
                var companies = {};

                if (ent.m.type === "rig") {
                    relation.each(function(d) {
                        if (d.source === ent || d.target === ent)
                            setSelected(this, d);
                        else if (d.m.type === 'is based in' &&
                                 (d.m.source === ent.m.owner ||
                                  d.m.source === ent.m.manager ||
                                  d.m.source === ent.m.operator))
                            setSelected(this, d);
                    });
                }
                else if (ent.m.type === "company") {
                    relation.each(function(d) {
                        if (d.source === ent)
                            setSelected(this, d);
                        else if (d.target === ent) {
                            setSelected(this, d);
                            rigs[d.m.source.name] = d.source;
                        }
                    });
                    relation.each(function(d) {
                        if (d.m.target.type === 'rig' && rigs[d.m.target.name])
                            setSelected(this, d);
                    });
                }
                else if (ent.m.type === "rflag") {
                    relation.each(function(d) {
                        if (d.source === ent) {
                            rigs[d.m.target.name] = d.target;
                            setSelected(this, d);
                        }
                    });
                    relation.each(function(d) {
                        if (d.m.source.type === 'rig' && rigs[d.m.source.name]) {
                            companies[d.m.target.name] = d.target;
                            setSelected(this, d);
                        }
                    });
                    relation.each(function(d) {
                        if (d.m.source.type === 'company' && companies[d.m.source.name])
                            setSelected(this, d);
                    });
                }
                // ent.type === "cflag"
                else {
                    relation.each(function(d) {
                        if (d.target === ent) {
                            companies[d.m.source.name] = d.source;
                            setSelected(this, d);
                        }
                    });
                    relation.each(function(d) {
                        if (d.m.target.type === 'company' && companies[d.m.target.name]) {
                            rigs[d.m.source.name] = d.source;
                            setSelected(this, d);
                        }
                    });
                    relation.each(function(d) {
                        if (d.m.target.type === "rig" && rigs[d.m.target.name])
                            setSelected(this, d);
                    });
                }
            }

            function mouseout(ent) {
                d3.select(this.parentNode)
                    .attr("class", "entity " + ent.m.type.replace(/ /g, ""));

                svgSK
                    .selectAll('.relation.selected')
                    .attr("class", function(d) {return "relation " + d.m.type.replace(/ /g, "");});
            }

        }

    }]);


    app.controller("NetworkController", ['model', '$scope', function($model, $scope) {

        var country_centroids;
        // DATA to be filtered/grouped
        var rigs = crossfilter();
        // DIMENSIONS
        var rigsByFlag = rigs.dimension(function(d) {return d.raw_flag;});
        var rigsByManager = rigs.dimension(function(d) {return d.raw_manager;});
        var rigsByOperator = rigs.dimension(function(d) {return d.raw_operator;});
        var rigsByOwner = rigs.dimension(function(d) {return d.raw_owner;});
        // FILTER VALUES
        $scope.flagValues = [];
        $scope.managerValues = [];
        $scope.operatorValues = [];
        $scope.ownerValues = [];
        // GROUPING VALUES
        $scope.groupByOptions = {
            'flag': 'raw_flag',
            'drilling depth': 'raw_drilling_depth',
            'water depth': 'raw_rated_water_depth',
            'owner': 'raw_owner',
            'operator': 'raw_operator',
            'manager': 'raw_manager'
        };
        $scope.groupByField = null;

        /* Network canvas setup */

        var svgGraph = createSVG($("#network-container")[0], [318, 238], 0.28);
        var sizeGraph = svgGraph[1];
        svgGraph = svgGraph[0];
        var nodePadding = 8;

        var _cola = cola.d3adaptor()
            .linkDistance(120)
            .avoidOverlaps(true)
            .size(sizeGraph);

        _cola.on("tick", function() {
            svgGraph.selectAll(".relation")
                .attr("x1", function (d) {return d.source.x;})
                .attr("y1", function (d) {return d.source.y;})
                .attr("x2", function (d) {return d.target.x;})
                .attr("y2", function (d) {return d.target.y;});

            svgGraph.selectAll(".entity")
                .attr("x", function (d) {return d.x - d.width / 2 + nodePadding;})
                .attr("y", function (d) {return d.y - d.height / 2 + nodePadding;});

            svgGraph.selectAll(".label")
                .attr("x", function (d) {return d.x - d.width / 2 + nodePadding;})
                 .attr("y", function (d) {return d.y + d.height / 2 - nodePadding + this.getBBox().height;});

            svgGraph.selectAll(".group")
                .attr("x", function (d) {return d.bounds.x;})
                .attr("y", function (d) {return d.bounds.y;})
                .attr("width", function (d) {return d.bounds.width();})
                .attr("height", function (d) {return d.bounds.height();});
        });

        /* Map setup */

        var svgMap = createSVG($("#map-container")[0], [-137, 2], 1.15);
        var sizeMap = svgMap[1];
        svgMap = svgMap[0];
        var projection = d3.geo.mercator()
            .scale((sizeMap[0] + 1) / 2 / Math.PI)
            .translate([sizeMap[0] / 2, sizeMap[1] / 2])
            .precision(0.1);

        /* Get data */

        d3.json(SITE_CONFIG.baseurl + "/data/world-topo-min.json", function(error, data) {
            var path = d3.geo.path()
                .projection(projection);
            var countries = topojson.feature(data, data.objects.countries).features;
            svgMap.selectAll(".country")
                .data(countries)
                .enter()
                .insert("path")
                .attr("class", "country")
                .attr("d", path);
        });

        d3.json(SITE_CONFIG.baseurl + "/data/country_centroids.json", function(error, data){
            // swap coordinates around to be [longitude, latitude]
            for (var loc in data) {
                var coords = data[loc];
                data[loc] = [coords[1], coords[0]];
            }
            country_centroids = data;
        });

        this.update = function() {
            $model.activeNetwork.then(function(network) {
                updateNetworkAndMap(network);
            });
        };
        this.update();

        function updateNetworkAndMap(network) {

            if (rigs.size() === 0) {
                rigs.add(network.rigs);
                var groups = [
                    rigsByFlag.group(),
                    rigsByManager.group(),
                    rigsByOperator.group(),
                    rigsByOwner.group()
                ];
                var makeOptions = function(obj) {return {name: obj.key, ticked: false};};
                $scope.flagValues = groups[0].all().map(makeOptions);
                $scope.managerValues = groups[1].all().map(makeOptions);
                $scope.operatorValues = groups[2].all().map(makeOptions);
                $scope.ownerValues = groups[3].all().map(makeOptions);
                groups.forEach(function(obj){obj.dispose();});

                $scope.$watch('groupByField', function(newV, oldV) {groupBy(newV);});
            }

            createViews(network);

        }

        /* Functions to manipulate relations and entities */

        function applyActiveFilters() {
            function getSelectedValues(values) {
                var selected = {};
                values
                    .filter(function(obj) {return obj.ticked;})
                    .forEach(function(obj) {selected[obj.name] = true;});
                return selected;
            }

            function oneOf(selected) {
                return function(val) {return selected[val];};
            }

            // apply all filters
            [
                [rigsByFlag, $scope.flagValues],
                [rigsByManager, $scope.managerValues],
                [rigsByOperator, $scope.operatorValues],
                [rigsByOwner, $scope.ownerValues]
            ].forEach(function(arr){
                arr[0].filterAll();
                var selected = getSelectedValues(arr[1]);
                if (!($.isEmptyObject(selected)))
                    arr[0].filterFunction(oneOf(selected));
            });
        }

        function createNetwork(network) {
            clearNetwork();

            applyActiveFilters();
            var entities = [];
            var entityMap = {};
            rigsByFlag.top(Infinity).forEach(function(rig) {
                var source = createDrawnObject(rig);
                rig._drawnObject = source;
                entityMap[rig.raw_id] = rig;
                entities.push(source);
                var companies = [
                    rig.owner,
                    rig.manager,
                    rig.operator
                ];
                companies.forEach(function(company) {
                    if (company === undefined)
                        return;
                    if (!entityMap[company.name]) {
                        var target = createDrawnObject(company);
                        company._drawnObject = target;
                        target.setSize(50, 50);
                        entities.push(target);
                        entityMap[company.name] = target;
                    }
                });
            });
            var relations = network.relations
                .filter(function(rel) {
                    return (entityMap[rel.source.raw_id] &&
                            entityMap[rel.target.name]);
                })
                .map(function(rel) {
                    var obj = createDrawnObject(rel);
                    obj.source = rel.source._drawnObject;
                    obj.target = rel.target._drawnObject;
                    return obj;
                });

            _cola
                .nodes(entities)
                .links(relations);
            renderRelations(relations, svgGraph, _cola);
            renderEntities(entities, svgGraph, _cola, nodePadding);
        }

        function clearNetwork() {
            svgGraph.selectAll('.relation').remove();
            svgGraph.selectAll('.entity').remove();
            svgGraph.selectAll('.label').remove();
            svgGraph.selectAll('.group').remove();
            $scope.groupByField = null;
            _cola
                .nodes([])
                .links([])
                .groups([])
                .constraints([]);
        }

        function createMapConnections() {
            clearMapConnections();

            var connections = {};
            _cola.nodes().forEach(function(obj) {
                if (!obj.m.raw_country || !obj.m.raw_flag)
                    return;
                if (!connections[obj.m.raw_country])
                    connections[obj.m.raw_country] = {};
                if (!connections[obj.m.raw_country][obj.m.raw_flag])
                    connections[obj.m.raw_country][obj.m.raw_flag] = 0;
                connections[obj.m.raw_country][obj.m.raw_flag]++;
            });

            var flattened = [];
            for (var loc in connections) {
                for (var flag in connections[loc]) {
                    var coords1 = projection(country_centroids[loc]);
                    var coords2 = projection(country_centroids[flag]);
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
        }

        function clearMapConnections() {
            svgMap.selectAll('.connection').remove();
            svgMap.selectAll('.marker1').remove();
            svgMap.selectAll('.marker2').remove();
        }

        function createViews(network) {
            createNetwork(network);
            createMapConnections();
        }

        function groupBy(dimension) {
            svgGraph.selectAll('.group').remove();
            if (!dimension) {
                _cola
                    .groups([])
                    .start(30, 30, 30);
                return;
            }

            var values = {};
            _cola.nodes().forEach(function(obj, i) {
                if (!obj.m[dimension])
                    return;
                if (!values[obj.m[dimension]])
                    values[obj.m[dimension]] = [];
                values[obj.m[dimension]].push(i);
                obj.resetCoordinates();
            });
            var groups = [];
            for (var value in values)
                groups.push({leaves: values[value]});

            _cola.groups(groups);
            renderGroups(groups, svgGraph, _cola);
        }

        function renderEntities(entities, svg, _cola, padding) {
            var entity = svg.selectAll(".entity");
            var label = svg.selectAll(".label");
            if (!padding)
                padding = 0;
            entity
                .data(entities)
                .enter()
                .append("rect")
                .attr("class", function (d) {return "entity " + d.m.type;})
                .attr("width", function (d) {return d.width - 2 * padding;})
                .attr("height", function (d) {return d.height - 2 * padding;})
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
                .attr("class", function (d) {return "relation " + d.m.type.replace(/ /g, "");});
            _cola.start();
        }

        function renderGroups(groups, svg, _cola) {
            var group = svg.selectAll(".group");
            group
                .data(groups)
                .enter()
                .insert("rect", ".relation")
                .attr("rx", 5).attr("ry", 5)
                .attr("class", "group");
            _cola.start(30, 30, 30);
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
                .attr("xlink:href", SITE_CONFIG.baseurl + "/assets/img/map_marker.svg")
                .attr("width", 12)
                .attr("height", 12)
                .attr("x", function (d) {return d.x1 - 6;})
                .attr("y", function (d) {return d.y1 - 10;});
            marker2
                .data(connections)
                .enter()
                .append("image")
                .attr("class", "marker2")
                .attr("xlink:href", SITE_CONFIG.baseurl + "/assets/img/map_marker.svg")
                .attr("width", 12)
                .attr("height", 12)
                .attr("x", function (d) {return d.x2 - 6;})
                .attr("y", function (d) {return d.y2 - 10;});
        }

        function createSVG(el, startTranslation, startScale) {
            var width = $(el).width();
            var height = Math.round(width / 3.0 * 2.0);

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

    }]);

})();