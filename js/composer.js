/* GeoEdu Lab v2.0.9 — compositor de prévia A4. Exportação será disponibilizada após validação. */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const dialog=byId('composer-modal'),button=byId('btn-composer'),close=byId('composer-close');
const preview=byId('composer-page'),status=byId('composer-status');
let interactionsReady=false,layoutOrientation='landscape';let previewMap=null,previewBase=null,previewVectors=[];let mapFrameObserver=null,autoFrame=true,resizeQueued=false;const edited=new Set();
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
function installInteractions(){
 const nodes=[...preview.querySelectorAll('.composer-movable'),preview.querySelector('.composer-map-row')];
 const pageRect=()=>preview.getBoundingClientRect();
 // Remove each item from header/footer flex flow. Positions are recorded before moving nodes.
 const positions=nodes.map(node=>{const r=node.getBoundingClientRect(),p=pageRect();return {node,x:r.left-p.left,y:r.top-p.top,w:r.width,h:r.height};});
 for(const item of positions){
  const {node,x,y,w,h}=item,mapFrame=node.classList.contains('composer-map-row');
  preview.appendChild(node);node.classList.add('composer-interactive');
  Object.assign(node.style,{position:'absolute',left:x+'px',top:y+'px',width:w+'px',height:h+'px',margin:'0',maxWidth:'none'});
  const moveHandle=document.createElement('button');moveHandle.type='button';moveHandle.className='composer-move-handle';moveHandle.textContent='✥';moveHandle.title='Mover elemento';moveHandle.setAttribute('aria-label','Mover elemento');node.appendChild(moveHandle);
  const start=(event,mode)=>{
   if(event.button!==0)return;
   event.preventDefault();event.stopPropagation();node.style.zIndex=String(++window.__composerZ || (window.__composerZ=900));
   const p=pageRect(),rect=node.getBoundingClientRect();
   const o={x:event.clientX,y:event.clientY,w:rect.width,h:rect.height,l:rect.left-p.left,t:rect.top-p.top};
   const minW=mapFrame?150:node.id==='composer-legend-display'?120:55,minH=mapFrame?140:35;
   const target=event.currentTarget;target.setPointerCapture(event.pointerId);
   const drag=e=>{
    const dx=e.clientX-o.x,dy=e.clientY-o.y;let w=o.w,h=o.h,l=o.l,t=o.t;
    if(mode==='move'){l+=dx;t+=dy;}
    else{if(mode.includes('e'))w+=dx;if(mode.includes('s'))h+=dy;if(mode.includes('w')){w-=dx;l+=dx;}if(mode.includes('n')){h-=dy;t+=dy;}}
    if(w<minW){if(mode.includes('w'))l-=minW-w;w=minW;}
    if(h<minH){if(mode.includes('n'))t-=minH-h;h=minH;}
    l=Math.max(0,Math.min(l,p.width-minW));t=Math.max(0,Math.min(t,p.height-minH));
    w=Math.max(minW,Math.min(w,p.width-l));h=Math.max(minH,Math.min(h,p.height-t));
    Object.assign(node.style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'});
    if(node.id==='composer-legend-display')fitLegend();
   };
   const finish=()=>{target.removeEventListener('pointermove',drag);target.removeEventListener('pointerup',finish);target.removeEventListener('pointercancel',finish);if(mapFrame)requestAnimationFrame(fitFrame);};
   target.addEventListener('pointermove',drag);target.addEventListener('pointerup',finish,{once:true});target.addEventListener('pointercancel',finish,{once:true});
  };
  moveHandle.addEventListener('pointerdown',e=>start(e,'move'));
  for(const direction of ['n','ne','e','se','s','sw','w','nw']){const handle=document.createElement('span');handle.className='composer-resize-handle side-'+direction;handle.setAttribute('aria-label','Redimensionar '+direction);handle.addEventListener('pointerdown',e=>start(e,direction));node.appendChild(handle);}
 }
}
function changeOrientation(){
 const next=byId('composer-orientation').value==='portrait'?'portrait':'landscape';
 if(next===layoutOrientation)return;
 const old=preview.getBoundingClientRect();
 const items=[...preview.querySelectorAll('.composer-interactive')].map(node=>({node,x:parseFloat(node.style.left)||0,y:parseFloat(node.style.top)||0,w:node.offsetWidth,h:node.offsetHeight}));
 preview.classList.toggle('portrait',next==='portrait');preview.classList.toggle('landscape',next!=='portrait');
 const fresh=preview.getBoundingClientRect(),sx=fresh.width/old.width,sy=fresh.height/old.height;
 for(const {node,x,y,w,h} of items){
  const nw=Math.max(node.classList.contains('composer-map-row')?150:55,Math.min(fresh.width-12,w*sx));
  const nh=Math.max(node.classList.contains('composer-map-row')?140:35,Math.min(fresh.height-12,h*sy));
  Object.assign(node.style,{left:Math.max(0,Math.min(fresh.width-nw,x*sx))+'px',top:Math.max(0,Math.min(fresh.height-nh,y*sy))+'px',width:nw+'px',height:nh+'px'});
 }
 layoutOrientation=next;requestAnimationFrame(()=>{fitFrame();fitLegend();});
}
function updateLayout(){
 if(!edited.has('composer-preview-title'))byId('composer-preview-title').textContent=byId('composer-map-title').value.trim()||'Mapa sem título';
 if(!edited.has('composer-preview-subtitle'))byId('composer-preview-subtitle').textContent=byId('composer-subtitle').value.trim();
 changeOrientation();
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
 const custom=byId('composer-legend-text').value.trim();const legendBox=byId('composer-legend-display');const handles=[...legendBox.querySelectorAll('.composer-resize-handle,.composer-move-handle')];handles.forEach(el=>el.remove());legendBox.innerHTML=custom?'':legend?.innerHTML||'Nenhuma camada temática visível.';if(custom)legendBox.textContent=custom;handles.forEach(el=>legendBox.appendChild(el));requestAnimationFrame(fitLegend);byId('composer-attribution').textContent='Créditos do mapa-base: '+(previewBase?.getAttribution?.()||'Consulte as fontes do mapa principal.');
 status.textContent='Preparando camadas temáticas visíveis…';setTimeout(()=>{if(dialog.hidden)return;try{const count=cloneThemes();status.textContent='Prévia atualizada: '+count+' camada(s) temática(s) visível(is), com simbologia atual. O enquadramento segue o mapa principal.';}catch(err){status.textContent='Falha ao reproduzir camadas temáticas: '+err.message;}},0);
 setTimeout(fitFrame,50);
}
const resizeObserver=new ResizeObserver(()=>{if(previewMap&&!dialog.hidden&&!resizeQueued){resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;fitFrame();});}});resizeObserver.observe(document.querySelector('.composer-map-row'));const legendObserver=new ResizeObserver(()=>requestAnimationFrame(fitLegend));legendObserver.observe(byId('composer-legend-display'));
function open(){
 dialog.hidden=false;
 if(!interactionsReady){installInteractions();interactionsReady=true;}
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
['composer-preview-title','composer-preview-subtitle','composer-source-display'].forEach(id=>byId(id).addEventListener('input',()=>edited.add(id)));byId('composer-legend-text').addEventListener('input',()=>{const v=byId('composer-legend-text').value.trim();if(v){const box=byId('composer-legend-display');[...box.childNodes].filter(n=>!n.classList?.contains('composer-resize-handle')&&!n.classList?.contains('composer-move-handle')).forEach(n=>n.remove());box.prepend(document.createTextNode(v));requestAnimationFrame(fitLegend);}else updatePreview();});})();