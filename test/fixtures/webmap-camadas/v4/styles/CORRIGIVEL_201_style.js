var size = 0;
var placement = 'point';

var style_CORRIGIVEL_201 = function(feature, resolution){
    var context = {feature: feature, variables: {}};
    var value = feature.get("");
    var style = [ new ol.style.Style({
        stroke: new ol.style.Stroke({color: 'rgba(35,35,35,1.0)', lineDash: null, lineCap: 'butt', lineJoin: 'miter', width: 0.988}), fill: new ol.style.Fill({color: 'rgba(227,26,28,0.5)'})
    })];
    return style;
};
