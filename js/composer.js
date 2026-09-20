/* GeoEdu Lab v2.1.7 — compositor de prévia A4. Exportação será disponibilizada após validação. */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const dialog=byId('composer-modal'),button=byId('btn-composer'),close=byId('composer-close');
const preview=byId('composer-page'),status=byId('composer-status');
let interactionsReady=false,layoutOrientation='landscape',composerZ=20,selectedElement=null,labelCount=0;const editedLegend=new Map();let previewMap=null,previewBase=null,previewVectors=[];let mapFrameObserver=null,autoFrame=true,resizeQueued=false;const edited=new Set();
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
function northStyle(){const type=byId('composer-north-style').value;const node=byId('composer-north-mark');const arrow='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L27 35 16 29 5 35Z" fill="#173f48" stroke="#173f48" stroke-width="1.5"/><path d="M16 2V29L5 35Z" fill="#fff"/><text x="16" y="45" text-anchor="middle" font-size="9" fill="#173f48">N</text></svg>';const compass='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L21 19 30 23 21 27 16 40 11 27 2 23 11 19Z" fill="#173f48" stroke="#173f48"/><path d="M16 2V40L11 27 2 23 11 19Z" fill="#fff"/><text x="16" y="45" text-anchor="middle" font-size="8" fill="#173f48">N</text></svg>';const needle='<svg viewBox="0 0 32 46" aria-hidden="true"><path d="M16 2L25 36 16 29 7 36Z" fill="#173f48"/><path d="M16 2L16 29 7 36Z" fill="#fff" stroke="#173f48"/><text x="16" y="45" text-anchor="middle" font-size="9" fill="#173f48">N</text></svg>';setElementContent(node,type==='letter'?'<span class="composer-north-letter">N</span>':type==='compass'?compass:type==='needle'?needle:arrow);node.style.display=node.hidden?'none':'flex';}
function scaleStyle(){const node=byId('composer-scale-display');setElementContent(node,'A escala gráfica proporcional é exibida no quadro do mapa.',true);}
function updateScale(){
 if(!previewMap)return;
 const holder=byId('composer-scale-display');
 if(!holder||holder.hidden)return;
 const size=previewMap.getSize();
 if(size.x<20||size.y<20)return;
 const center=[size.x/2,size.y/2];
 const p1=previewMap.containerPointToLatLng([center[0]-50,center[1]]);
 const p2=previewMap.containerPointToLatLng([center[0]+50,center[1]]);
 const metresPerPixel=p1.distanceTo(p2)/100;
 if(!Number.isFinite(metresPerPixel)||metresPerPixel<=0)return;
 const available=Math.max(20,holder.clientWidth-12);
 const maxDistance=available*metresPerPixel;
 const power=Math.pow(10,Math.floor(Math.log10(maxDistance)));
 const ratio=maxDistance/power;
 const metres=(ratio>=5?5:ratio>=2?2:1)*power;
 const width=Math.min(available,metres/metresPerPixel);
 const unit=metres>=1000?'km':'m',value=unit==='km'?metres/1000:metres;
 const fmt=n=>Number(n.toPrecision(4)).toLocaleString('pt-BR',{maximumFractionDigits:4});
 setElementContent(holder,'<div class="composer-scale-graphic" style="width:'+width+'px"><div class="scale-values"><span>0</span><span>'+fmt(value/2)+'</span><span>'+fmt(value)+' '+unit+'</span></div><div class="scale-segments"><i></i><i></i><i></i><i></i></div></div>');
}
function fitLegend(){
 const box=byId('composer-legend-display'),content=box?.querySelector(':scope > .composer-legend-content');
 if(!content||box.hidden||!box.clientWidth||!box.clientHeight)return;
 const width=Math.max(1,box.clientWidth-8),height=Math.max(1,box.clientHeight-8);
 content.style.zoom='1';content.style.width='max-content';
 const naturalW=Math.max(1,content.scrollWidth),naturalH=Math.max(1,content.scrollHeight);
 const factor=Math.min(2,Math.max(.15,Math.min(width/naturalW,height/naturalH)));
 content.style.zoom=String(factor);
 box.dataset.legendFits=String(content.scrollWidth<=width+2&&content.scrollHeight<=height+2);
}
function selectElement(node){
 selectedElement=node;
 byId('composer-selected-name').textContent=({ 'composer-preview-title':'Título','composer-preview-subtitle':'Subtítulo','composer-source-display':'Fonte','composer-legend-display':'Legenda','composer-north-mark':'Norte','composer-scale-display':'Escala gráfica' })[node.id]||'Quadro do mapa';
 const textNode=node.id==='composer-legend-display'?node.querySelector('.composer-legend-content'):node;
 const textControl=byId('composer-font-size'),textGroup=byId('composer-text-tools');
 const isText=['composer-preview-title','composer-preview-subtitle','composer-source-display','composer-legend-display'].includes(node.id)||node.classList.contains('composer-user-label');
 textGroup.hidden=!isText;
 if(isText)textControl.value=parseFloat(textNode?.style.fontSize)||parseFloat(getComputedStyle(textNode).fontSize)||12;
 byId('composer-element-width').value=Math.round(node.offsetWidth);
 byId('composer-element-height').value=Math.round(node.offsetHeight);
}
function applyElementSize(){
 const node=selectedElement;if(!node)return;
 const w=Number(byId('composer-element-width').value),h=Number(byId('composer-element-height').value);
 if(Number.isFinite(w)&&w>0)node.style.width=Math.min(w,preview.clientWidth-node.offsetLeft)+'px';
 if(Number.isFinite(h)&&h>0)node.style.height=Math.min(h,preview.clientHeight-node.offsetTop)+'px';
 if(node.id==='composer-legend-display')fitLegend();
 if(node.id==='composer-scale-display')updateScale();
 if(node.classList.contains('composer-map-row'))requestAnimationFrame(fitFrame);
}
function fitFrame(){
 if(!previewMap||dialog.hidden)return;
 previewMap.invalidateSize({pan:false});
 if(autoFrame){const bounds=map.getBounds();if(bounds.isValid())previewMap.fitBounds(bounds,{animate:false,padding:[8,8],maxZoom:map.getZoom()+2});}
 updateScale();
}
function makeInteractive(node){
 const page=preview.getBoundingClientRect(),r=node.getBoundingClientRect();
 const initial={node,x:r.left-page.left,y:r.top-page.top,w:r.width,h:r.height};
 installInteractions([initial]);
}
function installInteractions(custom){
 const nodes=[...preview.querySelectorAll('.composer-movable'),preview.querySelector('.composer-map-row')];
 const page=()=>preview.getBoundingClientRect();
 const initial=custom||nodes.map(node=>{const r=node.getBoundingClientRect(),p=page();return {node,x:r.left-p.left,y:r.top-p.top,w:r.width,h:r.height};});
 for(const {node,x,y,w,h} of initial){
  const mapFrame=node.classList.contains('composer-map-row');
  node.addEventListener('pointerdown',()=>selectElement(node),{capture:true});
  if(node.matches('[contenteditable]')){node.contentEditable='false';node.title='Arraste para mover; clique duas vezes para editar o texto';node.addEventListener('dblclick',e=>{e.stopPropagation();node.contentEditable='true';node.focus();});node.addEventListener('blur',()=>{node.contentEditable='false';});}
  preview.appendChild(node);
  node.classList.add('composer-interactive');
  Object.assign(node.style,{position:'absolute',left:x+'px',top:y+'px',width:w+'px',height:h+'px',margin:'0',maxWidth:'none',zIndex:String(++composerZ)});
  const move=document.createElement('button');move.type='button';move.className='composer-move-handle';move.textContent='';move.title='Arraste a caixa para mover';move.setAttribute('aria-label','Mover elemento');node.appendChild(move);
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
    if(node.id==='composer-scale-display')updateScale();
   };
   const finish=()=>{
    target.removeEventListener('pointermove',drag);
    target.removeEventListener('pointerup',finish);
    target.removeEventListener('pointercancel',finish);
    if(mapFrame)requestAnimationFrame(()=>{previewMap?.invalidateSize({pan:false});updateScale();});
    if(selectedElement===node)selectElement(node);
   };
   target.addEventListener('pointermove',drag);
   target.addEventListener('pointerup',finish,{once:true});
   target.addEventListener('pointercancel',finish,{once:true});
  };
  move.addEventListener('pointerdown',e=>start(e,'move'));
  if(!mapFrame){node.addEventListener('pointerdown',e=>{if(e.target.closest('.composer-resize-handle,.composer-move-handle,input,textarea,button,select,a,[contenteditable="true"]'))return;start(e,'move');});}
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
 const custom=byId('composer-legend-text').value.trim();
 const legendBox=byId('composer-legend-display');
 const previous=legendBox.querySelector('.composer-legend-content');
 const savedFont=previous?.style.fontSize||'';
 setElementContent(legendBox,'<div class="composer-legend-content"></div>');
 const legendContent=legendBox.querySelector('.composer-legend-content');
 if(custom)legendContent.textContent=custom;
 else legendContent.innerHTML=legend?.innerHTML||'Nenhuma camada temática visível.';
 legendContent.style.fontSize=savedFont;
 legendContent.querySelectorAll('button,input,select').forEach(el=>el.remove());
 legendContent.querySelectorAll('*').forEach(el=>{
  if(el.matches('hr'))el.remove();
  else{el.style.borderTop='none';el.style.borderBottom='none';el.style.boxShadow='none';}
 });
 legendContent.querySelectorAll('span,p,div,li,strong').forEach(el=>{
  if(el.children.length===0&&el.textContent.trim()){
   const key=el.textContent.trim();if(editedLegend.has(key))el.textContent=editedLegend.get(key);
   el.addEventListener('dblclick',e=>{e.stopPropagation();el.contentEditable='true';el.focus();});
   el.addEventListener('blur',()=>{el.contentEditable='false';editedLegend.set(key,el.textContent);requestAnimationFrame(fitLegend);});
   el.addEventListener('pointerdown',e=>{if(el.contentEditable==='true')e.stopPropagation();});
  }
 });
 legendContent.addEventListener('input',()=>requestAnimationFrame(fitLegend));
 requestAnimationFrame(fitLegend);
 byId('composer-attribution').textContent='Créditos do mapa-base: '+(previewBase?.getAttribution?.()||'Consulte as fontes do mapa principal.');
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
byId('composer-add-label').addEventListener('click',()=>{
 const node=document.createElement('div');node.id='composer-user-label-'+(++labelCount);node.className='composer-movable composer-user-label';node.textContent=byId('composer-new-label').value.trim()||'Novo texto';node.contentEditable='true';Object.assign(node.style,{position:'absolute',left:'25px',top:'25px',width:'170px',height:'35px',fontSize:'14px'});preview.appendChild(node);makeInteractive(node);selectElement(node);
});
byId('composer-font-size').addEventListener('input',e=>{if(!selectedElement)return;const target=selectedElement.id==='composer-legend-display'?selectedElement.querySelector('.composer-legend-content'):selectedElement;if(!target)return;target.style.fontSize=e.target.value+'px';if(selectedElement.id==='composer-legend-display')fitLegend();});
['composer-element-width','composer-element-height'].forEach(id=>byId(id).addEventListener('input',applyElementSize));
byId('composer-refresh').addEventListener('click',updatePreview);byId('composer-fit').addEventListener('click',()=>{autoFrame=true;fitFrame();});byId('composer-zoom-in').addEventListener('click',()=>{autoFrame=false;previewMap?.zoomIn();});byId('composer-zoom-out').addEventListener('click',()=>{autoFrame=false;previewMap?.zoomOut();});byId('composer-orientation').addEventListener('change',()=>{requestAnimationFrame(()=>{previewMap?.invalidateSize({pan:false});fitFrame();});});
['composer-map-title','composer-subtitle','composer-orientation','composer-legend','composer-north','composer-scale','composer-source','composer-source-text','composer-north-style'].forEach(id=>byId(id).addEventListener('input',updateLayout));
['composer-preview-title','composer-preview-subtitle','composer-source-display'].forEach(id=>byId(id).addEventListener('input',()=>edited.add(id)));byId('composer-legend-text').addEventListener('input',()=>{
 const v=byId('composer-legend-text').value.trim();
 if(!v){updatePreview();return;}
 const box=byId('composer-legend-display');
 let content=box.querySelector(':scope > .composer-legend-content');
 if(!content){setElementContent(box,'<div class="composer-legend-content"></div>');content=box.querySelector('.composer-legend-content');}
 content.textContent=v;requestAnimationFrame(fitLegend);
});})();