/* GeoEdu Lab v2.0.2 — compositor de prévia A4. Exportação será disponibilizada após validação. */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const dialog=byId('composer-modal'),button=byId('btn-composer'),close=byId('composer-close');
const preview=byId('composer-page'),status=byId('composer-status');
let previewMap=null,previewBase=null,previewVectors=[];const edited=new Set();
function activeBase(){
 const key=document.querySelector('input[name="basemap"]:checked')?.value||'sentinel';
 return key;
}
function newBase(key){
 if(key==='landsat')return new LandsatImageLayer({tileSize:256,minZoom:2,maxZoom:16,attribution:landsatAttr});
 if(key==='gray')return L.layerGroup([
 L.tileLayer(grayBase._url,{maxZoom:16,attribution:esriAttr}),
 L.tileLayer(grayLabels._url,{maxZoom:16,attribution:esriAttr})]);
 const source=basemaps[key]||basemaps.sentinel;
 return L.tileLayer(source._url,{minZoom:source.options.minZoom||0,maxZoom:source.options.maxZoom||18,maxNativeZoom:source.options.maxNativeZoom,attribution:source.options.attribution||''});
}
function clearVectors(){previewVectors.forEach(layer=>previewMap.removeLayer(layer));previewVectors=[];}
function visibleThemeKeys(){
 return ['maranhao','municipios','local','drenagem','sedes'].filter(k=>{
 const layer=thematicLayerByKey(k);
 return layer&&map.hasLayer(layer);
 });
}
function cloneThemes(){
 clearVectors();
 const keys=visibleThemeKeys();
 const renderer=L.canvas({padding:.2});
 for(const k of keys){
  const source=thematicLayerByKey(k);
  // Reuse loaded features only; do not fetch or activate disabled layers.
  const cloned=L.layerGroup();
  source.eachLayer(child=>{
   if(!child.feature||!child.toGeoJSON)return;
   const f=child.toGeoJSON();
   const opts={...child.options};
   const style=categoryStyle(k,child.feature);
   if(child instanceof L.CircleMarker){
    const latlng=child.getLatLng();
    L.circleMarker(latlng,{...style,radius:child.getRadius(),renderer,interactive:false}).addTo(cloned);
   }else{
    L.geoJSON(f,{style:()=>({...opts,...style,renderer,interactive:false}),interactive:false,renderer}).addTo(cloned);
   }
  });
  cloned.addTo(previewMap);
  previewVectors.push(cloned);
 }
 return keys.length;
}
function northStyle(){const type=byId('composer-north-style').value;byId('composer-north-mark').innerHTML=type==='compass'?'✦<br>N':type==='letter'?'N':'N<br>↑';}
function scaleStyle(){const type=byId('composer-scale-style').value;const node=byId('composer-scale-display');node.textContent=type==='text'?'Escala aproximada — consulte a barra gráfica no mapa':type==='line'?'|────|────|':'▰▱▰▱';}
function installDrag(){
 for(const node of preview.querySelectorAll('.composer-movable')){
  node.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.target.closest('input,button'))return;
   const startX=event.clientX,startY=event.clientY,rect=node.getBoundingClientRect(),page=preview.getBoundingClientRect();
   let moved=false;const left=rect.left-page.left,top=rect.top-page.top;
   const move=e=>{if(Math.abs(e.clientX-startX)+Math.abs(e.clientY-startY)<5&&!moved)return;moved=true;node.classList.add('dragging');node.style.position='absolute';node.style.margin='0';node.style.left=Math.max(0,Math.min(page.width-node.offsetWidth,left+e.clientX-startX))+'px';node.style.top=Math.max(0,Math.min(page.height-node.offsetHeight,top+e.clientY-startY))+'px';};
   const up=()=>{window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);node.classList.remove('dragging');};
   window.addEventListener('pointermove',move);window.addEventListener('pointerup',up,{once:true});
  });
 }
}
function updateLayout(){
 if(!edited.has('composer-preview-title'))byId('composer-preview-title').textContent=byId('composer-map-title').value.trim()||'Mapa sem título';
 if(!edited.has('composer-preview-subtitle'))byId('composer-preview-subtitle').textContent=byId('composer-subtitle').value.trim();
 preview.classList.toggle('portrait',byId('composer-orientation').value==='portrait');
 byId('composer-north-mark').hidden=!byId('composer-north').checked;
 byId('composer-legend-display').hidden=!byId('composer-legend').checked;
 byId('composer-scale-display').hidden=!byId('composer-scale').checked;
 byId('composer-source-display').hidden=!byId('composer-source').checked;
 if(!edited.has('composer-source-display'))byId('composer-source-display').textContent='Fonte: '+byId('composer-source-text').value.trim();northStyle();scaleStyle();
 if(previewMap){setTimeout(()=>previewMap.invalidateSize(),0);}
}
function updatePreview(){
 updateLayout();
 if(!previewMap){
 previewMap=L.map('composer-map',{zoomControl:false,preferCanvas:true,attributionControl:false,scrollWheelZoom:false});
 L.control.scale({imperial:false,position:'bottomleft'}).addTo(previewMap);
 }
 if(previewBase)previewMap.removeLayer(previewBase);
 previewBase=newBase(activeBase()).addTo(previewMap);
 previewMap.setView(map.getCenter(),map.getZoom(),{animate:false});
 scaleStyle();
 const legend=byId('legend-content');
 const custom=byId('composer-legend-text').value.trim();byId('composer-legend-display').innerHTML=custom?'':legend?.innerHTML||'Nenhuma camada temática visível.';if(custom)byId('composer-legend-display').textContent=custom;byId('composer-attribution').textContent='Créditos do mapa-base: '+(previewBase?.getAttribution?.()||'Consulte as fontes do mapa principal.');
 status.textContent='Preparando camadas temáticas visíveis…';setTimeout(()=>{if(dialog.hidden)return;try{const count=cloneThemes();status.textContent='Prévia atualizada: '+count+' camada(s) temática(s) visível(is), com simbologia atual. O enquadramento segue o mapa principal.';}catch(err){status.textContent='Falha ao reproduzir camadas temáticas: '+err.message;}},0);
 setTimeout(()=>previewMap.invalidateSize(),50);
}
function open(){
 dialog.hidden=false;
 updatePreview();
 close.focus();
}
function dismiss(){dialog.hidden=true;button.focus();}
button.addEventListener('click',open);
close.addEventListener('click',dismiss);
dialog.addEventListener('click',event=>{if(event.target===dialog)dismiss();});
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.hidden)dismiss();});
byId('composer-refresh').addEventListener('click',updatePreview);
['composer-map-title','composer-subtitle','composer-orientation','composer-legend','composer-north','composer-scale','composer-source','composer-source-text','composer-north-style','composer-scale-style'].forEach(id=>byId(id).addEventListener('input',updateLayout));
['composer-preview-title','composer-preview-subtitle','composer-source-display'].forEach(id=>byId(id).addEventListener('input',()=>edited.add(id)));byId('composer-legend-text').addEventListener('input',()=>{const v=byId('composer-legend-text').value.trim();if(v)byId('composer-legend-display').textContent=v;else updatePreview();});installDrag();
})();