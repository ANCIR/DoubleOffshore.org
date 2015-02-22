var app = angular
    .module("doubleoffshore", ["localytics.directives", "ui.bootstrap"]);

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

var Entity = function(name, slug, type) {
    this.name = name;
    this.slug = slug;
    this.type = type;
};

app.factory("model", ['$q', function($q) {

    var activeNetwork = $q.defer();

    /* Load data */

    d3.json('/data/' + DoubleOffshore.slug + '.json', function(error, data) {

        var mapByType = {
            rflag: {},
            cflag: {},
            company: {},
            rig: {}
        };
        var relations = [];

        var entities = data.entities.map(function(obj) {
            var ent = $.extend(new Entity(), obj);
            if (mapByType[obj.type])
                mapByType[obj.type][ent.slug] = ent;
            return ent;
        });

        var rigRelations = [
            ['flag', 'is flag of', true, mapByType.rflag],
            ['owner', 'is owned by', false, mapByType.company],
            ['manager', 'is managed by', false, mapByType.company],
            ['operator', 'is operated by', false, mapByType.company],
        ];

        function resolveRelation(arr) {
            var attrName = arr[0];
            var relationType = arr[1];
            var relationDir = arr[2];
            var objects = arr[3];
            var slug = this[attrName];
            if (!slug)
                return;
            var relatedEntity = objects[slug];
            relatedEntity._visited = true;
            this[attrName] = relatedEntity;
            var relation;
            if (relationDir)
                relation = new Relation(relatedEntity, this, relationType);
            else
                relation = new Relation(this, relatedEntity, relationType);
            relations.push(relation);
        }

        for (var slug in mapByType.rig) {
            var rig = mapByType.rig[slug];
            rig._visited = true;
            rigRelations.forEach(resolveRelation, rig);
        }

        for (slug in mapByType.company) {
            var company = mapByType.company[slug];
            if (!company._visited) continue;
            resolveRelation.call(
                company,
                ['raw_flag', 'is based in', false, mapByType.cflag]
            );
        }

        // remove entities that are not connected to
        // a rig entity, either directly or indirectly
        entities = entities.filter(function(ent) {
            if (ent._visited) {
                delete ent._visited;
                return true;
            }
            if (mapByType[ent.type])
                delete mapByType[ent.type][ent.slug];
            return false;
        });

        var model = {
            'entities': entities,
            'relations': relations
        };
        [['rigs', 'rig'],
         ['rflags', 'rflag'],
         ['cflags', 'cflag'],
         ['companies', 'company']].forEach(function(arr) {
            model[arr[0]] = Object
                .keys(mapByType[arr[1]])
                .map(function(k) {return mapByType[arr[1]][k];});
        });
        activeNetwork.resolve(model);

    });

    return activeNetwork.promise;

}]);

app.controller("PopupController", ['$scope', '$modalInstance', '$timeout', 'data',
    function($scope, $modalInstance, $timeout, data) {

    $scope.d = data;
}]);


