var size = 0;
var placement = 'point';

var style_PONTO_VICIADO_120 = function(feature, resolution){
    var context = {feature: feature, variables: {}};
    var value = feature.get("");
    var style = [ new ol.style.Style({
        image: new ol.style.Icon({imgSize: [580, 580], scale: 0.03, anchor: [9, 9], anchorXUnits: "pixels", anchorYUnits: "pixels", rotation: 0.0, src: 'styles/ponto_viciado.svg'})
    })];
    return style;
};
