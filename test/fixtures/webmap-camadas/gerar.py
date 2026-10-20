# Gera fixtures no formato qgis2web (SMMAFRANCA/webmap). Uso: python3 gerar.py
import json, os, shutil
def fc(name, feats): return {"type":"FeatureCollection","name":name,"crs":{"type":"name","properties":{"name":"urn:ogc:def:crs:OGC:1.3:CRS84"}},"xy_coordinate_resolution":1e-07,"features":feats}
def pt(fid,x,y,**p): return {"type":"Feature","properties":{"fid":str(fid),**p},"geometry":{"type":"Point","coordinates":[x,y]}}
def sq(fid,x,y,d=0.001,**p): return {"type":"Feature","properties":{"fid":str(fid),**p},"geometry":{"type":"MultiPolygon","coordinates":[[[[x,y],[x+d,y],[x+d,y+d],[x,y+d],[x,y]]]]}}
def ln(fid,pts,**p): return {"type":"Feature","properties":{"fid":str(fid),**p},"geometry":{"type":"MultiLineString","coordinates":[pts]}}
def style(v,kind,color,icon=None,cats=None):
  if icon: s=f"image: new ol.style.Icon({{imgSize: [580, 580], scale: 0.03, anchor: [9, 9], anchorXUnits: \"pixels\", anchorYUnits: \"pixels\", rotation: 0.0, src: \"styles/{icon}\"}})".replace('"styles','\'styles').replace(f'{icon}"',f"{icon}'")
  elif kind=="point": s=f"image: new ol.style.Circle({{radius: 8.0 + size, displacement: [0, 0], stroke: new ol.style.Stroke({{color: 'rgba(35,35,35,1.0)', lineDash: null, lineCap: 'butt', lineJoin: 'miter', width: 1.52}}), fill: new ol.style.Fill({{color: '{color}'}})}})"
  elif kind=="line": s=f"stroke: new ol.style.Stroke({{color: '{color}', lineDash: null, lineCap: 'square', lineJoin: 'bevel', width: 3.0}})"
  else: s=f"stroke: new ol.style.Stroke({{color: 'rgba(35,35,35,1.0)', lineDash: null, lineCap: 'butt', lineJoin: 'miter', width: 0.988}}), fill: new ol.style.Fill({{color: '{color}'}})"
  head=f"var size = 0;\nvar placement = 'point';\n\nvar style_{v} = function(feature, resolution){{\n    var context = {{feature: feature, variables: {{}}}};\n    var value = feature.get(\"{'TIPO' if cats else ''}\");\n"
  if cats:
    body="    var style;\n    switch(value.toString()) {\n"+"".join(f"        case '{k}':\n                    style = [ new ol.style.Style({{\n        stroke: new ol.style.Stroke({{color: 'rgba(35,35,35,1.0)', width: 0.988}}), fill: new ol.style.Fill({{color: '{c}'}})\n    }})];\n                    break;\n" for k,c in cats)+"    }\n    return style;\n};\n"
    return head+body
  return head+f"    var style = [ new ol.style.Style({{\n        {s}\n    }})];\n    return style;\n}};\n"
