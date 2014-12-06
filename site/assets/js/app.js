(function(){
    var app = angular.module("doubleoffshore", []);

    /*
    Query: show me all rigs [located|owned by|sailing under] X,
    divvied up by [flag|company|..]
    */

    var color = d3.scale.category20();

    Relation = function(source, target, type) {
        this.source = source;
        this.target = target;
        this.type = type;

        // rendering attributes
        this.width = 2;
        this.color = color(1);
    };

    Entity = function(name, type) {
        this.name = name;
        this.type = type;

        // rendering attributes
        this.fixed = false;
        this.width = 40;
        this.height = 40;
        this.color = color(2);

        this.getLabel = function() {
            return this.name;
        };
    };

    renderEntities = function(entities, svg, _cola) {
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
            .style("fill", function (d) {return d.color;})
            .call(_cola.drag);
        label
            .data(entities)
            .enter()
            .append("text")
            .attr("class", "label")
            .text(function (d) {return d.getLabel();})
            .call(_cola.drag);
        _cola.start();
    };

    renderRelations = function(relations, svg, _cola) {
        var relation = svg.selectAll(".relation");
        relation
            .data(relations)
            .enter()
            .append("line")
            .attr("class", function (d) {return "relation relation-" + d.type;})
            .attr("stroke-width", function (d) {return d.width;})
            .style("stroke", function (d) {return d.color;});
        _cola.start();
    };


    app.controller("NetworkController", function() {

        this.entities = [];
        this.relations = [];


        /* Canvas setup */

        var width = 1024;
        var height = 768;

        var svg = d3.select("#canvas").append('svg')
            .attr("height", height)
            .attr("width", width);

        var _cola = cola.d3adaptor()
            .linkDistance(120)
            .avoidOverlaps(true)
            .size([width, height]);

        _cola
            .nodes(this.entities)
            .links(this.relations);

        _cola.on("tick", function() {
            var entity = svg.selectAll(".entity");
            var relation = svg.selectAll(".relation");
            var label = svg.selectAll(".label");

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


        /* Load data */

        var entities = this.entities;
        var relations = this.relations;
        d3.json("http://localhost:4000/data/rigs.json", function(error, data) {
            var companyEntities = {};

            var processCompanies = function(obj) {
                if (!obj.name)
                    return;
                var company;
                if (!companyEntities[obj.name]) {
                    company = new Entity(obj.name, "company");
                    company.width = 60;
                    company.height = 60;
                    company.color = color(3);
                    companyEntities[obj.name] = company;
                    entities.push(company);
                }
                else
                    company = companyEntities[obj.name];
                var relation = new Relation(company, obj.rig, obj.type);
                relations.push(relation);
            };

            for (var i = 0; i < data.length; i++) {
                var entDat = data[i];
                // add the rig
                if (entDat.owner !== "Seadrill Ltd")
                    continue;
                var rig = new Entity(entDat.name, "rig");
                entities.push(rig);
                // add the controlling companies
                var companies = [
                    {name: entDat.owner, type: "owner", rig: rig},
                    {name: entDat.operator, type: "operator", rig: rig},
                    {name: entDat.manager, type: "manager", rig: rig}
                ];
                companies.forEach(processCompanies);
            }

            if (svg !== undefined) {
                var companyIndices = [];
                var rigIndices = [];
                for (i = 0; i < entities.length; i++) {
                    var entity = entities[i];
                    if (entity.type === "company")
                        companyIndices.push(i);
                    else
                        rigIndices.push(i);
                }
                /*var mapOffsets = function(obj) {return {node: obj, offset: 0};};
                var mapGaps = function(obj, i, arr) {return {
                    axis: "x",
                    left: (i == arr.length - 1 ? i - 1 : i),
                    right: (i == arr.length - 1 ? i : i + 1),
                    gap: 60,
                };};
                var constraints = companyIndices.map(mapGaps);
                constraints.push.apply(constraints, rigIndices.map(mapGaps));
                constraints.push.apply(constraints, [
                    {
                        type: "alignment",
                        axis: "y",
                        offsets: rigIndices.map(mapOffsets)
                    },
                    {
                        type: "alignment",
                        axis: "y",
                        offsets: companyIndices.map(mapOffsets)
                    }
                ]);
                _cola.constraints(constraints);
                _cola.groups([
                    {"leaves": companyIndices},
                    {"leaves": rigIndices},
                ]);*/
                renderRelations(relations, svg, _cola);
                renderEntities(entities, svg, _cola);
            }
        });


        /* Functions to manipulate relations and entities */

        this.addEntity = function() {
            this.entities.push(new Entity("unnamed", "unknown"));
            if (svg !== undefined)
                renderEntities(this.entities, svg, _cola);
        };

        this.addRelation = function(source, target) {
            this.relations.push(new Relation(source, target, "unknown"));
            if (svg !== undefined)
                renderRelations(this.relations, svg, _cola);
        };

        this.lockEntities = function() {
            this.entities.forEach(function(obj) {obj.fixed = true;});
        };

        this.unlockEntities = function() {
            this.entities.forEach(function(obj) {obj.fixed = false;});
        };

        this.doFlowLayout = function() {
            _cola.flowLayout("y", 30) // top-to-bottom
                .symmetricDiffLinkLengths(60)
                .start();
        };
    });

})();
