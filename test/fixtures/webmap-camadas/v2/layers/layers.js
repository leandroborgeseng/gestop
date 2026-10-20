var wms_layers = [];
var format_LOTE252UNID7530210M_458 = new ol.format.GeoJSON();
var features_LOTE252UNID7530210M_458 = format_LOTE252UNID7530210M_458.readFeatures(json_LOTE252UNID7530210M_458, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_LOTE252UNID7530210M_458 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_LOTE252UNID7530210M_458.addFeatures(features_LOTE252UNID7530210M_458);
var lyr_LOTE252UNID7530210M_458 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_LOTE252UNID7530210M_458, 
                style: style_LOTE252UNID7530210M_458,
                popuplayertitle: 'LOTE (252 UNID. / 75.302,10 M²)',
                interactive: true,
                title: '<img src="styles/legend/LOTE252UNID7530210M_458.png" /> LOTE (252 UNID. / 75.302,10 M²)'
            });
var format_LOTE_459 = new ol.format.GeoJSON();
var features_LOTE_459 = format_LOTE_459.readFeatures(json_LOTE_459, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_LOTE_459 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_LOTE_459.addFeatures(features_LOTE_459);
var lyr_LOTE_459 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_LOTE_459, 
                style: style_LOTE_459,
                popuplayertitle: 'LOTE',
                interactive: true,
                title: '<img src="styles/legend/LOTE_459.png" /> LOTE'
            });
var format_ETE_2_100 = new ol.format.GeoJSON();
var features_ETE_2_100 = format_ETE_2_100.readFeatures(json_ETE_2_100, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_ETE_2_100 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_ETE_2_100.addFeatures(features_ETE_2_100);
var lyr_ETE_2_100 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_ETE_2_100, 
                style: style_ETE_2_100,
                popuplayertitle: 'ETE 2',
                interactive: true,
                title: '<img src="styles/legend/ETE_2_100.png" /> ETE 2'
            });
var format_PONTO_VICIADO_120 = new ol.format.GeoJSON();
var features_PONTO_VICIADO_120 = format_PONTO_VICIADO_120.readFeatures(json_PONTO_VICIADO_120, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_PONTO_VICIADO_120 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_PONTO_VICIADO_120.addFeatures(features_PONTO_VICIADO_120);
var lyr_PONTO_VICIADO_120 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_PONTO_VICIADO_120, 
                style: style_PONTO_VICIADO_120,
                popuplayertitle: 'PONTO_VICIADO (2 UNID.)',
                interactive: true,
                title: '<img src="styles/legend/PONTO_VICIADO_120.png" /> PONTO_VICIADO (2 UNID.)'
            });
var format_CRECHE_PRE_ESCOLA46UNID_77 = new ol.format.GeoJSON();
var features_CRECHE_PRE_ESCOLA46UNID_77 = format_CRECHE_PRE_ESCOLA46UNID_77.readFeatures(json_CRECHE_PRE_ESCOLA46UNID_77, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_CRECHE_PRE_ESCOLA46UNID_77 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_CRECHE_PRE_ESCOLA46UNID_77.addFeatures(features_CRECHE_PRE_ESCOLA46UNID_77);
var lyr_CRECHE_PRE_ESCOLA46UNID_77 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_CRECHE_PRE_ESCOLA46UNID_77, 
                style: style_CRECHE_PRE_ESCOLA46UNID_77,
                popuplayertitle: 'CRECHE_PRE_ESCOLA (46 UNID.)',
                interactive: true,
                title: '<img src="styles/legend/CRECHE_PRE_ESCOLA46UNID_77.png" /> CRECHE_PRE_ESCOLA (46 UNID.)'
            });
var format_VIAS_PRINCIPAIS_82 = new ol.format.GeoJSON();
var features_VIAS_PRINCIPAIS_82 = format_VIAS_PRINCIPAIS_82.readFeatures(json_VIAS_PRINCIPAIS_82, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_VIAS_PRINCIPAIS_82 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_VIAS_PRINCIPAIS_82.addFeatures(features_VIAS_PRINCIPAIS_82);
var lyr_VIAS_PRINCIPAIS_82 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_VIAS_PRINCIPAIS_82, 
                style: style_VIAS_PRINCIPAIS_82,
                popuplayertitle: 'VIAS_PRINCIPAIS',
                interactive: true,
                title: '<img src="styles/legend/VIAS_PRINCIPAIS_82.png" /> VIAS_PRINCIPAIS'
            });
var format_ETE_3_NORTE_101 = new ol.format.GeoJSON();
var features_ETE_3_NORTE_101 = format_ETE_3_NORTE_101.readFeatures(json_ETE_3_NORTE_101, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_ETE_3_NORTE_101 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_ETE_3_NORTE_101.addFeatures(features_ETE_3_NORTE_101);
var lyr_ETE_3_NORTE_101 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_ETE_3_NORTE_101, 
                style: style_ETE_3_NORTE_101,
                popuplayertitle: 'ETE 3 NORTE',
                interactive: true,
                title: '<img src="styles/legend/ETE_3_NORTE_101.png" /> ETE 3 NORTE'
            });
var format_ECOPONTO3UNID_90 = new ol.format.GeoJSON();
var features_ECOPONTO3UNID_90 = format_ECOPONTO3UNID_90.readFeatures(json_ECOPONTO3UNID_90, 
            {dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'});
var jsonSource_ECOPONTO3UNID_90 = new ol.source.Vector({
    attributions: ' ',
});
jsonSource_ECOPONTO3UNID_90.addFeatures(features_ECOPONTO3UNID_90);
var lyr_ECOPONTO3UNID_90 = new ol.layer.Vector({
                declutter: false,
                source:jsonSource_ECOPONTO3UNID_90, 
                style: style_ECOPONTO3UNID_90,
                popuplayertitle: 'ECOPONTO (3 UNID.)',
                interactive: true,
                title: '<img src="styles/legend/ECOPONTO3UNID_90.png" /> ECOPONTO (3 UNID.)'
            });
var group_AREAS_PUBLICAS = new ol.layer.Group({
                                layers: [lyr_LOTE252UNID7530210M_458,lyr_LOTE_459,],
                                fold: 'close',
                                title: 'AREAS_PUBLICAS'});
var group_SANEAMENTO = new ol.layer.Group({
                                layers: [lyr_ETE_2_100,lyr_ETE_3_NORTE_101,],
                                fold: 'close',
                                title: 'SANEAMENTO'});
var group_PONTOS_VICIADOS = new ol.layer.Group({
                                layers: [lyr_PONTO_VICIADO_120,],
                                fold: 'close',
                                title: 'PONTOS_VICIADOS'});
var group_SECRETARIA_EDUCACAO = new ol.layer.Group({
                                layers: [lyr_CRECHE_PRE_ESCOLA46UNID_77,],
                                fold: 'close',
                                title: 'SECRETARIA_EDUCACAO'});
var group_SISTEMA_VIARIO = new ol.layer.Group({
                                layers: [lyr_VIAS_PRINCIPAIS_82,],
                                fold: 'close',
                                title: 'SISTEMA_VIARIO'});
var group_ECOPONTOS = new ol.layer.Group({
                                layers: [lyr_ECOPONTO3UNID_90,],
                                fold: 'close',
                                title: 'ECOPONTOS'});
var layersList = [group_AREAS_PUBLICAS,group_SANEAMENTO,group_PONTOS_VICIADOS,group_SECRETARIA_EDUCACAO,group_SISTEMA_VIARIO,group_ECOPONTOS];