def write(ver, layers, extra_files=None, broken=None):
  d=ver; shutil.rmtree(d,ignore_errors=True); [os.makedirs(f"{d}/{x}",exist_ok=True) for x in ("layers","styles")]
  groups={}; out=["var wms_layers = [];\n"]
  for v,L in layers.items():
    g,title,kind,color,feats=L[:5]; icon=L[5] if len(L)>5 else None; cats=L[6] if len(L)>6 else None
    txt=f"var json_{v} = "+json.dumps(fc(v,feats),ensure_ascii=False)+";"
    if broken==v: txt=txt[:len(txt)//2]
    open(f"{d}/layers/{v}.js","w").write(txt)
    open(f"{d}/styles/{v}_style.js","w").write(style(v,kind,color,icon,cats))
    out.append(f"var format_{v} = new ol.format.GeoJSON();\nvar features_{v} = format_{v}.readFeatures(json_{v}, \n            {{dataProjection: 'EPSG:4326', featureProjection: 'EPSG:31983'}});\nvar jsonSource_{v} = new ol.source.Vector({{\n    attributions: ' ',\n}});\njsonSource_{v}.addFeatures(features_{v});\nvar lyr_{v} = new ol.layer.Vector({{\n                declutter: false,\n                source:jsonSource_{v}, \n                style: style_{v},\n                popuplayertitle: '{title}',\n                interactive: true,\n                title: '<img src=\"styles/legend/{v}.png\" /> {title}'\n            }});\n")
    groups.setdefault(g,[]).append(v)
  for g,vs in groups.items():
    out.append(f"var group_{g} = new ol.layer.Group({{\n                                layers: [{''.join('lyr_'+v+',' for v in vs)}],\n                                fold: 'close',\n                                title: '{g}'}});\n")
  out.append("var layersList = ["+",".join("group_"+g for g in groups)+"];\n")
  open(f"{d}/layers/layers.js","w").write("".join(out))
  open(f"{d}/styles/ponto_viciado.svg","w").write('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><circle cx="5" cy="5" r="4" fill="#e31a1c"/></svg>')
V1={
 "CRECHE_PRE_ESCOLA45UNID_78":("SECRETARIA_EDUCACAO","CRECHE_PRE_ESCOLA (45 UNID.)","point","rgba(252,205,229,1.0)",[pt(57,-47.4030519,-20.523552,UNIDADE_ESCOLAR="Lar Esperança",ENDERECO="Rua Maria Barini, 3290"),pt(59,-47.40,-20.53,UNIDADE_ESCOLAR="Creche B")]),
 "UBS24UNID_80":("SECRETARIA_SAUDE","UBS (24 UNID.)","point","rgba(31,120,180,1.0)",[pt(1,-47.39,-20.54,NOME="UBS Centro")]),
 "VIAS_PRINCIPAIS_81":("SISTEMA_VIARIO","VIAS_PRINCIPAIS","line","rgba(227,26,28,1.0)",[ln(10,[[-47.41,-20.52],[-47.40,-20.53],[-47.39,-20.535]],NOME="Av. Brasil")]),
 "LOTE252UNID7530210M_458":("AREAS_PUBLICAS","LOTE (252 UNID. / 75.302,10 M²)","polygon","rgba(51,160,44,0.6)",[sq(7,-47.40,-20.52,AREA_M2=1200.5),sq(8,-47.398,-20.52,AREA_M2=900)]),
 "LOTE_459":("AREAS_PUBLICAS","LOTE","point","rgba(51,160,44,1.0)",[pt(7,-47.3995,-20.5195)]),
 "ETE_2_100":("SANEAMENTO","ETE 2","polygon","rgba(166,206,227,0.8)",[sq(1,-47.37,-20.50,TIPO="A")],None,[("A","rgba(166,206,227,0.8)"),("B","rgba(31,120,180,0.8)")]),
 "ETE_3_101":("SANEAMENTO","ETE 3","polygon","rgba(166,206,227,0.8)",[sq(1,-47.36,-20.50)]),
 "PONTO_VICIADO_120":("PONTOS_VICIADOS","PONTO_VICIADO (2 UNID.)","point",None,[pt(1,-47.41,-20.51),pt(2,-47.42,-20.51)],"ponto_viciado.svg"),
}
write("v1",V1)
V2=dict(V1)
del V2["UBS24UNID_80"]                                    # removida da origem
g,t,k,c,f=V2.pop("CRECHE_PRE_ESCOLA45UNID_78")
V2["CRECHE_PRE_ESCOLA46UNID_77"]=(g,"CRECHE_PRE_ESCOLA (46 UNID.)",k,"rgba(200,100,150,1.0)",f+[pt(60,-47.41,-20.525,UNIDADE_ESCOLAR="Creche C")])  # atualizada (mesma chave)
V2["VIAS_PRINCIPAIS_82"]=V2.pop("VIAS_PRINCIPAIS_81")      # só o sufixo mudou: mesma camada
g,t,k,c,f=V2.pop("ETE_3_101")[:5]
V2["ETE_3_NORTE_101"]=(g,"ETE 3 NORTE",k,c,f)               # renomeada: nova + antiga removida
V2["ECOPONTO3UNID_90"]=("ECOPONTOS","ECOPONTO (3 UNID.)","point","rgba(255,127,0,1.0)",[pt(1,-47.38,-20.51,NOME="Ecoponto Norte"),
  {"type":"Feature","properties":{"fid":"2"},"geometry":{"type":"Point","coordinates":[-47.5]}},
  {"type":"Feature","properties":{"fid":"3"},"geometry":None}])  # nova + 2 elementos malformados
write("v2",V2)
write("v3",V1)   # volta ao v1: UBS e ETE 3 reativadas (mesmo id), ETE 3 NORTE removida
write("v_quebrada",V1,broken="VIAS_PRINCIPAIS_81")  # GeoJSON truncado: camada inteira ilegível => FALHA, nada gravado
