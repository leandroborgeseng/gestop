var size = 0;
var placement = 'point';

var style_ETE_3_101 = function(feature, resolution){
    var context = {feature: feature, variables: {}};
    var value = feature.get("");
    var style = [ new ol.style.Style({
        stroke: new ol.style.Stroke({color: 'rgba(35,35,35,1.0)', lineDash: null, lineCap: 'butt', lineJoin: 'miter', width: 0.988}), fill: new ol.style.Fill({color: 'rgba(166,206,227,0.8)'})
    })];
    return style;
};
