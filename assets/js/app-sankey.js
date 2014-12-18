(function(){
    var app = angular
        .module("doubleoffshore", [])
        .config(function($interpolateProvider) {
            $interpolateProvider.startSymbol('{[').endSymbol(']}');
        });

    function slugify(s) {
        // good enough for our small dataset
        return s.replace(/[^A-Za-z0-9-]+/g, '-');
    }

    var Relation = function(source, target, type) {
        this.source = source;
        this.target = target;
        this.type = type;
        this.value = 1.0;
    };

    var Entity = function(name, type) {
        this.name = name;
        this.type = type;
        this.slug = slugify(name);

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
        $scope.activeLocation = null;
        $scope.activeRigs = [];

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

            data = self.selectAllActiveEntities();
            self.updateSankey(data.entities, data.relations);

        });

        this.selectAllActiveEntities = function(country) {
            function getQueryParams() {
                if (!window.location.search)
                    return {};
                qs = window.location.search
                    .slice(1)
                    .split('&');
                var params = {};
                qs.forEach(function(s) {
                    var keyVal = s.split('=', 2)
                        .map(decodeURIComponent);
                    if (keyVal.length == 2)
                        params[keyVal[0]] = keyVal[1];
                    else if (keyVal.length == 1)
                        params[keyVal[0]] = true;
                });
                return params;
            }

            if (country === undefined) {
                var params = getQueryParams();
                country = params['country'] ? params['country'] : 'Nigeria';
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

            rigs.forEach(function(obj) {
                entities.push(obj);
                entityAttrs.forEach(addEntityAndRelation, obj);
            });

            $scope.activeRigs = rigs;
            $scope.activeLocation = rigs.length > 0 ? rigs[0].location : null;
            $scope.activeFlags = Object.keys(flags).map(function(k) {return flags[k];});
            $scope.activeCompanies = Object.keys(companies).map(function(k) {return companies[k];});
            $scope.$apply();

            return {
                'entities': entities,
                'relations': relations
            };

        };

        this.updateSankey = function(entities, relations) {
            /*
            Add dud flag and company relations for rigs that
            don't have those. This is to get flag, rig and company
            entities aligned.
            */
            entities = entities.slice(0);
            relations = relations.slice(0);
            $scope.activeRigs.forEach(function(obj) {
                var dudEntity;
                if (!obj.flag) {
                    dudEntity = new Entity("", "dud");
                    entities.push(dudEntity);
                    relations.push(new Relation(dudEntity, obj, "dud"));
                }
                if (!obj.owner && !obj.manager && !obj.operator) {
                    dudEntity = new Entity("", "dud");
                    entities.push(dudEntity);
                    relations.push(new Relation(obj, dudEntity));
                }
            });

            sankey
                .nodes(entities)
                .links(relations)
                .layout(32);

            // remove duds after doing layout
            function isNotDud(obj) {return obj.type !== "dud";}
            entities = entities.filter(isNotDud);
            relations = relations.filter(isNotDud);

            svgSK.selectAll("*").remove();

            var relation = svgSK.append("g")
                .attr("class", "relations")
                .selectAll(".relation")
                .data(relations)
                .enter()
                .append("path")
                .attr("class", function(d) {return "relation " + d.type.replace(/ /g, "");})
                .attr("d", pathGeneratorSK)
                .style("stroke-width", function(d) {return Math.max(1, d.dy);})
                .sort(function(a, b) {return b.dy - a.dy;});

            relation.append("title")
                .text(function(d) {return d.source.name + " → " + d.target.name;});

            var entity = svgSK.append("g")
                .attr("class", "entities")
                .selectAll(".entity")
                .data(entities)
                .enter()
                .append("g")
                .attr("class", function(d) {return "entity " + d.type.replace(/ /g, "");})
                .attr("transform", function(d) {return "translate(" + d.x + "," + d.y + ")";});

            entity.append("rect")
                .attr("height", function(d) {return d.dy;})
                .attr("width", sankey.nodeWidth())
                .on("mouseover", mouseover)
                .on("mouseout", mouseout)
                .append("title")
                .text(function(d) {return d.name;});

            entity.append("text")
                .attr("x", -6)
                .attr("y", function(d) {return d.dy / 2;})
                .attr("dy", ".35em")
                .attr("text-anchor", "end")
                .attr("transform", null)
                .text(function(d) {return d.name;})
                .filter(function(d) {return d.x < widthSK / 2;})
                .attr("x", 6 + sankey.nodeWidth())
                .attr("text-anchor", "start");

            function setSelected(el, d) {
                d3.select(el)
                    .attr("class", "selected relation " + d.type.replace(/ /g, ""));
            }

            function mouseover(ent) {
                if (ent.type === "rig") {
                    relation.each(function(d) {
                        if (d.source === ent || d.target === ent)
                            setSelected(this, d);
                    });
                }
                else {
                    var rigs = {};
                    if (ent.type === "flag") {
                        relation.each(function(d) {
                            if (d.source === ent) {
                                rigs[d.target.name] = d.target;
                                setSelected(this, d);
                            }
                        });
                        relation.each(function(d) {
                            if (rigs[d.source.name]) setSelected(this, d);
                        });
                    }
                    else {
                        relation.each(function(d) {
                            if (d.target === ent) {
                                rigs[d.source.name] = d.source;
                                setSelected(this, d);
                            }
                        });
                        relation.each(function(d) {
                            if (rigs[d.target.name]) setSelected(this, d);
                        });
                    }
                }
            }

            function mouseout(ent) {
                svgSK
                    .selectAll('.relation.selected')
                    .attr("class", function(d) {return "relation " + d.type.replace(/ /g, "");});
            }

        };

    }]);

})();