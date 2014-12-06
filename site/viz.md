---
layout: page
title: Viz
permalink: /viz/
---
<div ng-controller="NetworkController as network" class="container-fluid">
    <div class="pull-right col-md-2">
        <button ng-click="network.addEntity()" type="button" class="btn-block">Add entity</button>
        <button ng-click="network.doFlowLayout()" type="button" class="btn-block">Do auto-layout</button>
        <button ng-click="network.lockEntities()" type="button" class="btn-block">Turn off auto-layout</button>
    </div>
    <div id="canvas" class="col-md-10"></div>
</div>
<script type="text/javascript" src="{{ "/assets/jquery/dist/jquery.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/angular/angular.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/d3/d3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/webcola/WebCola/cola.v3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/app.js" | prepend: site.baseurl }}"></script>
