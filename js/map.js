const fallbackView={center:[-5.1,-45.2],zoom:6};
const map=L.map('map',{zoomControl:false,preferCanvas:true}).setView(fallbackView.center,fallbackView.zoom);
const esriAttr='Tiles &copy; Esri — Source: Esri and data providers';
const grayBase=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:esriAttr});
const grayLabels=L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}',{maxZoom:16,attribution:esriAttr});
const sentinelAttr='EOxCloudless — EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2025)';
const landsatAttr='Landsat imagery — Esri, USGS, NASA';
const LandsatImageLayer=L.GridLayer.extend({createTile(coords,done){const tile=document.createElement('img');tile.alt='';tile.setAttribute('role','presentation');const size=256,half=20037508.342789244,n=2**coords.z,span=(half*2)/n,minX=-half+coords.x*span,maxX=minX+span,maxY=half-coords.y*span,minY=maxY-span;const params=new URLSearchParams({f:'image',bbox:`${minX},${minY},${maxX},${maxY}`,bboxSR:'3857',imageSR:'3857',size:`${size},${size}`,format:'jpgpng',interpolation:'RSP_BilinearInterpolation'});tile.onload=()=>done(null,tile);tile.onerror=()=>done(new Error('Falha ao carregar imagem Landsat'),tile);tile.src=`https://landsat2.arcgis.com/arcgis/rest/services/Landsat8_Views/ImageServer/exportImage?${params.toString()}`;return tile;}});
const basemaps={
  osm:L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}),
  imagery:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:esriAttr}),
  topographic:L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',{maxZoom:19,attribution:esriAttr}),
  opentopo:L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{maxZoom:17,attribution:'Map data &copy; OpenStreetMap contributors | SRTM | Map style &copy; OpenTopoMap (CC-BY-SA)'}),
  gray:L.layerGroup([grayBase,grayLabels]),
  sentinel:L.tileLayer('https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2025_3857/default/g/{z}/{y}/{x}.jpg',{minZoom:0,maxNativeZoom:14,maxZoom:18,attribution:sentinelAttr,className:'sentinel-seamless-pane',updateWhenZooming:false,keepBuffer:3}),
  landsat:new LandsatImageLayer({tileSize:256,minZoom:2,maxZoom:16,attribution:landsatAttr})
};
let currentBasemap=basemaps.sentinel.addTo(map);
const statusSource=document.getElementById('geoedu-status-source');if(statusSource)statusSource.textContent='Fonte: Sentinel-2 cloudless · EOX';(()=>{const ctrl=L.control({position:'bottomright'});ctrl.onAdd=function(m){const el=document.getElementById('geoedu-status-scale');L.DomEvent.disableClickPropagation(el);function draw(){const w=m.getSize().x;if(w<20)return;const y=m.getSize().y/2,a=m.containerPointToLatLng([w/2-70,y]),b=m.containerPointToLatLng([w/2+70,y]);const d=a.distanceTo(b);if(!(d>0))return;const step=Math.pow(10,Math.floor(Math.log10(d))),target=d/step,nice=(target>=5?5:target>=2?2:1)*step,unit=nice>=1000?'km':'m',value=unit==='km'?nice/1000:nice,px=Math.min(170,Math.max(35,140*nice/d));el.innerHTML='<div class="geoedu-scale-labels"><span>0</span><span>'+Number((value/2).toPrecision(3))+'</span><span>'+Number(value.toPrecision(3))+' '+unit+'</span></div><div class="geoedu-scale-blocks"><i></i><i></i><i></i><i></i></div>';el.style.width=(px+18)+'px';}m.on('zoomend moveend resize',draw);requestAnimationFrame(draw);return L.DomUtil.create('div','geoedu-scale-control-placeholder');};ctrl.addTo(map);})();
/* Ordem cartográfica fixa: base < polígonos < linhas < pontos < seleção. */
const geoPanes={state:410,municipal:420,polygon:430,line:450,point:470,selection:490};
Object.entries(geoPanes).forEach(([name,z])=>{const pane=map.createPane('geo-'+name);pane.style.zIndex=String(z);pane.style.pointerEvents='none';});
const geoRenderers={state:L.canvas({pane:'geo-state'}),municipal:L.canvas({pane:'geo-municipal'}),polygon:L.canvas({pane:'geo-polygon'}),line:L.canvas({pane:'geo-line',padding:0.25}),point:L.canvas({pane:'geo-point'}),selection:L.canvas({pane:'geo-selection'})};
function localPane(data){const types=new Set((data.type==='FeatureCollection'?data.features:[data]).map(f=>f.geometry?.type).filter(Boolean));if(types.size===1){const type=[...types][0];if(/Point$/.test(type))return 'point';if(/LineString$/.test(type))return 'line';}return 'polygon';}
const localLayers=new Map();let localSequence=0;
let maranhao=null,municipios=null,sedes=null,sedesData=null,drenagem=null,drenagemData=null,maranhaoBounds=null,localGeojson=null,mapMode='identify',maranhaoData=null,municipiosData=null,localGeojsonData=null,localGeojsonName='',queryHighlight=null,activeQueryLayer=null;
const defaultStyles={maranhao:{color:'#123f3b',weight:3,opacity:.95,fillColor:'#6eb8ad',fillOpacity:.04,dashArray:''},municipios:{color:'#397c73',weight:.8,opacity:1,fillColor:'#6eb8ad',fillOpacity:.16,dashArray:''}};
const thematicStyles={drenagem:{color:'#2585bd',weight:1.2,opacity:.85,dashArray:''},sedes:{color:'#145c69',weight:1.5,opacity:1,fillColor:'#ffbd4a',fillOpacity:.9,dashArray:'',radius:6},maranhao:{...defaultStyles.maranhao},municipios:{...defaultStyles.municipios},local:{color:'#a35f16',weight:2,opacity:1,fillColor:'#d79a52',fillOpacity:.25,dashArray:'',radius:7}};
const maranhaoCheckbox=document.getElementById('layer-maranhao'),municipiosCheckbox=document.getElementById('layer-municipios'),sedesCheckbox=document.getElementById('layer-sedes'),drenagemCheckbox=document.getElementById('layer-drenagem');
/* Legenda dinâmica: usa apenas estilos em memória; não solicita nem percorre GeoJSON. */
const legendContent=document.getElementById('legend-content');
function legendSymbol(family,style){const color=style.color||'#145c69',fill=style.fillColor||color,opacity=style.opacity??1,fillOpacity=style.fillOpacity??0,weight=style.weight??1,radius=style.radius??7;const lineStyle=style.dashArray?'stroke-dasharray="'+String(style.dashArray).replace(/[^0-9, .]/g,'')+'"':'';const common='stroke="'+color+'" stroke-opacity="'+opacity+'" stroke-width="'+weight+'" '+lineStyle;return family==='point'?'<svg viewBox="0 0 34 24" aria-hidden="true"><circle cx="17" cy="12" r="'+radius+'" '+common+' fill="'+fill+'" fill-opacity="'+fillOpacity+'"/></svg>':family==='line'?'<svg viewBox="0 0 34 24" aria-hidden="true"><path d="M2 12H32" fill="none" '+common+'/></svg>':'<svg viewBox="0 0 34 24" aria-hidden="true"><rect x="4" y="3" width="26" height="18" '+common+' fill="'+fill+'" fill-opacity="'+fillOpacity+'"/></svg>';}
function refreshLegend(){const entries=[['sedes','Sedes municipais','point',sedesCheckbox],['drenagem','Drenagem do Maranhão','line',drenagemCheckbox],['municipios','Municípios do Maranhão','polygon',municipiosCheckbox],['maranhao','Limite do Maranhão','polygon',maranhaoCheckbox],...Array.from(localLayers,([key,item])=>[key,item.name,geometryFamily(item.data),null])];entries.sort((a,b)=>({point:3,line:2,polygon:1}[b[2]]||0)-({point:3,line:2,polygon:1}[a[2]]||0));const visible=entries.filter(([key,,,cb])=>localLayers.has(key)?map.hasLayer(localLayers.get(key).layer):!!cb?.checked&&!!thematicLayerByKey(key)&&map.hasLayer(thematicLayerByKey(key)));legendContent.innerHTML=visible.length?visible.map(([key,name,family])=>'<div class="legend-entry"><span class="legend-symbol">'+legendSymbol(family,thematicStyles[key])+'</span><span class="legend-name">'+esc(name)+(graduatedModes[key]?'<small class="legend-field-label">'+esc(graduatedModes[key].field)+gradUnit(graduatedModes[key])+'</small>':categoryModes[key]?'<small class="legend-field-label">'+esc(categoryModes[key].field)+'</small>':'')+'</span></div>'+(graduatedModes[key]?graduatedModes[key].breaks.map((upper,i)=>'<div class="legend-entry legend-subentry"><span class="legend-symbol">'+legendSymbol(family,{...thematicStyles[key],fillColor:graduatedModes[key].colors[i],color:family==='line'?graduatedModes[key].colors[i]:thematicStyles[key].color,fillOpacity:Math.max(.65,thematicStyles[key].fillOpacity??.7)})+'</span><span class="legend-name">'+'<span class="legend-range">'+esc(gradLabel(graduatedModes[key],i))+'</span><small class="legend-feature-count">'+gradCounts(graduatedModes[key],key)[i]+' feições</small>'+'</span></div>').join(''):(categoryModes[key]?categoryModes[key].values.slice(0,12).map(value=>'<div class="legend-entry legend-subentry"><span class="legend-symbol">'+legendSymbol(family,{...categoryStyle(key,{properties:{[categoryModes[key].field]:value}}),color:categoryModes[key].colors[value],fillColor:categoryModes[key].colors[value],fillOpacity:.85})+'</span><span class="legend-name"><span class="legend-range">'+esc(value)+'</span><small class="legend-feature-count">'+(categoryModes[key].counts?.[value]??0)+' feições</small></span></div>').join('')+(categoryModes[key].values.length>12?'<div class="legend-subentry">+'+(categoryModes[key].values.length-12)+' categorias · consulte Propriedades</div>':'') :''))).join(''):'<p class="legend-empty">Nenhuma camada temática visível.</p>';}
map.on('layeradd layerremove',()=>refreshLegend());
function formatArea(v){const n=Number(v);return Number.isFinite(n)?n.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2}):'—';}
function municipioPopup(p){return `<div class="municipio-popup"><strong>${p.NM_MUN||'Município'}</strong><br>Código IBGE: ${p.CD_MUN||'—'}<br>UF: ${p.SIGLA_UF||'MA'}<br>Área: ${formatArea(p.AREA_KM2)} km²<br><small>Fonte: IBGE — Malha Municipal 2025</small></div>`;}
function estadoPopup(p){return `<div class="municipio-popup"><strong>${p.NM_UF||'Maranhão'}</strong><br>Código da UF: ${p.CD_UF||'—'}<br>Sigla: ${p.SIGLA_UF||'MA'}<br>Região: ${p.NM_REGIAO||'Nordeste'}<br>Área: ${formatArea(p.AREA_KM2)} km²<br><small>Fonte: IBGE — Malha Territorial 2025</small></div>`;}
function genericPopup(p){const entries=Object.entries(p||{}).slice(0,12);return entries.length?`<div class="generic-popup">${entries.map(([k,v])=>`<strong>${String(k).replace(/[<>]/g,'')}:</strong> ${String(v??'—').replace(/</g,'&lt;').replace(/>/g,'&gt;')}<br>`).join('')}</div>`:'<strong>Feição sem atributos</strong>';}
function bindModeAwarePopup(layer,html){layer.bindPopup(html);layer.on('click',e=>{if(mapMode==='measure'||mapMode==='area'){if(layer.isPopupOpen())layer.closePopup();L.DomEvent.stopPropagation(e);mapMode==='measure'?addMeasurePoint(e.latlng):addAreaPoint(e.latlng);}});}
const layerStatus=document.getElementById('layer-status');
const campus=L.circleMarker([-2.558,-44.308],{pane:'geo-point',renderer:geoRenderers.point,radius:8,color:'#123f3b',weight:2,fillOpacity:.75});bindModeAwarePopup(campus,'<b>Ponto demonstrativo</b><br>Camada temporária a ser substituída por unidades acadêmicas validadas.');
async function loadMaranhao(){if(maranhao)return maranhao;layerStatus.textContent='Carregando limite do Maranhão…';try{const r=await fetch('data/geojson/maranhao_limite_2025_web.geojson');if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();maranhaoData=data;maranhao=L.geoJSON(data,{pane:'geo-state',renderer:geoRenderers.state,style:()=>thematicStyles.maranhao,onEachFeature:(f,l)=>bindModeAwarePopup(l,estadoPopup(f.properties||{}))});maranhaoBounds=maranhao.getBounds();layerStatus.textContent='Limite do Maranhão carregado.';layerStatus.className='lab-status success';return maranhao;}catch(error){console.error(error);maranhaoCheckbox.checked=false;layerStatus.textContent='Falha ao carregar o limite do Maranhão.';layerStatus.className='lab-status error';throw error;}}
async function loadMunicipios(){if(municipios)return municipios;layerStatus.textContent='Carregando municípios…';try{const r=await fetch('data/geojson/municipios_ma_2025_web.geojson');if(!r.ok)throw new Error(`HTTP ${r.status}`);const data=await r.json();municipiosData=data;municipios=L.geoJSON(data,{pane:'geo-municipal',renderer:geoRenderers.municipal,style:()=>thematicStyles.municipios,onEachFeature:(f,l)=>{bindModeAwarePopup(l,municipioPopup(f.properties||{}));l.on({mouseover:e=>e.target.setStyle({weight:2,fillOpacity:.30}),mouseout:e=>e.target.setStyle(thematicStyles.municipios)});}});layerStatus.textContent='Municípios do Maranhão carregados.';layerStatus.className='lab-status success';return municipios;}catch(error){console.error(error);municipiosCheckbox.checked=false;layerStatus.textContent='Falha ao carregar os municípios.';layerStatus.className='lab-status error';throw error;}}
document.querySelectorAll('input[name="basemap"]').forEach(r=>r.addEventListener('change',e=>{map.removeLayer(currentBasemap);currentBasemap=basemaps[e.target.value].addTo(map);if(currentBasemap.bringToBack)currentBasemap.bringToBack();}));
maranhaoCheckbox.addEventListener('change',async e=>{if(e.target.checked){try{const l=await loadMaranhao();if(e.target.checked)l.addTo(map);}catch(_){}}else if(maranhao&&map.hasLayer(maranhao))map.removeLayer(maranhao);});
municipiosCheckbox.addEventListener('change',async e=>{if(e.target.checked){try{const l=await loadMunicipios();if(e.target.checked)l.addTo(map);if(maranhao&&map.hasLayer(maranhao))maranhao.bringToFront();}catch(_){}}else if(municipios&&map.hasLayer(municipios))map.removeLayer(municipios);});
async function loadSedes(){if(sedes)return sedes;layerStatus.textContent='Carregando sedes municipais…';try{const r=await fetch('data/geojson/Sedes_MA.geojson');if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();sedesData=data;sedes=L.geoJSON(data,{pane:'geo-point',pointToLayer:(f,ll)=>L.circleMarker(ll,{...thematicStyles.sedes,pane:'geo-point',renderer:geoRenderers.point}),onEachFeature:(f,l)=>bindModeAwarePopup(l,genericPopup(f.properties||{}))});layerStatus.textContent='Sedes municipais carregadas.';layerStatus.className='lab-status success';return sedes;}catch(error){console.error(error);sedesCheckbox.checked=false;layerStatus.textContent='Falha ao carregar as sedes municipais.';layerStatus.className='lab-status error';throw error;}}
sedesCheckbox.addEventListener('change',async e=>{if(e.target.checked){try{const layer=await loadSedes();if(e.target.checked)layer.addTo(map);}catch(_){}}else if(sedes&&map.hasLayer(sedes))map.removeLayer(sedes);});
async function loadDrenagem(){if(drenagem)return drenagem;layerStatus.textContent='Carregando drenagem otimizada (20 MB); aguarde…';layerStatus.className='lab-status';try{const r=await fetch('data/geojson/drenagem_MA_simplificado_10m__web.geojson');if(!r.ok)throw new Error('HTTP '+r.status);const data=await r.json();if(!['FeatureCollection','Feature'].includes(data.type))throw new Error('GeoJSON vetorial inválido');drenagemData=data;drenagem=L.geoJSON(data,{pane:'geo-line',style:()=>thematicStyles.drenagem,renderer:geoRenderers.line,onEachFeature:(f,l)=>bindModeAwarePopup(l,()=>genericPopup(f.properties||{}))});layerStatus.textContent='Drenagem carregada. Arquivo extenso: a navegação pode ficar lenta.';layerStatus.className='lab-status success';return drenagem;}catch(error){console.error(error);drenagemCheckbox.checked=false;layerStatus.textContent='Falha ao carregar drenagem. Confira arquivo e conexão.';layerStatus.className='lab-status error';throw error;}}
drenagemCheckbox.addEventListener('change',async e=>{if(e.target.checked){try{const layer=await loadDrenagem();if(e.target.checked)layer.addTo(map);}catch(_){}}else if(drenagem&&map.hasLayer(drenagem))map.removeLayer(drenagem);});
document.getElementById('layer-campus').addEventListener('change',e=>{e.target.checked?campus.addTo(map):map.removeLayer(campus);});
document.getElementById('btn-home').onclick=async()=>{if(!maranhaoBounds){try{await loadMaranhao();}catch(_){}}maranhaoBounds&&maranhaoBounds.isValid()?map.fitBounds(maranhaoBounds,{padding:[15,15]}):map.setView(fallbackView.center,fallbackView.zoom);};

