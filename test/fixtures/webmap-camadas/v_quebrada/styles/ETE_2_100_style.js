var size = 0;
var placement = 'point';

var style_ETE_2_100 = function(feature, resolution){
    var context = {feature: feature, variables: {}};
    var value = feature.get("TIPO");
    var style;
    switch(value.toString()) {
        case 'A':
                    style = [ new ol.style.Style({
        stroke: new ol.style.Stroke({color: 'rgba(35,35,35,1.0)', width: 0.988}), fill: new ol.style.Fill({color: 'rgba(166,206,227,0.8)'})
    })];
                    break;
        case 'B':
                    style = [ new ol.style.Style({
        stroke: new ol.style.Stroke({color: 'rgba(35,35,35,1.0)', width: 0.988}), fill: new ol.style.Fill({color: 'rgba(31,120,180,0.8)'})
    })];
                    break;
    }
    return style;
};
