var size = 0;
var placement = 'point';

var style_CRECHE_PRE_ESCOLA45UNID_78 = function(feature, resolution){
    var context = {feature: feature, variables: {}};
    var value = feature.get("");
    var style = [ new ol.style.Style({
        image: new ol.style.Circle({radius: 8.0 + size, displacement: [0, 0], stroke: new ol.style.Stroke({color: 'rgba(35,35,35,1.0)', lineDash: null, lineCap: 'butt', lineJoin: 'miter', width: 1.52}), fill: new ol.style.Fill({color: 'rgba(252,205,229,1.0)'})})
    })];
    return style;
};
