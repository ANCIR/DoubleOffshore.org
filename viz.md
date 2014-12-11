---
layout: page
title: Viz
permalink: /viz/
---
<div ng-controller="NetworkController as network" class="container-fluid">
    <!-- network canvas -->
    <div id="canvas" class="col-md-5"></div>

    <!-- map view -->
    <div id="map" class="col-md-5"></div>

    <!-- query controls -->
    <div class="pull-right col-md-2">
        <form ng-submit="network.createViews()">
            Show me rigs<br />in
            <select ng-model="currentLocation.selected" ng-options="country.key for country in locationValues">
                <option value="">any country</option>
            </select>
            <br />that are owned by
            <select ng-model="currentOwner.selected" ng-options="company.key for company in ownerValues">
                <option value="">anyone</option>
            </select>
            <br />and operated by
            <select ng-model="currentOperator.selected" ng-options="company.key for company in operatorValues">
                <option value="">anyone</option>
            </select>
            <br />and managed by
            <select ng-model="currentManager.selected" ng-options="company.key for company in managerValues">
                <option value="">anyone</option>
            </select>
            <br />and sailing under
            <select ng-model="currentFlag.selected" ng-options="flag.key for flag in flagValues">
                <option value="">any country</option>
            </select>
            <br/><input type="submit" class="btn btn-default" value="Show rigs" />
        </form>

        <button ng-click="network.groupBy('raw_country')" class="group-by btn btn-default">Group by rig location</button>
        <button ng-click="network.groupBy('raw_flag')" class="group-by btn btn-default">Group by rig flag</button>
    </div>
</div>

<script type="text/javascript" src="{{ "/assets/js/jquery/jquery.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/angular/angular.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/d3/d3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/d3-geo-projection/index.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/topojson/topojson.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/webcola/cola.v3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/crossfilter/crossfilter.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/app.js" | prepend: site.baseurl }}"></script>

<style>
    /* Network style */

    .relation {
        stroke: #ECD078;
        stroke-width: 2px;
    }

    .relation-manager {stroke: #D95B43;}
    .relation-operator {stroke: #542437;}
    .entity-rig {fill: #53777A;}
    .entity-company {fill: #C02942;}
    .group {
        fill: rgba(255, 255, 255, 0.25);
        stroke: white;
        stroke-width: 1px;
    }

    /* Widgets style */

    text.label {fill: white;}

    .btn {margin-top: 8px;}

    /* Map style */

    .graticule {
      fill: none;
      stroke: #777;
      stroke-width: .5px;
      stroke-opacity: .5;
    }

    .land {
      fill: #222;
    }

    .boundary {
      fill: none;
      stroke: #fff;
      stroke-width: .5px;
    }

    .marker1, .marker2 {}

    .connection {
        stroke: #C02942;
        stroke-width: 0.5px;
    }
</style>
