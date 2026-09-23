/* GeoEdu Lab v2.3.4 — compositor de prévia A4. Exportação será disponibilizada após validação. */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const dialog=byId('composer-modal'),button=byId('btn-composer'),close=byId('composer-close');
const preview=byId('composer-page'),status=byId('composer-status');
let interactionsReady=false,layoutOrientation='landscape',composerZ=20,selectedElement=null,labelCount=0;let legendDraft=null,legendEditing=false;let previewMap=null,previewBase=null,previewVectors=[];let mapFrameObserver=null,autoFrame=true,resizeQueued=false;const edited=new Set();
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
function northStyle(){
 const type=byId('composer-north-style').value,node=byId('composer-north-mark');
 const paths={
 arrow:'<path d="M32 5 48 54 32 46 16 54Z" fill="#173f48"/><path d="M32 5V46L16 54Z" fill="#fff" stroke="#173f48" stroke-width="1.4"/>',
 compass:'<path d="M32 3 39 28 61 36 39 44 32 69 25 44 3 36 25 28Z" fill="#173f48"/><path d="M32 3V69L25 44 3 36 25 28Z" fill="#fff" stroke="#173f48" stroke-width="1.4"/>',
 needle:'<path d="M32 4 44 61 32 50 20 61Z" fill="#173f48"/><path d="M32 4V50L20 61Z" fill="#fff" stroke="#173f48" stroke-width="1.4"/>'
 };
 const symbol=type==='letter'?'<text x="32" y="52" text-anchor="middle" font-size="46" font-weight="700" fill="#173f48">N</text>':paths[type]||paths.arrow;
 setElementContent(node,'<svg viewBox="0 0 64 80" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Orientação norte">'+symbol+(type==='letter'?'':'<text x="32" y="79" text-anchor="middle" font-size="10" font-weight="700" fill="#173f48">N</text>')+'</svg>');
 node.style.display=node.hidden?'none':'flex';
}
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
 byId('composer-delete-label').hidden=!node.classList.contains('composer-user-label');
 byId('composer-element-width').value=Math.round(node.getBoundingClientRect().width);
 byId('composer-element-height').value=Math.round(node.getBoundingClientRect().height);
}
function applySelectedDimensions(){
 const node=selectedElement;if(!node||!preview.contains(node))return;
 const maxW=Math.max(40,preview.clientWidth-node.offsetLeft),maxH=Math.max(25,preview.clientHeight-node.offsetTop);
 const w=Number(byId('composer-element-width').value),h=Number(byId('composer-element-height').value);
 if(Number.isFinite(w)&&w>0)node.style.width=Math.min(maxW,Math.max(40,w))+'px';
 if(Number.isFinite(h)&&h>0)node.style.height=Math.min(maxH,Math.max(25,h))+'px';
 if(node.id==='composer-legend-display')requestAnimationFrame(fitLegend);
 if(node.id==='composer-scale-display')requestAnimationFrame(updateScale);
 if(node.classList.contains('composer-map-row'))requestAnimationFrame(()=>{previewMap?.invalidateSize({pan:false});updateScale();});
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
  if(node.matches('[contenteditable]')&&node.id!=='composer-legend-display'){node.contentEditable='false';node.title='Arraste para mover; clique duas vezes para editar o texto';node.addEventListener('dblclick',e=>{e.stopPropagation();node.contentEditable='true';node.focus();});node.addEventListener('blur',()=>{node.contentEditable='false';});}
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
   selectElement(node);
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
  if(node.id==='composer-legend-display'){
   node.addEventListener('dblclick',e=>{
    if(e.target.closest('.composer-resize-handle,.composer-move-handle'))return;
    e.preventDefault();e.stopPropagation();
    const content=node.querySelector('.composer-legend-content');if(!content)return;
    legendEditing=true;content.contentEditable='true';content.style.zoom='1';content.focus();
   });
   node.addEventListener('focusout',e=>{
    if(!node.contains(e.relatedTarget)&&legendEditing){
     const content=node.querySelector('.composer-legend-content');
     if(content){legendDraft=content.innerHTML;content.contentEditable='false';}
     legendEditing=false;requestAnimationFrame(fitLegend);
    }
   });
  }
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
 const legend=byId('legend-content'),custom=byId('composer-legend-text').value.trim();
 const legendBox=byId('composer-legend-display');
 if(!legendEditing){
  let content=legendBox.querySelector(':scope > .composer-legend-content');
  const savedFont=content?.style.fontSize||'';
  if(!content){content=document.createElement('div');content.className='composer-legend-content';legendBox.prepend(content);}
  content.contentEditable='false';
  if(legendDraft!==null)content.innerHTML=legendDraft;
  else if(custom)content.textContent=custom;
  else content.innerHTML=legend?.innerHTML||'Nenhuma camada temática visível.';
  content.style.fontSize=savedFont;
  content.querySelectorAll('button,input,select,hr').forEach(el=>el.remove());
  content.querySelectorAll('*').forEach(el=>{el.style.borderTop='none';el.style.borderBottom='none';el.style.boxShadow='none';});
 }
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
// Close only via the explicit close button or Escape. A click outside the page must not discard an active composition.
document.addEventListener('keydown',event=>{if(event.key==='Escape'&&!dialog.hidden)dismiss();});
byId('composer-delete-label').addEventListener('click',()=>{if(!selectedElement?.classList.contains('composer-user-label'))return;selectedElement.remove();selectedElement=null;byId('composer-selected-name').textContent='Clique em um elemento na página';byId('composer-text-tools').hidden=true;byId('composer-delete-label').hidden=true;});
byId('composer-add-label').addEventListener('click',()=>{
 const node=document.createElement('div');node.id='composer-user-label-'+(++labelCount);node.className='composer-movable composer-user-label';node.textContent=byId('composer-new-label').value.trim()||'Novo texto';node.contentEditable='true';Object.assign(node.style,{position:'absolute',left:'25px',top:'25px',width:'170px',height:'35px',fontSize:'14px'});preview.appendChild(node);makeInteractive(node);selectElement(node);
});
['composer-element-width','composer-element-height'].forEach(id=>byId(id).addEventListener('change',applySelectedDimensions));
byId('composer-font-size').addEventListener('input',e=>{if(!selectedElement)return;const target=selectedElement.id==='composer-legend-display'?selectedElement.querySelector('.composer-legend-content'):selectedElement;if(!target)return;target.style.fontSize=e.target.value+'px';if(selectedElement.id==='composer-legend-display')fitLegend();});

const pdfPageStyle=document.createElement('style');
pdfPageStyle.id='composer-pdf-page-size';
pdfPageStyle.media='print';
document.head.appendChild(pdfPageStyle);
function syncPdfPageSize(){
 const portrait=byId('composer-orientation').value==='portrait';
 pdfPageStyle.textContent='@page { size: '+(portrait?'210mm 297mm':'297mm 210mm')+'; margin: 0; }';
 return portrait;
}
byId('composer-export-pdf').addEventListener('click',()=>{
 if(dialog.hidden)return;
 const portrait=syncPdfPageSize();
 status.textContent='PDF A4 '+(portrait?'retrato':'paisagem')+': orientação solicitada automaticamente ao navegador. Em Salvar como PDF, o tamanho do papel pode não ser editável; confira a orientação e a prévia antes de salvar. Use Todas as páginas (não Apenas páginas pares), margens Nenhuma, escala 100% e gráficos de fundo.';
 requestAnimationFrame(()=>requestAnimationFrame(()=>window.print()));
});
window.addEventListener('beforeprint',syncPdfPageSize);


function rasterDimensions(){
 const dpi=Number(byId('composer-raster-dpi').value);
 const portrait=byId('composer-orientation').value==='portrait';
 return {width:Math.round((portrait?210:297)/25.4*dpi),height:Math.round((portrait?297:210)/25.4*dpi),dpi};
}
function updateRasterEstimate(){
 const {width,height,dpi}=rasterDimensions();
 const format=byId('composer-raster-format').value;
 const rawMB=width*height*4/1048576;
 byId('composer-raster-estimate').textContent=width+' × '+height+' px · '+dpi+' DPI · memória mínima aproximada para um bitmap RGBA: '+rawMB.toFixed(0)+' MB'+(dpi===600?' — alta resolução: pode exigir várias vezes essa memória durante a captura e codificação.':'')+(format==='tiff'?' TIFF sem compressão pode gerar arquivo de tamanho elevado.':'');
}
byId('composer-raster-format').addEventListener('change',updateRasterEstimate);
byId('composer-raster-dpi').addEventListener('change',updateRasterEstimate);
byId('composer-orientation').addEventListener('change',updateRasterEstimate);
updateRasterEstimate();
let rasterExportBusy=false;
function saveRasterBlob(blob,extension){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download='GeoEdu_Lab_mapa_'+(byId('composer-orientation').value==='portrait'?'retrato':'paisagem')+'.'+extension;
 document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function exportRaster(){
 if(rasterExportBusy||dialog.hidden)return;
 const format=byId('composer-raster-format').value,dpi=Number(byId('composer-raster-dpi').value);
 if(!['jpeg','tiff'].includes(format)||![150,300,600].includes(dpi))return;
 if(typeof html2canvas!=='function'||(format==='tiff'&&typeof UTIF==='undefined')){
  status.textContent='Biblioteca de exportação indisponível. Verifique sua conexão e atualize a página.';return;
 }
 rasterExportBusy=true;
 const exportButton=byId('composer-export-raster');exportButton.disabled=true;
 
 try{
  status.textContent='Preparando exportação '+format.toUpperCase()+' a '+dpi+' DPI…';
  // Wait for the preview's visible tiles and vector canvas to settle.
  previewMap?.invalidateSize({pan:false});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const {width,height}=rasterDimensions();
  if(width*height>36000000)throw Error('Dimensões acima do limite de segurança de exportação.');
  const rect=preview.getBoundingClientRect();
  const canvas=await html2canvas(preview,{
   backgroundColor:'#ffffff',useCORS:true,allowTaint:false,logging:false,
   scale:1,width:rect.width,height:rect.height,scrollX:0,scrollY:0,
   onclone:doc=>{
    const page=doc.getElementById('composer-page');
    // Export only the paper: never capture the editor's grey backdrop or paper shadow.
    page.style.setProperty('background','#ffffff','important');
    page.style.setProperty('background-color','#ffffff','important');
    page.style.setProperty('background-image','none','important');
    page.style.setProperty('box-shadow','none','important');
    page.style.setProperty('border','0','important');
    page.querySelectorAll('.composer-move-handle,.composer-resize-handle').forEach(el=>el.remove());
    page.querySelectorAll('.composer-interactive').forEach(el=>{el.style.outline='none';el.style.boxShadow='none';});
    const legend=doc.getElementById('composer-legend-display');if(legend)legend.style.outline='none';
   }
  });
  if(canvas.width===0||canvas.height===0)throw Error('A captura da página não retornou pixels.');
  status.textContent='Codificando '+format.toUpperCase()+' ('+width+' × '+height+' px)…';
  const out=document.createElement('canvas');out.width=width;out.height=height;
  const ctx=out.getContext('2d',{willReadFrequently:format==='tiff'});
  if(!ctx)throw Error('Não foi possível criar o canvas de exportação.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  ctx.drawImage(canvas,0,0,width,height);
  // Force opaque white paper only where the captured page is transparent;
  // preserve thematic colours, imagery and intentional light-grey map features.
  if(format==='jpeg'){
   const blob=await new Promise(resolve=>out.toBlob(resolve,'image/jpeg',.94));
   if(!blob)throw Error('Falha ao codificar JPEG.');
   saveRasterBlob(blob,'jpg');
  }else{
   const pixels=ctx.getImageData(0,0,width,height).data;
   const buffer=UTIF.encodeImage(pixels,width,height,{t282:[dpi,1],t283:[dpi,1],t296:2});
   saveRasterBlob(new Blob([buffer],{type:'image/tiff'}),'tif');
  }
  status.textContent='Exportação '+format.toUpperCase()+' iniciada ('+width+' × '+height+' px). Confira o arquivo: imagens-base remotas podem restringir a captura; este TIFF não é georreferenciado.';
 }catch(err){
  status.textContent='Falha na exportação raster: '+err.message+'. Em 600 DPI, tente 300 DPI se o navegador ficar sem memória; verifique também as permissões do mapa-base.';
 }finally{rasterExportBusy=false;exportButton.disabled=false;}
}
byId('composer-export-raster').addEventListener('click',exportRaster);

/* Write baseline little-endian RGBA TIFF with explicit GeoTIFF tags.
   UTIF.encodeImage does not preserve caller-supplied GeoTIFF tags. */
function encodeGeoTiffRGBA(rgba,w,h,dx,dy,minX,maxY){
 const keys=[1,1,0,3,1024,0,1,1,1025,0,1,1,3072,0,1,3857];
 const ascii='WGS 84 / Pseudo-Mercator|';
 const entries=[
 [256,4,1,w],[257,4,1,h],[258,3,4,[8,8,8,8]],
 [259,3,1,1],[262,3,1,2],[273,4,1,0],
 [277,3,1,4],[278,4,1,h],[279,4,1,rgba.length],
 [282,5,1,[150,1]],[283,5,1,[150,1]],[284,3,1,1],
 [296,3,1,2],[338,3,1,2],
 [33550,12,3,[dx,dy,0]],[33922,12,6,[0,0,0,minX,maxY,0]],
 [34735,3,keys.length,keys],[34737,2,ascii.length+1,ascii+'\\0']
 ].sort((a,b)=>a[0]-b[0]);
 const count=entries.length,ifdOffset=8,ifdEnd=ifdOffset+2+count*12+4;
 let cursor=ifdEnd;
 const align=(n)=> (n+3)&~3;
 const typeSize={2:1,3:2,4:4,5:8,12:8};
 const data=[];
 for(const entry of entries){
  const [tag,type,n,val]=entry;
  if(tag===273)continue;
  const size=typeSize[type]*n;
  if(size>4){cursor=align(cursor);data.push({entry,offset:cursor});cursor+=size;}
 }
 cursor=align(cursor);
 const pixelOffset=cursor;
 entries.find(e=>e[0]===273)[3]=pixelOffset;
 const buffer=new ArrayBuffer(pixelOffset+rgba.length);
 const dv=new DataView(buffer);
 dv.setUint16(0,0x4949,true);dv.setUint16(2,42,true);dv.setUint32(4,ifdOffset,true);
 dv.setUint16(ifdOffset,count,true);
 function writeValue(type,n,value,offset){
  if(type===2){for(let k=0;k<n;k++)dv.setUint8(offset+k,value.charCodeAt(k)||0);return;}
  const vals=Array.isArray(value)?value:[value];
  for(let k=0;k<n;k++){
   if(type===3)dv.setUint16(offset+k*2,vals[k],true);
   else if(type===4)dv.setUint32(offset+k*4,vals[k],true);
   else if(type===12)dv.setFloat64(offset+k*8,vals[k],true);
   else if(type===5){dv.setUint32(offset+k*8,vals[k*2],true);dv.setUint32(offset+k*8+4,vals[k*2+1],true);}
  }
 }
 entries.forEach((e,i)=>{
  const [tag,type,n,value]=e,off=ifdOffset+2+i*12;
  dv.setUint16(off,tag,true);dv.setUint16(off+2,type,true);dv.setUint32(off+4,n,true);
  const external=data.find(d=>d.entry===e);
  if(external){dv.setUint32(off+8,external.offset,true);writeValue(type,n,value,external.offset);}
  else writeValue(type,n,value,off+8);
 });
 dv.setUint32(ifdOffset+2+count*12,0,true);
 new Uint8Array(buffer,pixelOffset,rgba.length).set(rgba);
 return buffer;
}
/* GeoTIFF: map viewport only. No paper elements or cartographic annotations. */
/* High-resolution vector-only export: draw original GeoJSON geometry at output
   pixel dimensions. Never upscale an already rasterized map screenshot. */
function drawGeoTiffVectors(ctx,ratio){
 const toPixel=coord=>{const p=previewMap.latLngToContainerPoint([coord[1],coord[0]]);return [p.x*ratio,p.y*ratio];};
 const pathLine=(coords,close)=>{coords.forEach((c,i)=>{const [x,y]=toPixel(c);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);});if(close)ctx.closePath();};
 const render=(geometry,style,radius)=>{
  if(!geometry)return;
  const type=geometry.type,coords=geometry.coordinates;
  if(type==='GeometryCollection'){geometry.geometries.forEach(g=>render(g,style,radius));return;}
  ctx.beginPath();
  if(type==='Point'||type==='MultiPoint'){
   for(const c of (type==='Point'?[coords]:coords)){const [x,y]=toPixel(c);ctx.moveTo(x+radius*ratio,y);ctx.arc(x,y,radius*ratio,0,Math.PI*2);}
  }else if(type==='LineString')pathLine(coords,false);
  else if(type==='MultiLineString')coords.forEach(line=>pathLine(line,false));
  else if(type==='Polygon')coords.forEach(ring=>pathLine(ring,true));
  else if(type==='MultiPolygon')coords.forEach(poly=>poly.forEach(ring=>pathLine(ring,true)));
  else return;
  const fill=style.fillColor||style.color||'#3388ff';
  const stroke=style.color||'#3388ff';
  ctx.globalAlpha=Number.isFinite(+style.fillOpacity)?+style.fillOpacity:0.2;
  ctx.fillStyle=fill;
  if(type==='Polygon'||type==='MultiPolygon'||type==='Point'||type==='MultiPoint')ctx.fill('evenodd');
  ctx.globalAlpha=Number.isFinite(+style.opacity)?+style.opacity:1;
  ctx.strokeStyle=stroke;ctx.lineWidth=Math.max(.25,(+style.weight||1)*ratio);
  if(style.dashArray)ctx.setLineDash(String(style.dashArray).split(/[ ,]+/).map(Number).filter(Number.isFinite).map(n=>n*ratio));
  else ctx.setLineDash([]);
  if(style.stroke!==false)ctx.stroke();
  ctx.globalAlpha=1;ctx.setLineDash([]);
 };
 for(const key of visibleThemeKeys()){
  const layer=thematicLayerByKey(key);
  layer.eachLayer(child=>{
   if(!child.feature||!child.toGeoJSON)return;
   const style={...child.options,...categoryStyle(key,child.feature)};
   const geometry=child.toGeoJSON().geometry;
   render(geometry,style,child instanceof L.CircleMarker?child.getRadius():4);
  });
 }
}
async function exportGeoTiff(){
 const button=byId('composer-export-geotiff');
 if(rasterExportBusy||dialog.hidden||!previewMap)return;
 if(typeof html2canvas!=='function'||typeof UTIF==='undefined'){
  status.textContent='Bibliotecas de exportação indisponíveis.';return;
 }
 rasterExportBusy=true;button.disabled=true;byId('composer-export-raster').disabled=true;
 try{
  previewMap.invalidateSize({pan:false});
  await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
  const mapNode=previewMap.getContainer(),rect=mapNode.getBoundingClientRect();
  const mapSize=previewMap.getSize();
  if(mapSize.x<2||mapSize.y<2)throw Error('Quadro do mapa sem dimensões válidas.');
  // GeoTIFF pixel size must reflect the map's actual rendered detail.
  // Enlarging a screenshot to a nominal DPI only duplicates/interpolates pixels.
  const vectorMode=byId('composer-geotiff-mode').value==='vector';
  const factor=vectorMode?Number(byId('composer-geotiff-factor').value):1;
  if(![1,2,3,4].includes(factor))throw Error('Fator de resolução inválido.');
  const width=Math.round(mapSize.x*factor),height=Math.round(mapSize.y*factor);
  if(width*height>36000000)throw Error('Imagem muito grande para exportação segura. Reduza a resolução.');
  const nw=previewMap.containerPointToLatLng([0,0]);
  const se=previewMap.containerPointToLatLng([mapSize.x,mapSize.y]);
  if(![nw.lat,nw.lng,se.lat,se.lng].every(Number.isFinite)||Math.abs(nw.lat)>85.05112878||Math.abs(se.lat)>85.05112878)throw Error('Extensão fora dos limites do Web Mercator.');
  if(nw.lng>=se.lng||se.lng-nw.lng>=180)throw Error('Extensão atravessa o antimeridiano ou não é válida para esta exportação.');
  const merc=(lat,lng)=>{
   const phi=lat*Math.PI/180;
   return [6378137*lng*Math.PI/180,6378137*Math.log(Math.tan(Math.PI/4+phi/2))];
  };
  const [minX,maxY]=merc(nw.lat,nw.lng),[maxX,minY]=merc(se.lat,se.lng);
  const dx=(maxX-minX)/width,dy=(maxY-minY)/height;
  if(!(dx>0&&dy>0))throw Error('Resolução espacial inválida.');
  const out=document.createElement('canvas');out.width=width;out.height=height;
  const ctx=out.getContext('2d',{willReadFrequently:true});
  if(!ctx)throw Error('Não foi possível criar a imagem.');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);
  if(vectorMode){
   if(!visibleThemeKeys().length)throw Error('Ative ao menos uma camada vetorial para exportar em alta resolução.');
   status.textContent='Renderizando geometrias vetoriais em '+width+' × '+height+' pixels…';
   drawGeoTiffVectors(ctx,factor);
  }else{
   status.textContent='Capturando GeoTIFF na resolução nativa do quadro…';
   const captured=await html2canvas(mapNode,{backgroundColor:'#ffffff',useCORS:true,allowTaint:false,logging:false,scale:1,width:rect.width,height:rect.height,scrollX:0,scrollY:0,
    onclone:doc=>{const n=doc.getElementById(mapNode.id);if(n)n.querySelectorAll('.leaflet-control-container,.composer-move-handle,.composer-resize-handle').forEach(el=>el.remove());}
   });
   if(!captured.width||!captured.height)throw Error('A captura do mapa não retornou pixels.');
   ctx.imageSmoothingEnabled=false;
   ctx.drawImage(captured,0,0,width,height);
  }
  status.textContent='Codificando GeoTIFF EPSG:3857 na resolução nativa…';
  const pixels=ctx.getImageData(0,0,width,height).data;
  // GeoTIFF 1.0: ModelPixelScaleTag, ModelTiepointTag, GeoKeyDirectoryTag.
  // 1024 ModelTypeProjected; 1025 RasterPixelIsArea; 3072 ProjectedCSTypeGeoKey.
  const encoded=encodeGeoTiffRGBA(pixels,width,height,dx,dy,minX,maxY);
  // Verify the encoded IFD and geospatial tags before offering a download.
  const ifd=UTIF.decode(encoded)[0];
  const close=(a,b)=>Math.abs(a-b)<=Math.max(1e-7,Math.abs(b)*1e-10);
  if(!ifd||!ifd.t33550||!ifd.t33922||!ifd.t34735||
   !close(ifd.t33550[0],dx)||!close(ifd.t33550[1],dy)||
   !close(ifd.t33922[3],minX)||!close(ifd.t33922[4],maxY)||
   !ifd.t34735.includes(3857))throw Error('Metadados GeoTIFF não foram preservados.');
  const blob=new Blob([encoded],{type:'image/tiff'});
  const url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='GeoEdu_Lab_quadro_EPSG3857.tif';
  document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
  status.textContent='GeoTIFF EPSG:3857 gerado ('+width+' × '+height+' px). Modo '+(vectorMode?'vetorial de alta resolução, fundo branco e sem mapa-base':'nativo com mapa-base')+'. Verifique SRC e alinhamento no QGIS.';
 }catch(err){status.textContent='GeoTIFF não gerado: '+err.message;}
 finally{rasterExportBusy=false;button.disabled=false;byId('composer-export-raster').disabled=false;}
}
byId('composer-export-geotiff').addEventListener('click',exportGeoTiff);

byId('composer-refresh').addEventListener('click',updatePreview);byId('composer-fit').addEventListener('click',()=>{autoFrame=true;fitFrame();});byId('composer-zoom-in').addEventListener('click',()=>{autoFrame=false;previewMap?.zoomIn();});byId('composer-zoom-out').addEventListener('click',()=>{autoFrame=false;previewMap?.zoomOut();});byId('composer-orientation').addEventListener('change',()=>{requestAnimationFrame(()=>{previewMap?.invalidateSize({pan:false});fitFrame();});});
['composer-map-title','composer-subtitle','composer-orientation','composer-legend','composer-north','composer-scale','composer-source','composer-source-text','composer-north-style'].forEach(id=>byId(id).addEventListener('input',updateLayout));
['composer-preview-title','composer-preview-subtitle','composer-source-display'].forEach(id=>byId(id).addEventListener('input',()=>edited.add(id)));byId('composer-legend-text').addEventListener('input',()=>{
 const v=byId('composer-legend-text').value.trim();
 legendDraft=null;if(!v){updatePreview();return;}
 const box=byId('composer-legend-display');
 let content=box.querySelector(':scope > .composer-legend-content');
 if(!content){setElementContent(box,'<div class="composer-legend-content"></div>');content=box.querySelector('.composer-legend-content');}
 content.textContent=v;legendDraft=content.innerHTML;requestAnimationFrame(fitLegend);
});})();
