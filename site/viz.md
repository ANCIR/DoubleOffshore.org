---
layout: page
title: Viz
permalink: /viz/
---
<div ng-controller="NetworkController as network" class="container-fluid">
    <div class="pull-right">
        Show me all rigs:
    </div>
    <div id="canvas" class="col-md-10"></div>
</div>

<script type="text/javascript" src="{{ "/assets/jquery/dist/jquery.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/angular/angular.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/d3/d3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/webcola/WebCola/cola.v3.min.js" | prepend: site.baseurl }}"></script>
<script type="text/javascript" src="{{ "/assets/js/app.js" | prepend: site.baseurl }}"></script>
