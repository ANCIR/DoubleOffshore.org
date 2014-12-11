---
layout: page
title: Explore
permalink: /explore/
---
<div ng-controller="NetworkController as network" class="container-fluid">
    <!-- query controls -->
    <div class="col-md-2">
        <form ng-submit="network.createViews()" role="form">
            Show me rigs in
            <div multi-select input-model="locationValues" button-label="name" item-label="name" tick-property="ticked" default-label="any country"></div>
            <br />that are owned by
            <div multi-select input-model="ownerValues" button-label="name" item-label="name" tick-property="ticked" default-label="anyone"></div>
            <br />and operated by
            <div multi-select input-model="operatorValues" button-label="name" item-label="name" tick-property="ticked" default-label="anyone"></div>
            <br />and managed by
            <div multi-select input-model="managerValues" button-label="name" item-label="name" tick-property="ticked" default-label="anyone"></div>
            <br />and sailing under
            <div multi-select input-model="flagValues" button-label="name" item-label="name" tick-property="ticked" default-label="any country"></div>
            <br/><input type="submit" class="btn btn-default" value="Show rigs" />
        </form>

        <button ng-click="network.groupBy('raw_country')" class="group-by btn btn-default">Group by rig location</button>
        <button ng-click="network.groupBy('raw_flag')" class="group-by btn btn-default">Group by rig flag</button>
    </div>

    <!-- network canvas -->
    <div id="canvas" class="col-md-5"></div>

    <!-- map view -->
    <div id="map" class="col-md-5"></div>
</div>

<script type="text/javascript" src="{{ "/assets/js/jquery/jquery.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/angular/angular.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/angular-multi-select/angular-multi-select.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/d3/d3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/d3-geo-projection/index.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/topojson/topojson.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/webcola/cola.v3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/crossfilter/crossfilter.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/app.js" | prepend: site.baseurl }}"></script>

<link rel="stylesheet" href="{{ "/assets/css/angular-multi-select/angular-multi-select.css" | prepend: site.baseurl }}" />
<style>
    .container-fluid {
        padding: 0;
    }

    .container-fluid > div:first-child {padding-left: 0;}
    .container-fluid > div:last-child {padding-right: 0;}

    /* Network style */

    .relation {
        stroke: #ECD078;
        stroke-width: 2px;
    }
    .relation-manager {stroke: #D95B43;}
    .relation-operator {stroke: #542437;}

    .entity {stroke-width: 1px;}
    .entity-rig {
        fill: #53777A;
        stroke: rgba(110, 158, 162, 1.0);
    }
    .entity-company {
        fill: #C02942;
        stroke: rgba(255, 59, 88, 1.0);
    }

    .group {
        fill: rgba(255, 255, 255, 0.25);
        stroke: rgba(255, 255, 255, 0.33);
        stroke-width: 1px;
    }

    text.label {
        fill: white;
        font-size: 8px;
    }

    /* Widgets style */

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
