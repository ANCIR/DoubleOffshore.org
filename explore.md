---
layout: page
permalink: /explore/
---
<div ng-controller="NetworkController as network" class="container-fluid">
    <!-- query controls -->
    <div class="col-md-2">
        <form ng-submit="network.createViews()" role="form">
            <span class="text-muted">Select oil rigs by choosing 0 or more filtering criteria and clicking <em>Show rigs</em>.</span>
            <label>Locations:</label>
            <div multi-select input-model="locationValues" button-label="name" item-label="name" tick-property="ticked" default-label="any country"></div>
            <label>Owners:</label>
            <div multi-select input-model="ownerValues" button-label="name" item-label="name" tick-property="ticked" default-label="anyone"></div>
            <label>Operators:</label>
            <div multi-select input-model="operatorValues" button-label="name" item-label="name" tick-property="ticked" default-label="anyone"></div>
            <label>Managers:</label>
            <div multi-select input-model="managerValues" button-label="name" item-label="name" tick-property="ticked" default-label="anyone"></div>
            <label>Flags:</label>
            <div multi-select input-model="flagValues" button-label="name" item-label="name" tick-property="ticked" default-label="any country"></div>
            <br/><input type="submit" class="btn btn-primary" value="Show rigs" />
        </form>
    </div>

    <!-- network canvas -->
    <div class="col-md-5">
        <div id="canvas"></div>
        <div>
            <form class="form-inline">
                <label>Group by </label>
                <select ng-model="groupByField" ng-options="key for (key, val) in groupByOptions" class="form-control">
                    <option value="">None</option>
                </select>
            </form>
        </div>
    </div>

    <!-- map view -->
    <div class="col-md-5">
        <div id="map"></div>
    </div>
</div>

<script type="text/javascript" src="{{ "/assets/3rdparty/jquery/js/jquery.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/3rdparty/angular/js/angular.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/3rdparty/angular-multi-select/js/angular-multi-select.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/3rdparty/d3/js/d3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/3rdparty/d3-geo-projection/js/index.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/3rdparty/topojson/js/topojson.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/3rdparty/webcola/js/cola.v3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/3rdparty/crossfilter/js/crossfilter.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/app-network.js" | prepend: site.baseurl }}"></script>

<link rel="stylesheet" href="{{ "/assets/3rdparty/angular-multi-select/css/angular-multi-select.css" | prepend: site.baseurl }}" />
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

    label {margin-top: 12px;}

    .multiSelect > .multiSelectButton,
    .multiSelect > .checkboxLayer,
    .multiSelect .checkBoxContainer,
    .multiSelect .multiSelectItem,
    .multiSelect .multiSelectItem * {
        width: 100%;
    }

    .multiSelect > .multiSelectButton {
        text-align: left;
    }

    .multiSelect .multiSelectItem span {
        display: inline-block;
        text-overflow: ellipsis;
        overflow: hidden;
        white-space: nowrap;
    }

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
