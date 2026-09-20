/* GeoEdu Lab v2.0.6 — compositor de prévia A4. Exportação será disponibilizada após validação. */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const dialog=byId('composer-modal'),button=byId('btn-composer'),close=byId('composer-close');
const preview=byId('composer-page'),status=byId('composer-status');
let previewMap=null,previewBase=null,previewVectors=[];let mapFrameObserver=null,autoFrame=true,resizeQueued=false;const edited=new Set();
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
function northStyle(){const type=byId('composer-north-style').value;const node=byId('composer-north-mark');const arrow='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L27 35 16 29 5 35Z" fill="#173f48" stroke="#173f48" stroke-width="1.5"/><path d="M16 2V29L5 35Z" fill="#fff"/><text x="16" y="45" text-anchor="middle" font-size="9" fill="#173f48">N</text></svg>';const compass='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L21 19 30 23 21 27 16 40 11 27 2 23 11 19Z" fill="#173f48" stroke="#173f48"/><path d="M16 2V40L11 27 2 23 11 19Z" fill="#fff"/><text x="16" y="45" text-anchor="middle" font-size="8" fill="#173f48">N</text></svg>';const needle='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L25 36 16 29 7 36Z" fill="#173f48"/><path d="M16 2L16 29 7 36Z" fill="#fff" stroke="#173f48"/><text x="16" y="45" text-anchor="middle" font-size="9" fill="#173f48">N</text></svg>';node.innerHTML=type==='compass'?compass:type==='needle'?needle:arrow;}
function scaleStyle(){const node=byId('composer-scale-display');node.textContent='A escala gráfica proporcional é exibida no quadro do mapa.';}
function updateScale(){
 if(!previewMap)return;
 const holder=byId('composer-scale-display'),size=previewMap.getSize(),w=size.x;
 if(w<20||size.y<20)return;
 const left=previewMap.containerPointToLatLng([w/2-65,size.y/2]);
 const right=previewMap.containerPointToLatLng([w/2+65,size.y/2]);
 const distance=left.distanceTo(right);if(!(distance>0))return;
 const power=Math.pow(10,Math.floor(Math.log10(distance))),ratio=distance/power;
 const metres=(ratio>=5?5:ratio>=2?2:1)*power,unit=metres>=1000?'km':'m',value=unit==='km'?metres/1000:metres;
 holder.innerHTML='<div class="scale-values"><span>0</span><span>'+Number((value/2).toPrecision(3))+'</span><span>'+Number(value.toPrecision(3))+' '+unit+'</span></div><div class="scale-segments"><i></i><i></i><i></i><i></i></div>';
 holder.querySelector('.scale-segments').style.width='100%';
}
function fitLegend(){
 const node=byId('composer-legend-display');if(!node||node.hidden)return;
 node.style.fontSize='10px';
 for(let size=10;size>=7;size-=.5){node.style.fontSize=size+'px';if(node.scrollHeight<=node.clientHeight+2&&node.scrollWidth<=node.clientWidth+2)break;}
 node.classList.toggle('composer-legend-overflow',node.scrollHeight>node.clientHeight+2||node.scrollWidth>node.clientWidth+2);
}
function fitFrame(){
 if(!previewMap||dialog.hidden)return;
 previewMap.invalidateSize({pan:false});
 if(autoFrame){const bounds=map.getBounds();if(bounds.isValid())previewMap.fitBounds(bounds,{animate:false,padding:[8,8],maxZoom:map.getZoom()+2});}
 updateScale();
}
function installResize(){
 const nodes=[...preview.querySelectorAll('.composer-movable'),preview.querySelector('.composer-map-row')];
 for(const node of nodes){
  if(!node)return;
  node.classList.add('composer-resizable');
  for(const side of ['n','e','s','w']){
   const handle=document.createElement('span');handle.className='composer-resize-handle side-'+side;handle.setAttribute('aria-label','Redimensionar '+(node.getAttribute('aria-label')||'elemento')+' pelo lado '+side);
   handle.addEventListener('pointerdown',event=>{
    event.preventDefault();event.stopPropagation();const rect=node.getBoundingClientRect(),startX=event.clientX,startY=event.clientY;
    const initialW=rect.width,initialH=rect.height,initialLeft=parseFloat(node.style.left)||0,initialTop=parseFloat(node.style.top)||0;
    handle.setPointerCapture(event.pointerId);
    const move=e=>{
     const dx=e.clientX-startX,dy=e.clientY-startY;
     if(side==='e'||side==='w')node.style.width=Math.max(node===byId('composer-legend-display')?120:100,initialW+(side==='e'?dx:-dx))+'px';
     if(side==='s'||side==='n')node.style.height=Math.max(node.classList.contains('composer-map-row')?140:35,initialH+(side==='s'?dy:-dy))+'px';
     if(node.style.position==='absolute'){
      if(side==='w')node.style.left=initialLeft+Math.min(dx,initialW-100)+'px';
      if(side==='n')node.style.top=initialTop+Math.min(dy,initialH-35)+'px';
     }
     if(node===byId('composer-legend-display'))requestAnimationFrame(fitLegend);
    };
    const up=()=>{handle.removeEventListener('pointermove',move);handle.removeEventListener('pointerup',up);if(node.classList.contains('composer-map-row'))requestAnimationFrame(fitFrame);};
    handle.addEventListener('pointermove',move);handle.addEventListener('pointerup',up,{once:true});
   });node.appendChild(handle);
  }
 }
}
function installDrag(){
 for(const node of preview.querySelectorAll('.composer-movable')){
  node.addEventListener('pointerdown',event=>{
   if(event.button!==0||event.target.closest('input,button,.composer-resize-handle'))return;const bounds=node.getBoundingClientRect();if(event.clientX>bounds.right-22&&event.clientY>bounds.bottom-22)return;
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
 preview.classList.toggle('portrait',byId('composer-orientation').value==='portrait');preview.classList.toggle('landscape',byId('composer-orientation').value!=='portrait');
 byId('composer-north-mark').hidden=!byId('composer-north').checked;
 byId('composer-legend-display').hidden=!byId('composer-legend').checked;
 byId('composer-scale-display').hidden=!byId('composer-scale').checked;
 byId('composer-source-display').hidden=!byId('composer-source').checked;
 if(!edited.has('composer-source-display'))byId('composer-source-display').textContent='Fonte: '+byId('composer-source-text').value.trim();northStyle();if(previewMap)updateScale();
 if(previewMap){requestAnimationFrame(fitFrame);}
}
function updatePreview(){
 updateLayout();
 if(!previewMap){
 previewMap=L.map('composer-map',{zoomControl:false,preferCanvas:true,attributionControl:false,scrollWheelZoom:false});
 previewMap.on('moveend resize',updateScale);
 }
 if(previewBase)previewMap.removeLayer(previewBase);
 previewBase=newBase(activeBase()).addTo(previewMap);
 previewMap.invalidateSize({pan:false});fitFrame();
 updateScale();
 const legend=byId('legend-content');
 const custom=byId('composer-legend-text').value.trim();byId('composer-legend-display').innerHTML=custom?'':legend?.innerHTML||'Nenhuma camada temática visível.';if(custom)byId('composer-legend-display').textContent=custom;requestAnimationFrame(fitLegend);byId('composer-attribution').textContent='Créditos do mapa-base: '+(previewBase?.getAttribution?.()||'Consulte as fontes do mapa principal.');
 status.textContent='Preparando camadas temáticas visíveis…';setTimeout(()=>{if(dialog.hidden)return;try{const count=cloneThemes();status.textContent='Prévia atualizada: '+count+' camada(s) temática(s) visível(is), com simbologia atual. O enquadramento segue o mapa principal.';}catch(err){status.textContent='Falha ao reproduzir camadas temáticas: '+err.message;}},0);
 setTimeout(fitFrame,50);
}
const resizeObserver=new ResizeObserver(()=>{if(previewMap&&!dialog.hidden&&!resizeQueued){resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;fitFrame();});}});resizeObserver.observe(document.querySelector('.composer-map-row'));const legendObserver=new ResizeObserver(()=>requestAnimationFrame(fitLegend));legendObserver.observe(byId('composer-legend-display'));
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
byId('composer-refresh').addEventListener('click',updatePreview);byId('composer-fit').addEventListener('click',()=>{autoFrame=true;fitFrame();});byId('composer-zoom-in').addEventListener('click',()=>{autoFrame=false;previewMap?.zoomIn();});byId('composer-zoom-out').addEventListener('click',()=>{autoFrame=false;previewMap?.zoomOut();});byId('composer-orientation').addEventListener('change',()=>{requestAnimationFrame(()=>{previewMap?.invalidateSize({pan:false});fitFrame();});});
['composer-map-title','composer-subtitle','composer-orientation','composer-legend','composer-north','composer-scale','composer-source','composer-source-text','composer-north-style'].forEach(id=>byId(id).addEventListener('input',updateLayout));
['composer-preview-title','composer-preview-subtitle','composer-source-display'].forEach(id=>byId(id).addEventListener('input',()=>edited.add(id)));byId('composer-legend-text').addEventListener('input',()=>{const v=byId('composer-legend-text').value.trim();if(v){byId('composer-legend-display').textContent=v;requestAnimationFrame(fitLegend);}else updatePreview();});installResize();installDrag();
})();