app.controller("SankeyController", ['model', '$compile', '$scope', '$modal',
    function($model, $compile, $scope, $modal) {

    /* Get data */

    $scope.flagData = {};

    d3.csv('/static/data/countries.csv', function(error, data) {
        data.forEach(function(row){
            $scope.flagData[row['Flag country'].trim()] = row;
        });
    });

    $model.then(function(network) {
        updateSankey(network);
    });

    /* Set up sankey */

    var heightSK = 900;
    var marginSK = {top: 30, right: 1, bottom: 6, left: 1};
    var svgSK = d3.select("#sankey-container")
        .append("svg")
        .attr("width", "100%")
        .attr("height", heightSK + marginSK.top + marginSK.bottom + 40)
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

        // relations.forEach(function(rel) {
        //     console.log(rel.m.type);
        //     if (rel.m.type === 'is owned by') {
        //         console.log(rel.target, rel.source);
        //     }
        // });

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

        var mainG = svgSK.append("g")
            .attr("transform", function(d) {return "translate(0,40)";});

        var relation = mainG.append("g")
            .attr("class", "relations")
            .selectAll(".relation")
            .data(relations)
            .enter()
            .append("g")
            .attr("class", function(d) {return "relation " + d.m.type.replace(/ /g, "");})
            .sort(function(a, b) {return b.dy - a.dy;});

        relation.append("path")
            .attr("d", pathGeneratorSK)
            .style("stroke-width", function(d) {return Math.max(1, d.dy);});

        relation.filter(".isbasedin")
            .filter(function(d) {return d.m.source.raw_ultimate_owner;})
            .append("text")
            .attr("class", "owner")
            .attr("x", function(d) {return d.source.x + d.source.dx + 6;})
            .attr("y", function(d) {return d.source.y + d.sy + d.dy / 2;})
            .attr("text-anchor", "start")
            .text(function(d) {return 'via ' + d.m.source.raw_ultimate_owner;});

        relation.append("title")
            .text(function(d) {return d.source.m.name + " → " + d.target.m.name;});

        var entity = mainG.append("g")
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
            .on("click", function(d) { 
                $modal.open({
                  templateUrl: 'popup.html',
                  controller: 'PopupController',
                  size: 'lg',
                  resolve: {
                    data: function () {
                      return d.m;
                    }
                  }
                });
            })
            .append("title")
            .text(function(d) {return d.m.name;});

        entity.append("text")
            .attr("x", -6)
            .attr("y", function(d) {return d.dy / 2;})
            .attr("dy", ".4em")
            .attr("text-anchor", "end")
            .attr("transform", null)
            .text(function(d) {return d.m.name;})
            .filter(function(d) {return d.x < widthSK / 2;})
            .attr("x", 6 + sankey.nodeWidth())
            .attr("text-anchor", "start");

        var columnsX = [];
        entities.forEach(function(e) {
            var x = parseInt(e.x, 10);
            if (columnsX.indexOf(x) == -1) {
                columnsX.push(x);
            }
        });
        columnsX = columnsX.sort(function(a, b) { return a - b; });
        svgSK.append('text')
            .attr('x', columnsX[0])
            .attr('y', 0)
            .attr('class', 'heading')
            .attr("text-anchor", "start")
            .text('Offshore Registrations');

        svgSK.append('text')
            .attr('x', columnsX[1])
            .attr('y', 0)
            .attr('class', 'heading')
            .attr("text-anchor", "start")
            .text('Drilling Rigs');

        svgSK.append('text')
            .attr('x', columnsX[2] + 15)
            .attr('y', 0)
            .attr('class', 'heading')
            .attr("text-anchor", "end")
            .text('Companies');

        svgSK.append('text')
            .attr('x', columnsX[3] + 15)
            .attr('y', 0)
            .attr('class', 'heading')
            .attr("text-anchor", "end")
            .text('Head Office');

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
                        rigs[d.m.source.slug] = d.source;
                    }
                });
                relation.each(function(d) {
                    if (d.m.target.type === 'rig' && rigs[d.m.target.slug])
                        setSelected(this, d);
                });
            }
            else if (ent.m.type === "rflag") {
                relation.each(function(d) {
                    if (d.source === ent) {
                        rigs[d.m.target.slug] = d.target;
                        setSelected(this, d);
                    }
                });
                relation.each(function(d) {
                    if (d.m.source.type === 'rig' && rigs[d.m.source.slug]) {
                        companies[d.m.target.slug] = d.target;
                        setSelected(this, d);
                    }
                });
                relation.each(function(d) {
                    if (d.m.source.type === 'company' && companies[d.m.source.slug])
                        setSelected(this, d);
                });
            }
            // ent.type === "cflag"
            else {
                relation.each(function(d) {
                    if (d.target === ent) {
                        companies[d.m.source.slug] = d.source;
                        setSelected(this, d);
                    }
                });
                relation.each(function(d) {
                    if (d.m.target.type === 'company' && companies[d.m.target.slug]) {
                        rigs[d.m.source.slug] = d.source;
                        setSelected(this, d);
                    }
                });
                relation.each(function(d) {
                    if (d.m.target.type === "rig" && rigs[d.m.target.slug])
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
    $scope.selectedFlags = null;
    $scope.selectedManagers = null;
    $scope.selectedOperators = null;
    $scope.selectedOwners = null;
    // GROUPING VALUES
    $scope.groupByOptions = {
        'flag': 'raw_flag',
        'drilling depth': 'raw_drillingdepth',
        'water depth': 'raw_ratedwaterdepth',
        'owner': 'raw_owner',
        'operator': 'raw_operator',
        'manager': 'raw_manager'
    };
    $scope.groupByField = null;

    /* Network canvas setup */

    var $network = $("#network-container")[0];
    var svgGraph = createSVG($network, $network, [318, 238], 0.4);
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

    var svgMap = createSVG($("#map-container")[0], $network, [-137, 2], 1.15);
    var sizeMap = svgMap[1];
    svgMap = svgMap[0];
    var projection = d3.geo.mercator()
        .scale((sizeMap[0] + 1) / 2 / Math.PI)
        .translate([sizeMap[0] / 2, sizeMap[1] / 2])
        .precision(0.1);

    /* Get data */

    d3.json("/static/maps/world-topo-min.json", function(error, data) {
        var path = d3.geo.path()
            .projection(projection);
        var countries = topojson.feature(data, data.objects.countries).features;
        svgMap.selectAll(".country")
            .data(countries)
            .enter()
            .insert("path")
            .attr("class", "country")
            .attr("d", path);

        $scope.update();
        
    });

    d3.json("/static/maps/country_centroids.json", function(error, data){
        // swap coordinates around to be [longitude, latitude]
        for (var loc in data) {
            var coords = data[loc];
            data[loc] = [coords[1], coords[0]];
        }
        country_centroids = data;
    });


    $scope.update = function() {
        $model.then(function(network) {
            updateNetworkAndMap(network);
        });
    };

    function updateNetworkAndMap(network) {

        if (rigs.size() === 0) {
            rigs.add(network.rigs);
            var groups = [
                rigsByFlag.group(),
                rigsByManager.group(),
                rigsByOperator.group(),
                rigsByOwner.group()
            ];
            var makeOptions = function(obj) {return obj.key;};
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
        function oneOf(selected) {
            if (!selected || selected.length === 0)
                return function(val) {return true;};
            return function(val) {return $.inArray(val, selected) > -1;};
        }

        // apply all filters
        [
            [rigsByFlag, oneOf($scope.selectedFlags)],
            [rigsByManager, oneOf($scope.selectedManagers)],
            [rigsByOperator, oneOf($scope.selectedOperators)],
            [rigsByOwner, oneOf($scope.selectedOwners)]
        ].forEach(function(arr){
            arr[0].filterAll();
            arr[0].filterFunction(arr[1]);
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
                if (!company)
                    return;
                if (!entityMap[company.slug]) {
                    var target = createDrawnObject(company);
                    company._drawnObject = target;
                    target.setSize(50, 50);
                    entities.push(target);
                    entityMap[company.slug] = target;
                }
            });
        });
        var relations = network.relations
            .filter(function(rel) {
                return (entityMap[rel.source.raw_id] &&
                        entityMap[rel.target.slug]);
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
            if (obj.m.type !== 'rig' || !obj.m[dimension])
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
            .attr("xlink:href", "/static/img/map_marker.svg")
            .attr("width", 12)
            .attr("height", 12)
            .attr("x", function (d) {return d.x1 - 6;})
            .attr("y", function (d) {return d.y1 - 10;});
        marker2
            .data(connections)
            .enter()
            .append("image")
            .attr("class", "marker2")
            .attr("xlink:href", "/static/img/map_marker.svg")
            .attr("width", 12)
            .attr("height", 12)
            .attr("x", function (d) {return d.x2 - 6;})
            .attr("y", function (d) {return d.y2 - 10;});
    }

    function createSVG(el, sizeEl, startTranslation, startScale) {
        var width = $(sizeEl).width();
        var height = Math.round(width / 3.0 * 2.0);
        var currentScale = startScale ? startScale : 0.5;
        // set up zoom
        var zoom = d3.behavior.zoom()
            .scaleExtent([Math.min(startScale, 0.5), Math.max(startScale, 5)]);

        var svg = d3.select(el).append('svg')
                .attr("height", height)
                .attr("width", width)
                .attr("pointer-events", "all")
            .append("g")
                .call(zoom);

        var handleEvents = zoom.on("zoom", function() {
            svg.transition().attr("transform",
                "translate(" + d3.event.translate + ") scale(" + d3.event.scale + ")");
        });

        var zoomhandle = svg.append("rect")
            .attr("class", "background")
            .attr("width", width * 5)
            .attr("height", height * 5)
            .attr("transform", "translate(" + (width * -2) + "," + (height * -2) + ")");
        
        zoom
            .translate(startTranslation ? startTranslation : [width / 3, height / 3])
            .scale(currentScale)
            .event(svg);

        var boundedScale = function(change) {
            currentScale = Math.max(Math.min(currentScale + change, 5), 0.5);
            zoom
                .scale(currentScale)
                .event(svg);
        };

        var $el = $(el);
        $el.find('.zoomIn').click(function() {
            boundedScale(0.4);
        });
        $el.find('.zoomOut').click(function() {
            boundedScale(-0.4);
        });

        return [svg, [width, height]];
    }

}]);