const fileInput=document.getElementById('geojson-file'),labStatus=document.getElementById('lab-status'),removeLocal=document.getElementById('btn-remove-geojson');
const localList=document.getElementById('lab-local-layers');
document.getElementById('btn-add-geojson').onclick=()=>fileInput.click();
const localPalette=['#a35f16','#177f9d','#a44c87','#537b38','#7756b5','#bc6231'];
function syncLocalAlias(){
 const last=[...localLayers.values()].at(-1);
 localGeojson=last?.layer||null;localGeojsonData=last?.data||null;localGeojsonName=last?.name||'';
 removeLocal.disabled=!localLayers.size;
 document.getElementById('lab-layer-tools').hidden=!localLayers.size;
}
function renderLocalList(){
 localList.replaceChildren();
 localLayers.forEach((item,key)=>{
  const row=document.createElement('div');row.className='lab-local-row';
  const label=document.createElement('label');label.className='lab-local-name';
  const check=document.createElement('input');check.type='checkbox';check.checked=map.hasLayer(item.layer);check.setAttribute('aria-label','Exibir '+item.name);
  check.onchange=()=>{check.checked?item.layer.addTo(map):map.removeLayer(item.layer);refreshLegend();};
  const name=document.createElement('span');name.textContent=item.name;name.title=item.name;
  label.append(check,name);
  const actions=document.createElement('div');actions.className='lab-local-actions';
  const action=(title,txt,fn)=>{const b=document.createElement('button');b.type='button';b.className='panel-action';b.textContent=txt;b.title=title+' — '+item.name;b.setAttribute('aria-label',title+' — '+item.name);b.onclick=fn;actions.append(b);};
  action('Zoom para camada','⌖',()=>{const bounds=item.layer.getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:[20,20],maxZoom:15});});
  action('Propriedades e consulta','ⓘ',()=>openProperties(key));
  action('Remover camada','×',()=>removeLocalLayer(key));
  row.append(label,actions);localList.append(row);
 });
 syncLocalAlias();
 labStatus.textContent=localLayers.size?localLayers.size+' camada(s) GeoJSON carregada(s) no Laboratório.':'Nenhum arquivo local carregado.';
 labStatus.className='lab-status'+(localLayers.size?' success':'');
}
function removeLocalLayer(key){
 const item=localLayers.get(key);if(!item)return;
 if(activeQueryLayer===key){clearQuery(false);activeQueryLayer=null;document.getElementById('panel-properties').classList.remove('open');document.body.classList.remove('properties-open');}
 if(map.hasLayer(item.layer))map.removeLayer(item.layer);
 localLayers.delete(key);savedLocalQueries.delete(key);delete thematicStyles[key];delete categoryModes[key];delete graduatedModes[key];
 renderLocalList();refreshLegend();
 labStatus.textContent=localLayers.size?item.name+' removida. '+localLayers.size+' camada(s) restante(s).':'Nenhum arquivo local carregado.';
 labStatus.className='lab-status';
}
function clearLocal(){for(const key of [...localLayers.keys()])removeLocalLayer(key);fileInput.value='';}
removeLocal.onclick=clearLocal;
fileInput.addEventListener('change',async()=>{
 const files=[...fileInput.files];fileInput.value='';if(!files.length)return;
 let added=0;const errors=[];
 for(const file of files){
  if(file.size>10*1024*1024){errors.push(file.name+': excede 10 MB');continue;}
  try{
   const data=JSON.parse(await file.text());
   if(!data||!['FeatureCollection','Feature','Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon','GeometryCollection'].includes(data.type))throw Error('GeoJSON inválido');
   const key='local-'+(++localSequence),family=localPane(data);
   const color=localPalette[(localSequence-1)%localPalette.length];
   thematicStyles[key]={color,weight:2,opacity:1,fillColor:color,fillOpacity:.25,dashArray:'',radius:7};
   const style=thematicStyles[key];
   const layer=L.geoJSON(data,{pane:'geo-'+family,renderer:geoRenderers[family],style:()=>style,pointToLayer:(f,ll)=>L.circleMarker(ll,{pane:'geo-point',renderer:geoRenderers.point,radius:style.radius,color:style.color,weight:style.weight,opacity:style.opacity,fillColor:style.fillColor,fillOpacity:style.fillOpacity}),onEachFeature:(f,l)=>bindModeAwarePopup(l,genericPopup(f.properties||{}))}).addTo(map);
   localLayers.set(key,{name:file.name,data,layer});
   const bounds=layer.getBounds();if(bounds.isValid())map.fitBounds(bounds,{padding:[20,20],maxZoom:15});
   added++;
  }catch(err){console.error(err);errors.push(file.name+': estrutura ou geometria inválida');}
 }
 renderLocalList();refreshLegend();
 labStatus.textContent=(added?added+' camada(s) adicionada(s). Total: '+localLayers.size+'. ':'')+(errors.length?'Não importados: '+errors.join('; '):'');
 labStatus.className='lab-status '+(errors.length?'error':'success');
});
let points=[],measureLine=null,previewLine=null,labels=[],pointMarkers=[];let areaPoints=[],areaPolygon=null,areaPreview=null,areaLabel=null,areaMarkers=[];const measureButton=document.getElementById('btn-measure'),areaButton=document.getElementById('btn-area');
function distance(a,b){const R=6371,rad=x=>x*Math.PI/180,dLat=rad(b.lat-a.lat),dLon=rad(b.lng-a.lng),s=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(s));}function totalDistance(){let total=0;for(let i=1;i<points.length;i++)total+=distance(points[i-1],points[i]);return total;}
function clearDistance(){points=[];if(measureLine){map.removeLayer(measureLine);measureLine=null;}if(previewLine){map.removeLayer(previewLine);previewLine=null;}labels.forEach(x=>map.removeLayer(x));labels=[];pointMarkers.forEach(x=>map.removeLayer(x));pointMarkers=[];}function clearArea(){areaPoints=[];if(areaPolygon){map.removeLayer(areaPolygon);areaPolygon=null;}if(areaPreview){map.removeLayer(areaPreview);areaPreview=null;}if(areaLabel){map.removeLayer(areaLabel);areaLabel=null;}areaMarkers.forEach(x=>map.removeLayer(x));areaMarkers=[];}
function geodesicArea(latlngs){if(latlngs.length<3)return 0;const R=6378137,rad=Math.PI/180;let area=0;for(let i=0;i<latlngs.length;i++){const p1=latlngs[i],p2=latlngs[(i+1)%latlngs.length];area+=(p2.lng-p1.lng)*rad*(2+Math.sin(p1.lat*rad)+Math.sin(p2.lat*rad));}return Math.abs(area*R*R/2);}function formatMeasuredArea(m2){if(m2<10000)return `${m2.toLocaleString('pt-BR',{maximumFractionDigits:0})} m²`;const km2=m2/1e6;if(km2<1)return `${(m2/10000).toLocaleString('pt-BR',{maximumFractionDigits:2})} ha`;return `${km2.toLocaleString('pt-BR',{minimumFractionDigits:2,maximumFractionDigits:2})} km²`;}
function setMapMode(mode){mapMode=mode;map.closePopup();const active=mode==='measure'||mode==='area';map.getContainer().classList.toggle('measure-mode',active);measureButton.classList.toggle('active-tool',mode==='measure');areaButton.classList.toggle('active-tool',mode==='area');measureButton.setAttribute('aria-pressed',String(mode==='measure'));areaButton.setAttribute('aria-pressed',String(mode==='area'));active?map.doubleClickZoom.disable():map.doubleClickZoom.enable();if(mode!=='measure'&&previewLine){map.removeLayer(previewLine);previewLine=null;}if(mode!=='area'&&areaPreview){map.removeLayer(areaPreview);areaPreview=null;}}
function addMeasurePoint(latlng){if(mapMode!=='measure')return;points.push(latlng);pointMarkers.push(L.circleMarker(latlng,{radius:4,color:'#123f3b',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(map));if(measureLine)map.removeLayer(measureLine);measureLine=L.polyline(points,{color:'#123f3b',weight:3,dashArray:'7,6',interactive:false}).addTo(map);if(points.length>1){const total=totalDistance();labels.push(L.tooltip({permanent:true,direction:'top',className:'measure-label'}).setLatLng(latlng).setContent(total<1?`${(total*1000).toFixed(0)} m`:`${total.toFixed(2)} km`).addTo(map));}}function addAreaPoint(latlng){if(mapMode!=='area')return;areaPoints.push(latlng);areaMarkers.push(L.circleMarker(latlng,{radius:4,color:'#123f3b',weight:2,fillColor:'#fff',fillOpacity:1,interactive:false}).addTo(map));if(areaPolygon)map.removeLayer(areaPolygon);areaPolygon=L.polygon(areaPoints,{color:'#123f3b',weight:3,fillColor:'#6eb8ad',fillOpacity:.25,interactive:false}).addTo(map);if(areaPoints.length>=3){const m2=geodesicArea(areaPoints);if(areaLabel)map.removeLayer(areaLabel);areaLabel=L.tooltip({permanent:true,direction:'center',className:'measure-label'}).setLatLng(areaPolygon.getBounds().getCenter()).setContent(`Área: ${formatMeasuredArea(m2)}`).addTo(map);}}
measureButton.onclick=()=>{if(mapMode==='measure'){setMapMode('identify');}else{clearDistance();setMapMode('measure');}};areaButton.onclick=()=>{if(mapMode==='area'){setMapMode('identify');}else{clearArea();setMapMode('area');}};document.getElementById('btn-clear').onclick=()=>{clearDistance();clearArea();setMapMode('identify');};
map.on('click',e=>{if(mapMode==='measure')addMeasurePoint(e.latlng);else if(mapMode==='area')addAreaPoint(e.latlng);});map.on('mousemove',e=>{if(mapMode==='measure'&&points.length){if(previewLine)map.removeLayer(previewLine);previewLine=L.polyline([points[points.length-1],e.latlng],{color:'#397c73',weight:2,dashArray:'4,5',opacity:.7,interactive:false}).addTo(map);}else if(mapMode==='area'&&areaPoints.length){if(areaPreview)map.removeLayer(areaPreview);areaPreview=L.polygon([...areaPoints,e.latlng],{color:'#397c73',weight:2,dashArray:'4,5',fillColor:'#6eb8ad',fillOpacity:.12,interactive:false}).addTo(map);}});map.on('dblclick',e=>{if(mapMode!=='measure'&&mapMode!=='area')return;L.DomEvent.preventDefault(e.originalEvent);L.DomEvent.stopPropagation(e);setMapMode('identify');});
document.querySelectorAll('.tool-btn[data-panel]').forEach(btn=>btn.addEventListener('click',()=>{const id=btn.dataset.panel,p=document.getElementById(id),was=p.classList.contains('open');document.querySelectorAll('.floating-panel').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.tool-btn[data-panel]').forEach(x=>x.classList.remove('panel-active'));if(!was){p.classList.add('open');btn.classList.add('panel-active');}}));document.querySelectorAll('.panel-close').forEach(btn=>btn.addEventListener('click',()=>{const panel=btn.closest('.floating-panel');panel.classList.remove('open');if(panel.id==='panel-properties')document.body.classList.remove('properties-open');document.querySelectorAll('.tool-btn[data-panel]').forEach(x=>x.classList.remove('panel-active'));}));
const modal=document.getElementById('modal');document.getElementById('btn-geoai').onclick=()=>modal.hidden=false;document.getElementById('modal-close').onclick=()=>modal.hidden=true;modal.addEventListener('click',e=>{if(e.target===modal)modal.hidden=true;});
document.getElementById('zoom-in').onclick=()=>map.zoomIn();document.getElementById('zoom-out').onclick=()=>map.zoomOut();


/* Informações do portal em modal central — v1.3.1 */
const infoModal=document.getElementById('info-modal');
document.getElementById('btn-info').onclick=()=>infoModal.hidden=false;
document.getElementById('info-modal-close').onclick=()=>infoModal.hidden=true;
infoModal.addEventListener('click',e=>{if(e.target===infoModal)infoModal.hidden=true;});

/* Coordenadas do cursor — v1.3.2 */
const coordsDisplay=document.getElementById('coords');
/* Read cursor position over the entire map viewport, including floating controls. */
const mapViewport=map.getContainer().parentElement;
mapViewport.addEventListener('pointermove',event=>{
 if(!coordsDisplay||event.pointerType==='touch')return;
 const rect=map.getContainer().getBoundingClientRect();
 const x=event.clientX-rect.left,y=event.clientY-rect.top;
 if(x<0||y<0||x>rect.width||y>rect.height)return;
 const latlng=map.containerPointToLatLng([x,y]);
 if(!Number.isFinite(latlng.lat)||!Number.isFinite(latlng.lng))return;
 coordsDisplay.textContent='Lat: '+latlng.lat.toFixed(6)+'° | Long: '+latlng.lng.toFixed(6)+'°';
 },{passive:true});
/* Update coordinate readout also when hovering floating temporal controls.
   A pointer outside the geographic map footprint is explicitly identified. */
document.addEventListener('pointermove',event=>{
 if(!coordsDisplay||event.pointerType==='touch')return;
 const target=event.target;
 if(!(target instanceof Element)||!target.closest('#geoedu-temporal-toggle,#geoedu-temporal-panel'))return;
 const rect=map.getContainer().getBoundingClientRect();
 const x=event.clientX-rect.left,y=event.clientY-rect.top;
 if(x<0||y<0||x>rect.width||y>rect.height){coordsDisplay.textContent='Cursor fora do mapa';return;}
 const latlng=map.containerPointToLatLng([x,y]);
 if(Number.isFinite(latlng.lat)&&Number.isFinite(latlng.lng))coordsDisplay.textContent='Lat: '+latlng.lat.toFixed(6)+'° | Long: '+latlng.lng.toFixed(6)+'°';
},{passive:true});
/* Preserve last valid coordinates while cursor is over tools, attribution or status bar. */

/* Núcleo de propriedades, estilo e consulta atributiva — consolidado v1.7.0 */
const savedLocalQueries=new Map();
const propPanel=document.getElementById('panel-properties'),propSummary=document.getElementById('prop-summary'),queryField=document.getElementById('query-field'),queryOperator=document.getElementById('query-operator'),queryValue=document.getElementById('query-value'),queryStatus=document.getElementById('query-status'),queryResults=document.getElementById('query-results'),attributeToggle=document.getElementById('attribute-toggle'),attributeTableWrap=document.getElementById('attribute-table-wrap'),attributeTableMeta=document.getElementById('attribute-table-meta'),attributeGrid=document.getElementById('attribute-grid');
const propPointSize=document.getElementById('prop-point-size'),propPointRow=document.getElementById('prop-point-size-row'),propFillControls=document.getElementById('prop-fill-controls'),propDashRow=document.getElementById('prop-dash-row'),propGeometryHint=document.getElementById('prop-geometry-hint');
const propStyle={fillColor:document.getElementById('prop-fill-color'),fillOpacity:document.getElementById('prop-fill-opacity'),color:document.getElementById('prop-stroke-color'),weight:document.getElementById('prop-weight'),opacity:document.getElementById('prop-stroke-opacity'),dash:document.getElementById('prop-dash')};
const layerMeta={drenagem:{name:'Drenagem do Maranhão — Linhas',type:'Linha',source:'drenagem_MA_simplificado_10m__web.geojson — repositório GeoEdu'},sedes:{name:'Sedes municipais do Maranhão — Pontos',type:'Ponto',source:'Arquivo Sedes_MA.geojson — repositório GeoEdu'},maranhao:{name:'Limite do Maranhão — IBGE 2025',type:'Polígono',source:'IBGE — Malha Territorial 2025'},municipios:{name:'Municípios do Maranhão — IBGE 2025',type:'Polígono',source:'IBGE — Malha Municipal 2025'},local:{name:'Camada local',type:'GeoJSON',source:'Arquivo local — Laboratório GeoJSON'}};
function thematicLayerByKey(k){return k==='maranhao'?maranhao:k==='municipios'?municipios:k==='sedes'?sedes:k==='drenagem'?drenagem:localLayers.has(k)?localLayers.get(k).layer:null;}
function dataByKey(k){return k==='maranhao'?maranhaoData:k==='municipios'?municipiosData:k==='sedes'?sedesData:k==='drenagem'?drenagemData:localLayers.has(k)?localLayers.get(k).data:null;}
function checkboxByKey(k){return k==='maranhao'?maranhaoCheckbox:k==='municipios'?municipiosCheckbox:k==='sedes'?sedesCheckbox:k==='drenagem'?drenagemCheckbox:null;}
function featuresOf(data){if(!data)return[];return data.type==='FeatureCollection'?data.features:data.type==='Feature'?[data]:[];}
function esc(v){return String(v??'—').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');}
function featureLabel(f,i){const p=f.properties||{};return p.NM_MUN||p.NM_UF||p.name||p.nome||('Feição '+(i+1));}
function renderAttributes(f){const entries=Object.entries(f.properties||{});return '<h3>Atributos da feição</h3><table class="attribute-table">'+entries.map(([k,v])=>'<tr><th>'+esc(k)+'</th><td>'+esc(v)+'</td></tr>').join('')+'</table>';}
let attributePage=0;const ATTRIBUTE_PAGE_SIZE=50;
function renderAttributeGrid(){const fs=featuresOf(dataByKey(activeQueryLayer));if(!fs.length){attributeGrid.innerHTML='';attributeTableMeta.textContent='Nenhuma feição disponível.';return;}const fields=Object.keys(fs[0].properties||{});const pages=Math.ceil(fs.length/ATTRIBUTE_PAGE_SIZE);attributePage=Math.max(0,Math.min(attributePage,pages-1));const from=attributePage*ATTRIBUTE_PAGE_SIZE;const visible=fs.slice(from,from+ATTRIBUTE_PAGE_SIZE);attributeTableMeta.textContent=fs.length.toLocaleString('pt-BR')+' feição(ões) · '+fields.length+' campo(s)';document.getElementById('attribute-page-label').textContent=(attributePage+1)+' / '+pages;document.getElementById('attribute-prev').disabled=attributePage===0;document.getElementById('attribute-next').disabled=attributePage>=pages-1;attributeGrid.innerHTML='<thead><tr><th class="row-index">#</th>'+fields.map(f=>'<th title="'+esc(f)+'">'+esc(f)+'</th>').join('')+'</tr></thead><tbody>'+visible.map((f,i)=>'<tr data-attr-index="'+(from+i)+'"><td class="row-index">'+(from+i+1)+'</td>'+fields.map(field=>'<td title="'+esc((f.properties||{})[field])+'">'+esc((f.properties||{})[field])+'</td>').join('')+'</tr>').join('')+'</tbody>';attributeGrid.querySelectorAll('tbody tr').forEach(row=>row.onclick=()=>{attributeGrid.querySelectorAll('tbody tr').forEach(r=>r.classList.remove('selected'));row.classList.add('selected');showFeatureResult(fs[Number(row.dataset.attrIndex)]);});}
document.getElementById('attribute-prev').onclick=()=>{attributePage--;renderAttributeGrid();};
document.getElementById('attribute-next').onclick=()=>{attributePage++;renderAttributeGrid();};
function closeAttributeGrid(){attributePage=0;attributeTableWrap.hidden=true;attributeToggle.textContent='Abrir tabela';attributeGrid.innerHTML='';attributeTableMeta.textContent='';}
function geometryType(data){const fs=featuresOf(data),t=fs[0]?.geometry?.type||'—';return ({Polygon:'Polígono',MultiPolygon:'Multipolígono',Point:'Ponto',MultiPoint:'Multiponto',LineString:'Linha',MultiLineString:'Multilinha'})[t]||t;}
function clearQuery(restore=true,zoomToLayer=false){if(queryHighlight&&map.hasLayer(queryHighlight))map.removeLayer(queryHighlight);queryHighlight=null;queryResults.innerHTML='';queryStatus.textContent='Nenhuma consulta aplicada.';queryStatus.className='lab-status';if(restore&&activeQueryLayer){const l=thematicLayerByKey(activeQueryLayer),cb=checkboxByKey(activeQueryLayer);if(l){if(localLayers.has(activeQueryLayer)){if(!map.hasLayer(l))l.addTo(map);}else if(cb?.checked&&!map.hasLayer(l)){l.addTo(map);}if(zoomToLayer&&map.hasLayer(l)&&typeof l.getBounds==='function'){const b=l.getBounds();if(b.isValid())map.fitBounds(b,{padding:[35,35],maxZoom:14});}}}}
function geometryFamily(data){const types=new Set(featuresOf(data).map(f=>f.geometry?.type).filter(Boolean));if(!types.size)return 'unknown';const families=[...types].map(t=>/Point$/.test(t)?'point':/LineString$/.test(t)?'line':/Polygon$/.test(t)?'polygon':'unknown');return new Set(families).size===1?families[0]:'mixed';}
function configureGeometryStyle(k){const family=geometryFamily(dataByKey(k));const isPoint=family==='point',isLine=family==='line';propGeometryHint.textContent=({point:'Geometria pontual · símbolo circular',line:'Geometria linear · traçado',polygon:'Geometria poligonal · contorno e preenchimento',mixed:'Geometrias mistas · controles comuns',unknown:'Geometria não identificada'})[family];propPointRow.hidden=!isPoint;propFillControls.hidden=isLine;propDashRow.hidden=isPoint;document.getElementById('prop-stroke-label').textContent=isLine?'Linha':'Contorno';propPointSize.value=thematicStyles[k]?.radius??7;document.getElementById('prop-point-size-value').textContent=propPointSize.value+' px';}
function updatePointMarkers(layer,style){if(!layer||!layer.eachLayer)return;layer.eachLayer(child=>{if(child instanceof L.CircleMarker&&!(child instanceof L.Circle)){child.setStyle({...style,fill:true});child.setRadius(style.radius??7);}});}
function updatePropertyStyleLabels(){document.getElementById('prop-fill-opacity-value').textContent=Math.round(Number(propStyle.fillOpacity.value)*100)+'%';document.getElementById('prop-weight-value').textContent=Number(propStyle.weight.value).toFixed(1)+' px';document.getElementById('prop-stroke-opacity-value').textContent=Math.round(Number(propStyle.opacity.value)*100)+'%';}
/* v1.9.0 — categorias por atributo, com limite explícito para evitar travamentos. */
const categoryModes={};const categoryColors=['#277da1','#f9c74f','#43aa8b','#f3722c','#9b5de5','#577590','#f94144','#90be6d','#f8961e','#4d908e','#b56576','#6c757d'];
const categorySearch=document.getElementById('prop-category-search');const renderMode=document.getElementById('prop-render-mode'),categoryPanel=document.getElementById('prop-categories'),simpleControls=document.getElementById('prop-simple-controls'),categoryField=document.getElementById('prop-category-field'),categoryList=document.getElementById('prop-category-list'),categoryStatus=document.getElementById('prop-category-status');
function categoryKey(v){return v===null||v===undefined||v===''?'(Sem informação)':String(v);}
const gradPalettes={blue:['#eff3ff','#bdd7e7','#6baed6','#3182bd','#08519c','#08306b','#041c3a'],green:['#edf8e9','#c7e9c0','#a1d99b','#74c476','#31a354','#006d2c','#00441b'],orange:['#feedde','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#8c2d04']};
const graduatedModes={};const gradPanel=document.getElementById('prop-graduated'),gradField=document.getElementById('prop-grad-field'),gradMethod=document.getElementById('prop-grad-method'),gradCount=document.getElementById('prop-grad-count'),gradPalette=document.getElementById('prop-grad-palette'),gradStatus=document.getElementById('prop-grad-status'),gradList=document.getElementById('prop-grad-list');
function numericValue(v){if(v===null||v===undefined||String(v).trim()==='')return null;const n=Number(v);return Number.isFinite(n)?n:null;}
function classifyBreaks(values,count,method){const sorted=values.slice().sort((a,b)=>a-b),n=sorted.length,min=sorted[0],max=sorted[n-1];if(method==='equal')return Array.from({length:count},(_,i)=>i===count-1?max:min+(max-min)*(i+1)/count);if(method==='quantile')return Array.from({length:count},(_,i)=>sorted[Math.min(n-1,Math.ceil((i+1)*n/count)-1)]);const distinct=[...new Set(sorted)];if(distinct.length<count)return null;/* Exact Jenks dynamic programming on sorted observations, bounded for browser responsiveness. */const k=count,N=n,dp=Array.from({length:k+1},()=>new Float64Array(N+1).fill(Infinity)),cut=Array.from({length:k+1},()=>new Int32Array(N+1));dp[0][0]=0;const sum=new Float64Array(N+1),sq=new Float64Array(N+1);for(let i=1;i<=N;i++){sum[i]=sum[i-1]+sorted[i-1];sq[i]=sq[i-1]+sorted[i-1]**2;}for(let j=1;j<=k;j++)for(let i=j;i<=N;i++)for(let p=j-1;p<i;p++){const len=i-p,v=Math.max(0,sq[i]-sq[p]-(sum[i]-sum[p])**2/len),score=dp[j-1][p]+v;if(score<dp[j][i]){dp[j][i]=score;cut[j][i]=p;}}let i=N;const ends=new Array(k);for(let j=k;j>=1;j--){ends[j-1]=sorted[i-1];i=cut[j][i];}return ends;}
function categoryStyle(k,f){const base=thematicStyles[k],grad=graduatedModes[k];if(grad){const n=numericValue(f?.properties?.[grad.field]);if(n===null)return {...base,color:grad.family==='line'?'#929a9b':base.color,fillColor:'#929a9b'};let i=gradClassIndex(grad,n);const color=grad.colors[i];return {...base,color:grad.family==='line'?color:base.color,fillColor:color,fillOpacity:grad.family==='line'?base.fillOpacity:Math.max(.65,base.fillOpacity??.7)};}const cfg=categoryModes[k];if(!cfg||!f)return base;const color=cfg.colors[categoryKey(f.properties?.[cfg.field])]||base.fillColor||base.color;return {...base,color,fillColor:color,fill:true,fillOpacity:cfg.family==='line'?base.fillOpacity:0.85,opacity:1};}
function applyCategoryRendering(k){const layer=thematicLayerByKey(k),cfg=categoryModes[k],grad=graduatedModes[k];if(!layer)return;if(!cfg&&!grad){layer.setStyle(thematicStyles[k]);updatePointMarkers(layer,thematicStyles[k]);refreshLegend();return;}layer.eachLayer(child=>{if(!child.feature||!child.setStyle)return;const style=categoryStyle(k,child.feature);child.setStyle(style);if(child instanceof L.CircleMarker&&!(child instanceof L.Circle))child.setRadius(style.radius??7);});refreshLegend();}
function gradClassIndex(cfg,n){let i=cfg.breaks.findIndex(b=>n<=b);return i<0?cfg.breaks.length-1:i;}
function gradCounts(cfg,k){const counts=Array(cfg.breaks.length).fill(0);for(const f of featuresOf(dataByKey(k))){const n=numericValue(f.properties?.[cfg.field]);if(n!==null)counts[gradClassIndex(cfg,n)]++;}return counts;}
function gradUnit(cfg){return /(?:^|_)(?:KM2|KM²)(?:$|_)/i.test(cfg.field)||/AREA_KM2/i.test(cfg.field)?' km²':/\b(?:M2|M²)\b/i.test(cfg.field)?' m²':'';}
function gradLabel(cfg,i){const fmt=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:4});return (i===0?'≥ '+fmt(cfg.min):'> '+fmt(cfg.breaks[i-1]))+' a ≤ '+fmt(cfg.breaks[i])+gradUnit(cfg);}
function drawGraduatedControls(){const cfg=graduatedModes[activeQueryLayer];gradPanel.hidden=!cfg;if(!cfg){gradList.innerHTML='';gradStatus.textContent='';return;}gradField.value=cfg.field;if(cfg.method==='custom'&&![...gradMethod.options].some(o=>o.value==='custom'))gradMethod.add(new Option('Intervalos personalizados','custom'));gradMethod.value=cfg.method;gradCount.value=String(cfg.breaks.length);gradPalette.value=cfg.palette;const counts=gradCounts(cfg,activeQueryLayer);gradStatus.textContent=cfg.breaks.length+' classes · '+cfg.valid+' valores válidos · '+cfg.invalid+' sem valor numérico';gradList.innerHTML=cfg.breaks.map((upper,i)=>'<div class="grad-class-row"><input type="color" aria-label="Cor da classe '+(i+1)+'" data-grad-color="'+i+'" value="'+cfg.colors[i]+'"><label class="grad-class-label">'+esc(gradLabel(cfg,i))+' <small>'+counts[i]+' feições</small></label><label class="grad-bound-label">Limite superior <input type="number" step="any" data-grad-bound="'+i+'" value="'+upper+'"></label></div>').join('')+'<button type="button" class="panel-action primary" id="grad-apply-bounds">Aplicar intervalos</button><p id="grad-bound-error" class="geometry-hint" role="status"></p>';gradList.querySelectorAll('[data-grad-color]').forEach(input=>input.addEventListener('input',()=>{const current=graduatedModes[activeQueryLayer];if(!current)return;current.colors[Number(input.dataset.gradColor)]=input.value;applyCategoryRendering(activeQueryLayer);drawGraduatedControls();}));document.getElementById('grad-apply-bounds').onclick=()=>{const current=graduatedModes[activeQueryLayer];if(!current)return;const proposed=[...gradList.querySelectorAll('[data-grad-bound]')].map(el=>Number(el.value));const error=document.getElementById('grad-bound-error');if(proposed.some((v,i)=>!Number.isFinite(v)||!gradList.querySelector('[data-grad-bound="'+i+'"]').value.trim())||proposed.some((v,i)=>i===0?v<=current.min:v<=proposed[i-1])||proposed[proposed.length-1]<current.max){error.textContent='Informe limites crescentes; o primeiro deve superar o mínimo e o último deve abranger o maior valor.';return;}current.breaks=proposed;current.method='custom';if(![...gradMethod.options].some(o=>o.value==='custom'))gradMethod.add(new Option('Intervalos personalizados','custom'));gradMethod.value='custom';applyCategoryRendering(activeQueryLayer);drawGraduatedControls();};}
function buildGraduated(){const k=activeQueryLayer,field=gradField.value,fs=featuresOf(dataByKey(k)),values=fs.map(f=>numericValue(f.properties?.[field])).filter(n=>n!==null),count=Number(gradCount.value),method=gradMethod.value;if(!values.length||new Set(values).size<count){gradStatus.textContent='Valores numéricos distintos insuficientes para o número de classes escolhido.';return;}if(method==='jenks'&&values.length>3000){gradStatus.textContent='Jenks disponível para até 3.000 valores. Use intervalos iguais ou quantis nesta camada.';return;}const breaks=classifyBreaks(values,count,method==='custom'?'equal':method);if(!breaks){gradStatus.textContent='Não foi possível gerar classes distintas.';return;}const palette=gradPalette.value,source=gradPalettes[palette],colors=Array.from({length:count},(_,i)=>source[Math.round(i*(source.length-1)/(count-1))]);graduatedModes[k]={field,method,breaks,colors,palette,min:Math.min(...values),valid:values.length,invalid:fs.length-values.length,family:geometryFamily(dataByKey(k))};delete categoryModes[k];applyCategoryRendering(k);drawGraduatedControls();}
document.getElementById('prop-grad-generate').addEventListener('click',buildGraduated);
function drawCategoryControls(){const k=activeQueryLayer,cfg=categoryModes[k];renderMode.value=graduatedModes[k]?'graduated':cfg?'categorized':'simple';categoryPanel.hidden=!cfg;gradPanel.hidden=!graduatedModes[k];simpleControls.hidden=!!cfg||!!graduatedModes[k];if(!cfg){categoryList.innerHTML='';categoryStatus.textContent='';return;}categoryField.value=cfg.field;categoryStatus.textContent=cfg.values.length+' categorias · '+cfg.field;renderCategoryRows();}
function renderCategoryRows(){const cfg=categoryModes[activeQueryLayer];if(!cfg)return;const term=categorySearch.value.trim().toLocaleLowerCase('pt-BR');const matches=cfg.values.map((value,i)=>({value,i})).filter(x=>x.value.toLocaleLowerCase('pt-BR').includes(term));categoryList.innerHTML=matches.map(({value,i})=>'<label class="category-entry"><input type="color" data-category-index="'+i+'" value="'+cfg.colors[value]+'"><span class="category-value" title="'+esc(value)+'"><span class="legend-range">'+esc(value)+'</span><small class="legend-feature-count">'+(cfg.counts?.[value]??0)+' feições</small></span></label>').join('')||'<p>Nenhuma categoria encontrada.</p>';categoryList.querySelectorAll('input').forEach(input=>input.addEventListener('input',()=>{const current=categoryModes[activeQueryLayer];if(!current)return;current.colors[current.values[Number(input.dataset.categoryIndex)]]=input.value;applyCategoryRendering(activeQueryLayer);}));}
categorySearch.addEventListener('input',renderCategoryRows);
function buildCategories(){const k=activeQueryLayer,field=categoryField.value,fs=featuresOf(dataByKey(k));if(!field||!fs.length){categoryStatus.textContent='Selecione um campo com valores.';return;}const counts=new Map();for(const f of fs){const v=categoryKey(f.properties?.[field]);counts.set(v,(counts.get(v)||0)+1);}const values=[...counts.keys()].sort((a,b)=>a.localeCompare(b,'pt-BR',{numeric:true}));const prior=categoryModes[k];const colors=Object.fromEntries(values.map((v,i)=>[v,prior?.field===field&&prior.colors[v]?prior.colors[v]:categoryColors[i%categoryColors.length]]));delete graduatedModes[k];categoryModes[k]={field,values,colors,counts:Object.fromEntries(counts),family:geometryFamily(dataByKey(k))};categorySearch.value='';if(activeQueryLayer===k&&queryHighlight){clearQuery(true,false);savedLocalQueries.delete(k);}applyCategoryRendering(k);drawCategoryControls();}
renderMode.addEventListener('change',()=>{const k=activeQueryLayer;if(!k)return;const mode=renderMode.value;if(mode==='simple'){delete categoryModes[k];delete graduatedModes[k];applyCategoryRendering(k);drawCategoryControls();drawGraduatedControls();return;}if(mode==='graduated'){delete categoryModes[k];gradPanel.hidden=false;categoryPanel.hidden=true;simpleControls.hidden=true;gradStatus.textContent='Selecione um campo numérico e gere as classes.';if(graduatedModes[k])drawGraduatedControls();else applyCategoryRendering(k);return;}delete graduatedModes[k];categoryPanel.hidden=false;gradPanel.hidden=true;simpleControls.hidden=true;if(categoryModes[k])drawCategoryControls();else{categoryStatus.textContent='Selecione um campo e clique em Gerar categorias.';categoryList.innerHTML='';applyCategoryRendering(k);}});
document.getElementById('prop-category-generate').addEventListener('click',buildCategories);
function loadPropertyStyle(k){const s=thematicStyles[k];if(!s)return;propStyle.fillColor.value=s.fillColor||s.color||'#6eb8ad';propStyle.fillOpacity.value=s.fillOpacity??0;propStyle.color.value=s.color||'#123f3b';propStyle.weight.value=s.weight??1;propStyle.opacity.value=s.opacity??1;propStyle.dash.value=s.dashArray||'';updatePropertyStyleLabels();}
function applyPropertyStyle(){if(!activeQueryLayer||!thematicStyles[activeQueryLayer])return;const s=thematicStyles[activeQueryLayer];s.fillColor=propStyle.fillColor.value;s.fillOpacity=Number(propStyle.fillOpacity.value);s.color=propStyle.color.value;s.weight=Number(propStyle.weight.value);s.opacity=Number(propStyle.opacity.value);s.dashArray=propStyle.dash.value||null;const layer=thematicLayerByKey(activeQueryLayer);if(layer){layer.setStyle(s);updatePointMarkers(layer,s);}if(categoryModes[activeQueryLayer]||graduatedModes[activeQueryLayer])applyCategoryRendering(activeQueryLayer);updatePropertyStyleLabels();refreshLegend();}
async function openProperties(k){clearQuery(true);closeAttributeGrid();document.body.classList.add('properties-open');activeQueryLayer=k;let layer=thematicLayerByKey(k);if(!layer){try{layer=k==='maranhao'?await loadMaranhao():k==='municipios'?await loadMunicipios():k==='sedes'?await loadSedes():k==='drenagem'?await loadDrenagem():null;}catch(_){return;}}const data=dataByKey(k),fs=featuresOf(data),meta={...layerMeta[k],name:localLayers.has(k)?localLayers.get(k).name:layerMeta[k].name,type:localLayers.has(k)?'GeoJSON':layerMeta[k].type,source:localLayers.has(k)?'Arquivo local — Laboratório GeoJSON':layerMeta[k].source},cb=checkboxByKey(k);const visible=localLayers.has(k)?map.hasLayer(localLayers.get(k).layer):!!cb?.checked;propSummary.innerHTML='<div class="property-row"><span>Camada</span><strong>'+esc(meta.name)+'</strong></div><div class="property-row"><span>Tipo</span><strong>'+esc(geometryType(data)||meta.type)+'</strong></div><div class="property-row"><span>Feições</span><strong>'+fs.length.toLocaleString('pt-BR')+'</strong></div><div class="property-row"><span>Visível</span><strong>'+(visible?'Sim':'Não')+'</strong></div><div class="property-row"><span>Fonte</span><strong>'+esc(meta.source)+'</strong></div>';const fields=[...new Set(fs.flatMap(f=>Object.keys(f.properties||{})))];queryField.innerHTML=fields.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');const savedQuery=savedLocalQueries.get(k);if(savedQuery&&fields.includes(savedQuery.field)){queryField.value=savedQuery.field;queryOperator.value=savedQuery.operator;queryValue.value=savedQuery.value;}else queryValue.value='';queryStatus.textContent='Nenhuma consulta aplicada.';queryResults.innerHTML='';document.querySelectorAll('.floating-panel').forEach(x=>x.classList.remove('open'));document.querySelectorAll('.tool-btn[data-panel]').forEach(x=>x.classList.remove('panel-active'));loadPropertyStyle(k);configureGeometryStyle(k);categorySearch.value='';gradField.innerHTML=fields.filter(field=>fs.some(f=>numericValue(f.properties?.[field])!==null)&&fs.every(f=>f.properties?.[field]===null||f.properties?.[field]===undefined||f.properties?.[field]===''||numericValue(f.properties?.[field])!==null)).map(field=>'<option value="'+esc(field)+'">'+esc(field)+'</option>').join('');categoryField.innerHTML=fields.map(x=>'<option value="'+esc(x)+'">'+esc(x)+'</option>').join('');drawCategoryControls();drawGraduatedControls();propPanel.classList.add('open');if(savedQuery&&fields.includes(savedQuery.field))applyQuery({preserveView:true});}
function compareValue(raw,op,term){if(op==='contains')return String(raw??'').toLocaleLowerCase('pt-BR').includes(String(term).toLocaleLowerCase('pt-BR'));if(op==='eq'||op==='neq'){const a=String(raw??'').trim().toLocaleLowerCase('pt-BR'),b=String(term).trim().toLocaleLowerCase('pt-BR');return op==='eq'?a===b:a!==b;}const a=Number(raw),b=Number(term);if(!Number.isFinite(a)||!Number.isFinite(b))return false;return op==='gt'?a>b:a<b;}
function showFeatureResult(f){if(queryHighlight&&map.hasLayer(queryHighlight))map.removeLayer(queryHighlight);queryHighlight=L.geoJSON(f,{pane:'geo-selection',renderer:geoRenderers.selection,style:{color:'#ff7a00',weight:3.5,opacity:1,fillColor:'#2f80ed',fillOpacity:.34},pointToLayer:(ft,ll)=>L.circleMarker(ll,{pane:'geo-selection',renderer:geoRenderers.selection,radius:9,color:'#ff7a00',weight:3,fillColor:'#2f80ed',fillOpacity:.8}),onEachFeature:(ft,l)=>bindModeAwarePopup(l,genericPopup(ft.properties||{}))}).addTo(map);const b=queryHighlight.getBounds();if(b.isValid())map.fitBounds(b,{padding:[45,45],maxZoom:14});queryResults.innerHTML=renderAttributes(f);}
function applyQuery(options={}){if(!activeQueryLayer)return;const data=dataByKey(activeQueryLayer),field=queryField.value,op=queryOperator.value,term=queryValue.value;if(!term.trim()){queryStatus.textContent='Informe um valor para realizar a consulta.';queryStatus.className='lab-status error';return;}const matches=featuresOf(data).filter(f=>compareValue((f.properties||{})[field],op,term));if(localLayers.has(activeQueryLayer))savedLocalQueries.set(activeQueryLayer,{field,operator:op,value:term});if(queryHighlight&&map.hasLayer(queryHighlight))map.removeLayer(queryHighlight);queryHighlight=null;const original=thematicLayerByKey(activeQueryLayer);if(matches.length&&original&&map.hasLayer(original))map.removeLayer(original);queryStatus.textContent=matches.length?matches.length+' feição(ões) encontrada(s).':'Nenhuma feição encontrada.';queryStatus.className=matches.length?'lab-status success':'lab-status error';if(!matches.length){queryResults.innerHTML='';return;}queryHighlight=L.geoJSON({type:'FeatureCollection',features:matches},{pane:'geo-selection',renderer:geoRenderers.selection,style:{color:'#ff7a00',weight:3.5,opacity:1,fillColor:'#2f80ed',fillOpacity:.34},pointToLayer:(f,ll)=>L.circleMarker(ll,{pane:'geo-selection',renderer:geoRenderers.selection,radius:9,color:'#ff7a00',weight:3,fillColor:'#2f80ed',fillOpacity:.8}),onEachFeature:(f,l)=>bindModeAwarePopup(l,genericPopup(f.properties||{}))}).addTo(map);const b=queryHighlight.getBounds();if(b.isValid()&&!options.preserveView)map.fitBounds(b,{padding:[45,45],maxZoom:14});if(matches.length===1){queryResults.innerHTML=renderAttributes(matches[0]);}else{queryResults.innerHTML='<h3>Resultados</h3><div class="query-count">'+matches.length+' feições selecionadas</div>'+matches.map((f,i)=>'<button class="result-item" data-result-index="'+i+'">'+esc(featureLabel(f,i))+'</button>').join('')+'<button id="zoom-query-results" class="panel-action zoom-results">Zoom para todos</button>';queryResults.querySelectorAll('.result-item').forEach(btn=>btn.onclick=()=>showFeatureResult(matches[Number(btn.dataset.resultIndex)]));document.getElementById('zoom-query-results').onclick=()=>{if(queryHighlight){const b=queryHighlight.getBounds();if(b.isValid())map.fitBounds(b,{padding:[45,45],maxZoom:14});}};}}
document.querySelectorAll('.properties-btn').forEach(b=>b.addEventListener('click',()=>openProperties(b.dataset.propertiesLayer)));
Object.values(propStyle).forEach(el=>el.addEventListener('input',applyPropertyStyle));
propPointSize.addEventListener('input',()=>{if(!activeQueryLayer)return;const s=thematicStyles[activeQueryLayer];s.radius=Number(propPointSize.value);document.getElementById('prop-point-size-value').textContent=s.radius+' px';updatePointMarkers(thematicLayerByKey(activeQueryLayer),s);refreshLegend();});
document.getElementById('prop-style-reset').onclick=()=>{if(!activeQueryLayer)return;thematicStyles[activeQueryLayer]=activeQueryLayer==='drenagem'?{color:'#2585bd',weight:1.2,opacity:.85,dashArray:''}:activeQueryLayer==='sedes'?{color:'#145c69',weight:1.5,opacity:1,fillColor:'#ffbd4a',fillOpacity:.9,dashArray:'',radius:6}:localLayers.has(activeQueryLayer)?{color:localPalette[(Number(activeQueryLayer.split('-')[1])-1)%localPalette.length],weight:2,opacity:1,fillColor:localPalette[(Number(activeQueryLayer.split('-')[1])-1)%localPalette.length],fillOpacity:.25,dashArray:'',radius:7}:{...defaultStyles[activeQueryLayer]};const layer=thematicLayerByKey(activeQueryLayer);if(layer){layer.setStyle(thematicStyles[activeQueryLayer]);updatePointMarkers(layer,thematicStyles[activeQueryLayer]);}loadPropertyStyle(activeQueryLayer);configureGeometryStyle(activeQueryLayer);refreshLegend();};
attributeToggle.onclick=()=>{if(attributeTableWrap.hidden){renderAttributeGrid();attributeTableWrap.hidden=false;attributeToggle.textContent='Fechar tabela';}else closeAttributeGrid();};
document.getElementById('query-apply').onclick=applyQuery;
document.getElementById('query-clear').onclick=()=>{if(activeQueryLayer)savedLocalQueries.delete(activeQueryLayer);queryValue.value='';clearQuery(true,true);};
queryValue.addEventListener('keydown',e=>{if(e.key==='Enter')applyQuery();});
queryField.addEventListener('change',()=>{const fs=featuresOf(dataByKey(activeQueryLayer)),sample=fs.map(f=>(f.properties||{})[queryField.value]).find(v=>v!==null&&v!==undefined&&v!=='');const numeric=sample!==undefined&&!Number.isNaN(Number(sample));[...queryOperator.options].forEach(o=>{if(o.value==='gt'||o.value==='lt')o.disabled=!numeric;});if(!numeric&&(queryOperator.value==='gt'||queryOperator.value==='lt'))queryOperator.value='contains';});

/* Integração do Laboratório ao motor vetorial — consolidado v1.7.0 */
document.getElementById('lab-properties').onclick=()=>{if(localGeojson)openProperties([...localLayers.keys()].at(-1));};


/* v2.5.5 — teclado e gerenciamento de foco em janelas e painéis. */
(()=>{
 const dialogPairs=[['btn-geoai','modal','modal-close'],['btn-info','info-modal','info-modal-close']];
 const focusable='button:not([disabled]),a[href],input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
 const visible=el=>el.getClientRects().length>0;
 dialogPairs.forEach(([triggerId,dialogId,closeId])=>{
  const trigger=document.getElementById(triggerId),dialog=document.getElementById(dialogId),close=document.getElementById(closeId);
  if(!trigger||!dialog||!close)return;
  trigger.addEventListener('click',()=>{requestAnimationFrame(()=>{if(!dialog.hidden)close.focus({preventScroll:true});});});
  const restore=()=>{if(dialog.hidden)trigger.focus({preventScroll:true});};
  close.addEventListener('click',restore);
  dialog.addEventListener('click',e=>{if(e.target===dialog)restore();});
  dialog.addEventListener('keydown',e=>{
   if(e.key!=='Tab')return;
   const nodes=[...dialog.querySelectorAll(focusable)].filter(visible);
   if(!nodes.length){e.preventDefault();return;}
   const first=nodes[0],last=nodes[nodes.length-1];
   if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}
  });
 });
 document.addEventListener('keydown',e=>{
  if(e.key!=='Escape'||e.defaultPrevented)return;
  const openedDialog=dialogPairs.find(([,id])=>!document.getElementById(id).hidden);
  if(openedDialog){e.preventDefault();document.getElementById(openedDialog[1]).hidden=true;document.getElementById(openedDialog[0]).focus({preventScroll:true});return;}
  const panel=[...document.querySelectorAll('.floating-panel.open')].reverse().find(visible);
  if(!panel)return;
  e.preventDefault();panel.classList.remove('open');
  if(panel.id==='panel-properties')document.body.classList.remove('properties-open');
  const trigger=document.querySelector('.tool-btn[data-panel="'+panel.id+'"]');
  document.querySelectorAll('.tool-btn[data-panel]').forEach(btn=>btn.classList.remove('panel-active'));
  if(trigger)trigger.focus({preventScroll:true});
 });
 document.querySelectorAll('.tool-btn[data-panel]').forEach(btn=>btn.addEventListener('click',()=>{
  const panel=document.getElementById(btn.dataset.panel);
  btn.setAttribute('aria-expanded',String(!!panel?.classList.contains('open')));
  document.querySelectorAll('.tool-btn[data-panel]').forEach(other=>{if(other!==btn)other.setAttribute('aria-expanded','false');});
 }));
 document.querySelectorAll('.panel-close').forEach(close=>close.addEventListener('click',()=>{
  const panel=close.closest('.floating-panel');
  const trigger=panel&&document.querySelector('.tool-btn[data-panel="'+panel.id+'"]');
  if(trigger){trigger.setAttribute('aria-expanded','false');trigger.focus({preventScroll:true});}
 }));
})();

/* v2.5.6 — foco previsível nos painéis cartográficos, sem modificar o layout. */
(()=>{
 const triggers=[...document.querySelectorAll('.tool-btn[data-panel]')];
 const panelOf=button=>document.getElementById(button.dataset.panel);
 const visible=element=>!!element&&element.getClientRects().length>0;
 const sync=()=>{
  triggers.forEach(button=>{
   const panel=panelOf(button);
   button.setAttribute('aria-expanded',String(!!panel?.classList.contains('open')));
  });
 };
 triggers.forEach(button=>{
  button.setAttribute('aria-controls',button.dataset.panel);
  button.setAttribute('aria-expanded',String(!!panelOf(button)?.classList.contains('open')));
  button.addEventListener('click',()=>{
   sync();
   const panel=panelOf(button);
   if(panel?.classList.contains('open')){
    requestAnimationFrame(()=>{
     if(panel.classList.contains('open')){
      const close=panel.querySelector('.panel-close');
      if(visible(close))close.focus({preventScroll:true});
     }
    });
   }
  });
 });
 document.querySelectorAll('.floating-panel').forEach(panel=>{
  const heading=panel.querySelector('h2');
  if(heading){
   if(!heading.id)heading.id=panel.id+'-title';
   panel.setAttribute('role','region');
   panel.setAttribute('aria-labelledby',heading.id);
  }
  const close=panel.querySelector('.panel-close');
  if(close)close.addEventListener('click',()=>requestAnimationFrame(sync));
 });
 document.querySelectorAll('.properties-btn').forEach(button=>button.addEventListener('click',()=>{
  const panel=document.getElementById('panel-properties');
  if(!panel)return;
  requestAnimationFrame(()=>{
   sync();
   if(panel.classList.contains('open'))panel.querySelector('.panel-close')?.focus({preventScroll:true});
  });
 }));
 document.addEventListener('keydown',event=>{
  if(event.key!=='Escape')return;
  requestAnimationFrame(sync);
 });
})();


/* v2.8.0 — projetos portáteis do WebGIS (independentes do compositor). */
(()=>{
 const status=document.getElementById('lab-project-status'),input=document.getElementById('lab-project-file');
 const layerChecks={maranhao:maranhaoCheckbox,municipios:municipiosCheckbox,sedes:sedesCheckbox,drenagem:drenagemCheckbox,campus:document.getElementById('layer-campus')};
 const message=(value,error=false)=>{status.textContent=value;status.className='lab-status '+(error?'error':'success');};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const validGeoJSON=data=>data&&['FeatureCollection','Feature','Point','MultiPoint','LineString','MultiLineString','Polygon','MultiPolygon','GeometryCollection'].includes(data.type);
 const styleFields=['color','weight','opacity','fillColor','fillOpacity','dashArray','radius'];
 function safeStyle(raw,fallback){
  const result={...fallback};
  if(!raw||typeof raw!=='object')return result;
  for(const field of styleFields){
   const value=raw[field];
   if(['color','fillColor'].includes(field)){if(typeof value==='string'&&/^#[0-9a-f]{3,8}$/i.test(value))result[field]=value;}
   else if(field==='dashArray'){if(typeof value==='string'&&/^[0-9, .]{0,60}$/.test(value))result[field]=value;}
   else if(Number.isFinite(value)&&value>=0&&value<=100)result[field]=value;
  }
  return result;
 }
 document.getElementById('lab-save-project').onclick=()=>{
  try{
   const center=map.getCenter();
   const snapshot={format:'geoedu-webgis-project',schema:1,createdAt:new Date().toISOString(),
    view:{center:[center.lat,center.lng],zoom:map.getZoom()},
    basemap:Object.keys(basemaps).find(key=>basemaps[key]===currentBasemap)||'sentinel',
    thematic:Object.fromEntries(Object.entries(layerChecks).map(([key,el])=>[key,!!el?.checked])),
    styles:Object.fromEntries(Object.entries(thematicStyles).filter(([key])=>!key.startsWith('local-')).map(([key,value])=>[key,clone(value)])),
    local:[...localLayers].map(([key,item])=>({name:item.name,data:item.data,visible:map.hasLayer(item.layer),style:clone(thematicStyles[key]),category:categoryModes[key]?clone(categoryModes[key]):null,graduated:graduatedModes[key]?clone(graduatedModes[key]):null,query:savedLocalQueries.has(key)?clone(savedLocalQueries.get(key)):null}))
   };
   const blob=new Blob([JSON.stringify(snapshot)],{type:'application/json'});
   const url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download='geoedu-projeto-'+new Date().toISOString().slice(0,10)+'.geoedu';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
   message('Projeto preparado para download: '+snapshot.local.length+' camada(s) GeoJSON.');
  }catch(error){console.error(error);message('Não foi possível salvar o projeto.',true);}
 };
 document.getElementById('lab-open-project').onclick=()=>input.click();
 input.addEventListener('change',async()=>{
  const file=input.files?.[0];input.value='';if(!file)return;
  try{
   if(file.size>80*1024*1024)throw Error('O arquivo de projeto excede 80 MB.');
   const project=JSON.parse(await file.text());
   if(project?.format!=='geoedu-webgis-project'||project.schema!==1||!Array.isArray(project.local))throw Error('Formato de projeto não reconhecido.');
   if(project.local.length>50)throw Error('Limite de 50 camadas por projeto.');
   for(const item of project.local){if(!validGeoJSON(item.data)||typeof item.name!=='string')throw Error('Camada GeoJSON inválida no projeto.');}
   const center=project.view?.center,zoom=project.view?.zoom;
   if(!Array.isArray(center)||center.length!==2||!center.every(Number.isFinite)||Math.abs(center[0])>90||Math.abs(center[1])>180||!Number.isFinite(zoom)||zoom<0||zoom>19)throw Error('Enquadramento inválido.');
   if(!confirm('Abrir este projeto substituirá as camadas GeoJSON locais atuais. Deseja continuar?'))return;
   clearLocal();
   for(const item of project.local){
    const key='local-'+(++localSequence),family=localPane(item.data);
    const fallback={color:'#a35f16',weight:2,opacity:1,fillColor:'#d79a52',fillOpacity:.25,dashArray:'',radius:7};
    const style=safeStyle(item.style,fallback);thematicStyles[key]=style;
    const layer=L.geoJSON(item.data,{pane:'geo-'+family,renderer:geoRenderers[family],style:()=>style,pointToLayer:(f,ll)=>L.circleMarker(ll,{pane:'geo-point',renderer:geoRenderers.point,radius:style.radius,color:style.color,weight:style.weight,opacity:style.opacity,fillColor:style.fillColor,fillOpacity:style.fillOpacity}),onEachFeature:(f,l)=>bindModeAwarePopup(l,genericPopup(f.properties||{}))});
    localLayers.set(key,{name:item.name.slice(0,250),data:item.data,layer});
    if(item.category&&typeof item.category.field==='string'&&Array.isArray(item.category.values)&&item.category.colors&&typeof item.category.colors==='object')categoryModes[key]=item.category;
    if(item.graduated&&typeof item.graduated.field==='string'&&Array.isArray(item.graduated.breaks)&&Array.isArray(item.graduated.colors))graduatedModes[key]=item.graduated;
    if(categoryModes[key]||graduatedModes[key])applyCategoryRendering(key);
    if(item.visible)layer.addTo(map);
    if(item.query&&typeof item.query.field==='string'&&['eq','neq','gt','lt','contains'].includes(item.query.operator)&&typeof item.query.value==='string')savedLocalQueries.set(key,item.query);
   }
   for(const [key,checked] of Object.entries(project.thematic||{})){
    const control=layerChecks[key];if(control&&control.checked!==!!checked){control.checked=!!checked;control.dispatchEvent(new Event('change',{bubbles:true}));}
   }
   for(const [key,value] of Object.entries(project.styles||{})){
    if(thematicStyles[key]&&!key.startsWith('local-')){Object.assign(thematicStyles[key],safeStyle(value,thematicStyles[key]));const layer=thematicLayerByKey(key);if(layer){layer.setStyle(thematicStyles[key]);updatePointMarkers(layer,thematicStyles[key]);}}
   }
   if(typeof project.basemap==='string'&&basemaps[project.basemap]){
    const radio=document.querySelector('input[name="basemap"][value="'+project.basemap+'"]');
    if(radio){radio.checked=true;radio.dispatchEvent(new Event('change',{bubbles:true}));}
   }
   map.setView(center,zoom);renderLocalList();refreshLegend();
   message('Projeto aberto: '+project.local.length+' camada(s) GeoJSON. Simbologia e critérios de consulta recuperados. Abra Propriedades para reativar a seleção.');
  }catch(error){console.error(error);message('Projeto não aberto: '+error.message,true);}
 });
})();


/* GeoEdu temporal module v2.9.5 — local GeoJSON temporal exploration */
(function(){
 const css=document.createElement('style');
 css.textContent=`#geoedu-temporal-toggle{position:fixed;left:17px;bottom:112px;z-index:1100;background:#145b57;color:#fff;border:1px solid #a6d5ce;border-radius:7px;padding:9px;cursor:pointer;box-shadow:0 2px 8px #0005}#geoedu-temporal-panel{position:fixed;left:68px;bottom:48px;z-index:1090;width:min(365px,calc(100vw - 85px));max-height:calc(100vh - 165px);overflow:auto;background:#edf6f4;color:#254744;padding:16px;border-radius:13px;box-shadow:0 4px 18px #0005;font:13px Arial,sans-serif}#geoedu-temporal-panel[hidden]{display:none}#geoedu-temporal-panel label{display:block;margin:10px 0 4px;font-weight:600}#geoedu-temporal-panel select,#geoedu-temporal-panel input[type=range]{width:100%}#geoedu-temporal-panel select{padding:7px;border:1px solid #b5ceca;border-radius:5px;background:white}#geoedu-temporal-panel button{padding:7px 10px;border:1px solid #9abbb5;background:white;border-radius:5px;cursor:pointer}#geoedu-temporal-panel button:focus-visible,#geoedu-temporal-toggle:focus-visible{outline:3px solid #ffc857}#geoedu-temporal-panel .temporal-controls{display:flex;gap:6px;flex-wrap:wrap;margin-top:12px}#geoedu-temporal-panel .temporal-metrics{background:#dcece8;padding:10px;border-radius:7px;margin-top:10px}#geoedu-temporal-panel .temporal-heading{display:flex;align-items:center;justify-content:space-between}#geoedu-temporal-panel .temporal-heading strong{font-size:15px}#geoedu-temporal-panel .temporal-chart{display:flex;align-items:end;gap:4px;height:106px;padding:10px 3px 0;border-bottom:1px solid #a8c7c0;margin-top:12px}#geoedu-temporal-panel .temporal-bar-wrap{flex:1;min-width:0;display:flex;flex-direction:column;align-items:center;justify-content:end;height:100%;gap:4px}#geoedu-temporal-panel .temporal-bar{width:100%;max-width:36px;min-height:2px;border:0;border-radius:3px 3px 0 0;background:#23887d;padding:0;cursor:pointer}#geoedu-temporal-panel .temporal-bar[aria-current=true]{background:#e18a39;outline:2px solid #a85c16}#geoedu-temporal-panel .temporal-bar-label{font-size:10px;color:#254744}#geoedu-temporal-panel .temporal-metrics strong{font-size:16px}#geoedu-temporal-panel .temporal-note{font-size:11px;color:#486962;margin-top:7px}@media(max-width:600px){#geoedu-temporal-toggle{bottom:92px;left:10px}#geoedu-temporal-panel{left:54px;bottom:35px}}`;
 document.head.appendChild(css);
 const btn=document.createElement('button');btn.id='geoedu-temporal-toggle';btn.type='button';btn.textContent='◷';btn.title='Análise temporal';btn.setAttribute('aria-label','Abrir análise temporal');btn.setAttribute('aria-expanded','false');document.body.appendChild(btn);
 const panel=document.createElement('section');panel.id='geoedu-temporal-panel';panel.hidden=true;panel.setAttribute('role','region');panel.setAttribute('aria-label','Análise temporal');panel.innerHTML='<div class="temporal-heading"><strong>Análise temporal</strong><button type="button" id="temporal-close" aria-label="Fechar análise temporal">×</button></div><p>Explore a evolução espacial diretamente no mapa.</p><label for="temporal-layer">Camada GeoJSON</label><select id="temporal-layer"></select><label for="temporal-field">Campo temporal</label><select id="temporal-field"></select><label for="temporal-mode">Visualização</label><select id="temporal-mode"><option value="year">Ano individual</option><option value="cumulative">Acumulado até o ano</option></select><label for="temporal-year">Período: <strong id="temporal-year-label">—</strong></label><input id="temporal-year" type="range" min="0" max="0" value="0" step="1"><div class="temporal-controls"><button type="button" id="temporal-prev">← Anterior</button><button type="button" id="temporal-play">▶ Reproduzir</button><button type="button" id="temporal-next">Próximo →</button></div><div class="temporal-metrics" id="temporal-metrics" role="status" aria-live="polite">Selecione uma camada.</div><div class="temporal-chart" id="temporal-chart" role="group" aria-label="Gráfico temporal interativo"></div><div class="temporal-note" id="temporal-note"></div><div class="temporal-controls"><button type="button" id="temporal-reset">Mostrar todas as feições</button></div>';
 document.body.appendChild(panel);
 const el=id=>document.getElementById(id);
 const layerSel=el('temporal-layer'),fieldSel=el('temporal-field'),modeSel=el('temporal-mode'),yearInput=el('temporal-year'),yearLabel=el('temporal-year-label'),metrics=el('temporal-metrics');
 let selectedKey='',allChildren=[],activeGroup=null,years=[],timer=null,filtered=false;
 const temporalValue=v=>{if(v===null||v===undefined||v==='')return null;const s=String(v).trim();if(/^\d{4}$/.test(s))return +s;const match=s.match(/^(\d{4})[-/]\d{1,2}[-/]\d{1,2}/);return match?+match[1]:null;};
 function stop(){if(timer!==null){clearInterval(timer);timer=null;}el('temporal-play').textContent='▶ Reproduzir';}
 function restore(){stop();if(activeGroup&&allChildren.length){for(const child of allChildren)if(!activeGroup.hasLayer(child))activeGroup.addLayer(child);}allChildren=[];activeGroup=null;filtered=false;if(selectedKey&&categoryModes[selectedKey]||selectedKey&&graduatedModes[selectedKey])applyCategoryRendering(selectedKey);refreshLegend();}
 function keys(){return [...localLayers.entries()].filter(([,v])=>featuresOf(v.data).length).map(([k,v])=>[k,v.name]);}
 function populateLayers(){const previous=selectedKey;const items=keys();layerSel.innerHTML=items.length?items.map(([k,n])=>'<option value="'+esc(k)+'">'+esc(n)+'</option>').join(''):'<option value="">Importe um GeoJSON</option>';selectedKey=items.some(([k])=>k===previous)?previous:(items[0]?.[0]||'');layerSel.value=selectedKey;populateFields();}
 function populateFields(){const data=localLayers.get(selectedKey)?.data;const fs=featuresOf(data);const counts=new Map();for(const f of fs.slice(0,2000)){for(const [key,val] of Object.entries(f.properties||{})){if(temporalValue(val)!==null)counts.set(key,(counts.get(key)||0)+1);}}const fields=[...counts.keys()].sort((a,b)=>((/^(year|ano)$/i.test(b)?10000:0)+counts.get(b))-((/^(year|ano)$/i.test(a)?10000:0)+counts.get(a)));fieldSel.innerHTML=fields.length?fields.map(f=>'<option value="'+esc(f)+'">'+esc(f)+'</option>').join(''):'<option value="">Sem campo temporal</option>';fieldSel.value=fields[0]||'';prepare();}
 function prepare(){stop();if(filtered)restore();const fs=featuresOf(localLayers.get(selectedKey)?.data);years=[...new Set(fs.map(f=>temporalValue(f.properties?.[fieldSel.value])).filter(v=>v!==null))].sort((a,b)=>a-b);yearInput.min=0;yearInput.max=Math.max(0,years.length-1);yearInput.value=0;render();}
 function render(){const item=localLayers.get(selectedKey);if(!item||!years.length){yearLabel.textContent='—';metrics.textContent='Selecione uma camada com campo de ano ou data.';el('temporal-chart').innerHTML='';el('temporal-note').textContent='';return;}const y=years[+yearInput.value]??years[0];yearLabel.textContent=modeSel.value==='cumulative'?years[0]+'–'+y:String(y);if(!filtered){activeGroup=item.layer;allChildren=activeGroup.getLayers().slice();filtered=true;}if(activeGroup!==item.layer){restore();activeGroup=item.layer;allChildren=activeGroup.getLayers().slice();filtered=true;}let count=0;for(const child of allChildren){const cy=temporalValue(child.feature?.properties?.[fieldSel.value]);const show=cy!==null&&(modeSel.value==='cumulative'?cy<=y:cy===y);if(show){count++;if(!activeGroup.hasLayer(child))activeGroup.addLayer(child);}else if(activeGroup.hasLayer(child))activeGroup.removeLayer(child);}if(categoryModes[selectedKey]||graduatedModes[selectedKey])applyCategoryRendering(selectedKey);updateDashboard(featuresOf(item.data),y);refreshLegend();document.dispatchEvent(new CustomEvent('geoedu:temporal-update',{detail:{key:selectedKey,field:fieldSel.value,year:y,years:years.slice(),mode:modeSel.value,features:featuresOf(item.data)}}));}
 
 // Área geodésica aproximada na esfera WGS84; válida para polígonos GeoJSON lon/lat.
 const earthRadius=6371008.8; // raio médio terrestre IUGG, consistente com o painel de indicadores
 function ringArea(ring){if(!Array.isArray(ring)||ring.length<3)return 0;let sum=0;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(!Array.isArray(a)||!Array.isArray(b))continue;let delta=(Number(b[0])-Number(a[0]))*Math.PI/180;if(delta>Math.PI)delta-=2*Math.PI;if(delta< -Math.PI)delta+=2*Math.PI;sum+=delta*(2+Math.sin(Number(a[1])*Math.PI/180)+Math.sin(Number(b[1])*Math.PI/180));}return Math.abs(sum*earthRadius*earthRadius/2);}
 function polygonArea(rings){if(!rings?.length)return 0;return Math.max(0,ringArea(rings[0])-rings.slice(1).reduce((s,r)=>s+ringArea(r),0));}
 function geometryArea(g){if(!g)return 0;if(g.type==='Polygon')return polygonArea(g.coordinates);if(g.type==='MultiPolygon')return (g.coordinates||[]).reduce((s,p)=>s+polygonArea(p),0);if(g.type==='GeometryCollection')return(g.geometries||[]).reduce((s,v)=>s+geometryArea(v),0);return 0;}
 const formatNumber=n=>n.toLocaleString('pt-BR',{maximumFractionDigits:2});
 function updateDashboard(fs,year){const field=fieldSel.value;const annual=years.map(y=>{const group=fs.filter(f=>temporalValue(f.properties?.[field])===y);return {year:y,count:group.length,area:group.reduce((s,f)=>s+geometryArea(f.geometry)/1e6,0)};});const current=annual.find(v=>v.year===year);const index=annual.findIndex(v=>v.year===year);const previous=index>0?annual[index-1]:null;const accumulated=annual.slice(0,index+1).reduce((s,v)=>({count:s.count+v.count,area:s.area+v.area}),{count:0,area:0});const selected=modeSel.value==='cumulative'?accumulated:current;const percent=previous&&previous.area>0?((current.area/previous.area-1)*100):null;const isArea=fs.some(f=>geometryArea(f.geometry)>0);metrics.innerHTML='<div><strong>'+formatNumber(selected.count)+'</strong> feições exibidas ('+(modeSel.value==='cumulative'?'acumulado':'ano individual')+')</div>'+(isArea?'<div>Área do ano: <strong>'+formatNumber(current.area)+'</strong> km²</div><div>Área acumulada até '+year+': <strong>'+formatNumber(accumulated.area)+'</strong> km²</div><div>Área atualmente exibida: <strong>'+formatNumber(selected.area)+'</strong> km²</div>':'<div>Área: geometria não poligonal</div>')+'<div>Variação anual de área: '+(isArea&&percent!==null?(percent>0?'+':'')+formatNumber(percent)+'%':'não disponível')+'</div>';const max=Math.max(1,...annual.map(v=>isArea?v.area:v.count));const chart=el('temporal-chart');chart.innerHTML=annual.map(v=>'<div class="temporal-bar-wrap"><button type="button" class="temporal-bar" data-temporal-year="'+v.year+'" aria-label="Selecionar '+v.year+'" aria-current="'+(v.year===year)+'" title="'+v.year+': '+formatNumber(isArea?v.area:v.count)+(isArea?' km²':' feições')+'" style="height:'+Math.max(2,Math.round((isArea?v.area:v.count)/max*78))+'px"></button><span class="temporal-bar-label">'+v.year+'</span></div>').join('');chart.querySelectorAll('[data-temporal-year]').forEach(b=>b.onclick=()=>{stop();modeSel.value='year';yearInput.value=years.indexOf(Number(b.dataset.temporalYear));render();});el('temporal-note').textContent=(isArea?'Gráfico: área anual estimada (km²). Cálculo geodésico aproximado com coordenadas WGS84; polígonos sobrepostos podem duplicar áreas.':'Gráfico: quantidade anual de feições.')+' Clique em uma barra para filtrar o mapa.';}
 function toggle(open){if(!open){restore();panel.hidden=true;btn.setAttribute('aria-expanded','false');btn.focus();return;}panel.hidden=false;btn.setAttribute('aria-expanded','true');populateLayers();layerSel.focus();}
 btn.onclick=()=>toggle(panel.hidden);el('temporal-close').onclick=()=>toggle(false);
 layerSel.onchange=()=>{restore();selectedKey=layerSel.value;populateFields();};
 fieldSel.onchange=prepare;modeSel.onchange=render;yearInput.oninput=render;
 el('temporal-prev').onclick=()=>{stop();yearInput.value=Math.max(0,+yearInput.value-1);render();};
 el('temporal-next').onclick=()=>{stop();yearInput.value=Math.min(years.length-1,+yearInput.value+1);render();};
 el('temporal-play').onclick=()=>{if(timer!==null){stop();return;}if(years.length<2)return;el('temporal-play').textContent='Ⅱ Pausar';timer=setInterval(()=>{yearInput.value=(+yearInput.value+1)%years.length;render();},1200);};
 el('temporal-reset').onclick=()=>{restore();metrics.textContent='Todas as feições restauradas.';el('temporal-chart').innerHTML='';el('temporal-note').textContent='';document.dispatchEvent(new Event('geoedu:temporal-reset'));};
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden){e.stopPropagation();toggle(false);}},true);
 window.GeoEduTemporal={close:()=>{if(!panel.hidden)toggle(false);},refresh:()=>{if(!panel.hidden){restore();populateLayers();}}};
})();

/* GeoEdu temporal indicators v2.9.5 — chart and geodesic area */
(function(){
 const css=document.createElement('style');
 css.textContent=`#geoedu-temporal-panel{width:min(420px,calc(100vw - 85px))}#geoedu-temporal-dashboard{margin-top:12px;border-top:1px solid #bad2cc;padding-top:12px}#geoedu-temporal-dashboard[hidden]{display:none}#geoedu-temporal-dashboard .geoedu-stat-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px}#geoedu-temporal-dashboard .geoedu-stat{background:#fff;border:1px solid #cbded9;border-radius:8px;padding:9px}#geoedu-temporal-dashboard .geoedu-stat span{display:block;font-size:11px;color:#4b6d68}#geoedu-temporal-dashboard .geoedu-stat strong{font-size:17px}#geoedu-temporal-dashboard .geoedu-chart{display:flex;align-items:end;gap:5px;height:112px;padding-top:10px;border-bottom:1px solid #93b2ab}#geoedu-temporal-dashboard .geoedu-chart button{flex:1;min-width:0;height:100%;padding:0 2px;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;background:transparent;border:0;gap:3px}#geoedu-temporal-dashboard .geoedu-chart button .geoedu-bar{width:100%;max-width:48px;min-height:2px;background:#388f84;border-radius:3px 3px 0 0}#geoedu-temporal-dashboard .geoedu-chart button[aria-pressed=true] .geoedu-bar{background:#db8b37}#geoedu-temporal-dashboard .geoedu-chart button:focus-visible{outline:2px solid #245eac}#geoedu-temporal-dashboard .geoedu-chart button small{font-size:10px}#geoedu-temporal-dashboard .geoedu-note{font-size:11px;color:#486862;line-height:1.5;margin:8px 0}#geoedu-temporal-dashboard .geoedu-chart-title{margin:12px 0 0;font-size:12px;font-weight:700}`;
 document.head.appendChild(css);
 const host=document.getElementById('geoedu-temporal-panel');
 if(!host)return;
 const dash=document.createElement('div');dash.id='geoedu-temporal-dashboard';dash.hidden=true;dash.innerHTML='<strong>Indicadores espaço-temporais</strong><div class="geoedu-stat-grid" style="margin-top:8px"><div class="geoedu-stat"><span>Feições no período</span><strong id="geoedu-stat-count">—</strong></div><div class="geoedu-stat"><span>Área estimada (km²)</span><strong id="geoedu-stat-area">—</strong></div><div class="geoedu-stat"><span>Variação da área anual</span><strong id="geoedu-stat-change">—</strong></div><div class="geoedu-stat"><span>Área acumulada (km²)</span><strong id="geoedu-stat-cumulative">—</strong></div></div><p class="geoedu-note">O gráfico interativo acima permite selecionar um ano. Área geodésica aproximada em WGS 84; não equivale necessariamente à estatística oficial do PRODES. Polígonos sobrepostos podem produzir dupla contagem.</p>';
 // Single visual hierarchy: timeline → indicator cards → annual chart → methodology → reset.
 const chart=document.getElementById('temporal-chart');
 const redundantMetrics=document.getElementById('temporal-metrics');
 const redundantNote=document.getElementById('temporal-note');
 if(redundantMetrics){redundantMetrics.setAttribute('aria-hidden','true');redundantMetrics.style.display='none';}
 if(redundantNote){redundantNote.setAttribute('aria-hidden','true');redundantNote.style.display='none';}
 const resetButton=document.getElementById('temporal-reset');
 const resetRow=resetButton?.parentElement;
 if(resetRow&&resetRow.parentElement===host)host.insertBefore(dash,resetRow);
 else host.appendChild(dash);
 if(chart){
  const heading=document.createElement('div');heading.className='geoedu-chart-title';heading.textContent='Evolução anual da área (km²)';
  const note=dash.querySelector('.geoedu-note');
  dash.insertBefore(heading,note);
  dash.insertBefore(chart,note);
 }
 const byId=id=>document.getElementById(id);
 const fmt=n=>Number.isFinite(n)?n.toLocaleString('pt-BR',{maximumFractionDigits:2}):'—';
 // Chamberlain-Duquette spherical polygon area, square kilometers; holes subtracted.
 function ringArea(ring){if(!Array.isArray(ring)||ring.length<4)return 0;let sum=0;const rad=Math.PI/180;for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];if(!a||!b)continue;let delta=(b[0]-a[0])*rad;if(delta>Math.PI)delta-=2*Math.PI;if(delta< -Math.PI)delta+=2*Math.PI;sum+=delta*(2+Math.sin(a[1]*rad)+Math.sin(b[1]*rad));}return Math.abs(sum*6371.0088*6371.0088/2);}
 function polygonArea(poly){if(!Array.isArray(poly)||!poly.length)return 0;return Math.max(0,ringArea(poly[0])-poly.slice(1).reduce((s,r)=>s+ringArea(r),0));}
 function geomArea(g){if(!g)return 0;if(g.type==='Polygon')return polygonArea(g.coordinates);if(g.type==='MultiPolygon')return g.coordinates.reduce((s,p)=>s+polygonArea(p),0);if(g.type==='GeometryCollection')return(g.geometries||[]).reduce((s,v)=>s+geomArea(v),0);return 0;}
 function getYear(v){if(v===null||v===undefined||v==='')return null;const m=String(v).trim().match(/^(\d{4})(?:$|[-/]\d{1,2}[-/]\d{1,2})/);return m?+m[1]:null;}
 document.addEventListener('geoedu:temporal-update',e=>{
  const {field,year,years,mode,features}=e.detail;if(!years.length){dash.hidden=true;return;}dash.hidden=false;
  const data=new Map(years.map(y=>[y,{count:0,area:0}]));
  for(const f of features){const y=getYear(f.properties?.[field]);if(data.has(y)){const v=data.get(y);v.count++;v.area+=geomArea(f.geometry);}}
  const included=years.filter(y=>mode==='cumulative'?y<=year:y===year);
  const area=included.reduce((s,y)=>s+data.get(y).area,0),count=included.reduce((s,y)=>s+data.get(y).count,0);
  const cumulative=years.filter(y=>y<=year).reduce((s,y)=>s+data.get(y).area,0);
  const index=years.indexOf(year),prev=index>0?data.get(years[index-1]).area:null,current=data.get(year).area;
  const change=prev===null?'—':prev===0?(current===0?'0%':'n/d'):(current-prev)/prev*100;
  byId('geoedu-stat-count').textContent=fmt(count);byId('geoedu-stat-area').textContent=fmt(area);byId('geoedu-stat-cumulative').textContent=fmt(cumulative);byId('geoedu-stat-change').textContent=typeof change==='number'?(change>0?'+':'')+fmt(change)+'%':change;

 });
 document.addEventListener('geoedu:temporal-reset',()=>{dash.hidden=true;});
})();
