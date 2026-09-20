/* GeoEdu Lab v2.1.2 — compositor de prévia A4. Exportação será disponibilizada após validação. */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const dialog=byId('composer-modal'),button=byId('btn-composer'),close=byId('composer-close');
const preview=byId('composer-page'),status=byId('composer-status');
let interactionsReady=false,layoutOrientation='landscape',composerZ=20;let previewMap=null,previewBase=null,previewVectors=[];let mapFrameObserver=null,autoFrame=true,resizeQueued=false;const edited=new Set();
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
function setElementContent(node,html,asText=false){const controls=[...node.querySelectorAll(':scope > .composer-move-handle,:scope > .composer-resize-handle')];controls.forEach(el=>el.remove());if(asText)node.textContent=html;else node.innerHTML=html;controls.forEach(el=>node.appendChild(el));}
function northStyle(){const type=byId('composer-north-style').value;const node=byId('composer-north-mark');const arrow='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L27 35 16 29 5 35Z" fill="#173f48" stroke="#173f48" stroke-width="1.5"/><path d="M16 2V29L5 35Z" fill="#fff"/><text x="16" y="45" text-anchor="middle" font-size="9" fill="#173f48">N</text></svg>';const compass='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L21 19 30 23 21 27 16 40 11 27 2 23 11 19Z" fill="#173f48" stroke="#173f48"/><path d="M16 2V40L11 27 2 23 11 19Z" fill="#fff"/><text x="16" y="45" text-anchor="middle" font-size="8" fill="#173f48">N</text></svg>';const needle='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L25 36 16 29 7 36Z" fill="#173f48"/><path d="M16 2L16 29 7 36Z" fill="#fff" stroke="#173f48"/><text x="16" y="45" text-anchor="middle" font-size="9" fill="#173f48">N</text></svg>';setElementContent(node,type==='compass'?compass:type==='needle'?needle:arrow);}
function scaleStyle(){const node=byId('composer-scale-display');setElementContent(node,'A escala gráfica proporcional é exibida no quadro do mapa.',true);}
function updateScale(){
 if(!previewMap)return;
 const holder=byId('composer-scale-display'),size=previewMap.getSize(),w=size.x;
 if(w<20||size.y<20)return;
 const left=previewMap.containerPointToLatLng([w/2-65,size.y/2]);
 const right=previewMap.containerPointToLatLng([w/2+65,size.y/2]);
 const distance=left.distanceTo(right);if(!(distance>0))return;
 const power=Math.pow(10,Math.floor(Math.log10(distance))),ratio=distance/power;
 const metres=(ratio>=5?5:ratio>=2?2:1)*power,unit=metres>=1000?'km':'m',value=unit==='km'?metres/1000:metres;
 setElementContent(holder,'<div class="scale-values"><span>0</span><span>'+Number((value/2).toPrecision(3))+'</span><span>'+Number(value.toPrecision(3))+' '+unit+'</span></div><div class="scale-segments"><i></i><i></i><i></i><i></i></div>');
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
 const page=()=>preview.getBoundingClientRect();
 const initial=nodes.map(node=>{const r=node.getBoundingClientRect(),p=page();return {node,x:r.left-p.left,y:r.top-p.top,w:r.width,h:r.height};});
 for(const {node,x,y,w,h} of initial){
  const mapFrame=node.classList.contains('composer-map-row');
  preview.appendChild(node);
  node.classList.add('composer-interactive');
  Object.assign(node.style,{position:'absolute',left:x+'px',top:y+'px',width:w+'px',height:h+'px',margin:'0',maxWidth:'none',zIndex:String(++composerZ)});
  const move=document.createElement('button');move.type='button';move.className='composer-move-handle';move.textContent='✥';move.title='Mover elemento';move.setAttribute('aria-label','Mover elemento');node.appendChild(move);
  const start=(event,mode)=>{
   if(event.button!==0)return;
   event.preventDefault();event.stopPropagation();
   node.style.zIndex=String(++composerZ);
   const origin={x:event.clientX,y:event.clientY,l:node.offsetLeft,t:node.offsetTop,w:node.offsetWidth,h:node.offsetHeight};
   const minW=mapFrame?150:node.id==='composer-legend-display'?120:40,minH=mapFrame?140:25;
   const target=event.currentTarget;
   target.setPointerCapture(event.pointerId);
   const drag=e=>{
    const dx=e.clientX-origin.x,dy=e.clientY-origin.y;
    let {l,t,w,h}=origin;
    if(mode==='move'){l+=dx;t+=dy;}
    else{
     if(mode.includes('e'))w+=dx;
     if(mode.includes('s'))h+=dy;
     if(mode.includes('w')){w-=dx;l+=dx;}
     if(mode.includes('n')){h-=dy;t+=dy;}
    }
    if(w<minW){if(mode.includes('w'))l-=minW-w;w=minW;}
    if(h<minH){if(mode.includes('n'))t-=minH-h;h=minH;}
    const p=page();
    w=Math.min(w,p.width);h=Math.min(h,p.height);
    l=Math.max(0,Math.min(l,p.width-w));t=Math.max(0,Math.min(t,p.height-h));
    Object.assign(node.style,{left:l+'px',top:t+'px',width:w+'px',height:h+'px'});
    if(node.id==='composer-legend-display')fitLegend();
   };
   const finish=()=>{
    target.removeEventListener('pointermove',drag);
    target.removeEventListener('pointerup',finish);
    target.removeEventListener('pointercancel',finish);
    if(mapFrame)requestAnimationFrame(()=>{previewMap?.invalidateSize({pan:false});updateScale();});
   };
   target.addEventListener('pointermove',drag);
   target.addEventListener('pointerup',finish,{once:true});
   target.addEventListener('pointercancel',finish,{once:true});
  };
  move.addEventListener('pointerdown',e=>start(e,'move'));
  for(const direction of ['n','ne','e','se','s','sw','w','nw']){
   const handle=document.createElement('span');handle.className='composer-resize-handle side-'+direction;
   handle.setAttribute('aria-label','Redimensionar '+direction);
   handle.addEventListener('pointerdown',e=>start(e,direction));node.appendChild(handle);
  }
 }
}
function changeOrientation(){
 const next=byId('composer-orientation').value==='portrait'?'portrait':'landscape';
 if(next===layoutOrientation)return;
 const old=preview.getBoundingClientRect();
 const items=[...preview.querySelectorAll('.composer-interactive')].map(node=>({
  node,x:node.offsetLeft/old.width,y:node.offsetTop/old.height,
  w:node.offsetWidth/old.width,h:node.offsetHeight/old.height
 }));
 preview.classList.toggle('portrait',next==='portrait');
 preview.classList.toggle('landscape',next!=='portrait');
 const fresh=preview.getBoundingClientRect();
 for(const {node,x,y,w,h} of items){
  const nw=Math.min(fresh.width,Math.max(20,w*fresh.width));
  const nh=Math.min(fresh.height,Math.max(20,h*fresh.height));
  Object.assign(node.style,{
   left:Math.max(0,Math.min(fresh.width-nw,x*fresh.width))+'px',
   top:Math.max(0,Math.min(fresh.height-nh,y*fresh.height))+'px',
   width:nw+'px',height:nh+'px'
  });
 }
 layoutOrientation=next;
 requestAnimationFrame(()=>{previewMap?.invalidateSize({pan:false});updateScale();fitLegend();});
}
function updateLayout(){
 if(!edited.has('composer-preview-title'))setElementContent(byId('composer-preview-title'),byId('composer-map-title').value.trim()||'Mapa sem título',true);
 if(!edited.has('composer-preview-subtitle'))setElementContent(byId('composer-preview-subtitle'),byId('composer-subtitle').value.trim(),true);
 changeOrientation();
 byId('composer-north-mark').hidden=!byId('composer-north').checked;
 byId('composer-legend-display').hidden=!byId('composer-legend').checked;
 byId('composer-scale-display').hidden=!byId('composer-scale').checked;
 byId('composer-source-display').hidden=!byId('composer-source').checked;
 if(!edited.has('composer-source-display'))setElementContent(byId('composer-source-display'),'Fonte: '+byId('composer-source-text').value.trim(),true);northStyle();if(previewMap)updateScale();
 if(previewMap){requestAnimationFrame(()=>{previewMap.invalidateSize({pan:false});updateScale();});}
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
 const custom=byId('composer-legend-text').value.trim();const legendBox=byId('composer-legend-display');setElementContent(legendBox,custom||legend?.innerHTML||'Nenhuma camada temática visível.',!!custom);requestAnimationFrame(fitLegend);byId('composer-attribution').textContent='Créditos do mapa-base: '+(previewBase?.getAttribution?.()||'Consulte as fontes do mapa principal.');
 status.textContent='Preparando camadas temáticas visíveis…';setTimeout(()=>{if(dialog.hidden)return;try{const count=cloneThemes();status.textContent='Prévia atualizada: '+count+' camada(s) temática(s) visível(is), com simbologia atual. O enquadramento segue o mapa principal.';}catch(err){status.textContent='Falha ao reproduzir camadas temáticas: '+err.message;}},0);
 setTimeout(fitFrame,50);
}
const resizeObserver=new ResizeObserver(()=>{if(previewMap&&!dialog.hidden&&!resizeQueued){resizeQueued=true;requestAnimationFrame(()=>{resizeQueued=false;fitFrame();});}});resizeObserver.observe(document.querySelector('.composer-map-row'));const legendObserver=new ResizeObserver(()=>requestAnimationFrame(fitLegend));legendObserver.observe(byId('composer-legend-display'));
function open(){
 dialog.hidden=false;
 if(!interactionsReady){requestAnimationFrame(()=>{installInteractions();interactionsReady=true;updatePreview();});return;}
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