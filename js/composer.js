/* GeoEdu Lab v2.0.0 — compositor de prévia A4. Exportação será disponibilizada após validação. */
(()=>{
'use strict';
const byId=id=>document.getElementById(id);
const dialog=byId('composer-modal'),button=byId('btn-composer'),close=byId('composer-close');
const preview=byId('composer-page'),status=byId('composer-status');
let previewMap=null,previewBase=null;
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
function updateLayout(){
 byId('composer-preview-title').textContent=byId('composer-map-title').value.trim()||'Mapa sem título';
 byId('composer-preview-subtitle').textContent=byId('composer-subtitle').value.trim();
 preview.classList.toggle('portrait',byId('composer-orientation').value==='portrait');
 byId('composer-north-mark').hidden=!byId('composer-north').checked;
 byId('composer-legend-display').hidden=!byId('composer-legend').checked;
 byId('composer-scale-display').hidden=!byId('composer-scale').checked;
 byId('composer-source-display').hidden=!byId('composer-source').checked;
 byId('composer-source-display').textContent='Fonte: '+byId('composer-source-text').value.trim();
 if(previewMap){setTimeout(()=>previewMap.invalidateSize(),0);}
}
function updatePreview(){
 updateLayout();
 if(!previewMap){
 previewMap=L.map('composer-map',{zoomControl:false,preferCanvas:true,attributionControl:true,scrollWheelZoom:false});
 L.control.scale({imperial:false,position:'bottomleft'}).addTo(previewMap);
 }
 if(previewBase)previewMap.removeLayer(previewBase);
 previewBase=newBase(activeBase()).addTo(previewMap);
 previewMap.setView(map.getCenter(),map.getZoom(),{animate:false});
 byId('composer-scale-display').textContent='Escala gráfica e atribuições: no quadro do mapa';
 const legend=byId('legend-content');
 byId('composer-legend-display').textContent=legend?.innerText?.trim()||'Nenhuma camada temática visível.';
 status.textContent='Prévia A4 atualizada com o mapa-base e o enquadramento atuais. As camadas temáticas ainda não são reproduzidas nesta etapa.';
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
['composer-map-title','composer-subtitle','composer-orientation','composer-legend','composer-north','composer-scale','composer-source','composer-source-text'].forEach(id=>byId(id).addEventListener('input',updateLayout));
})();