/** PDF.js reading panel: real pages, aligned selectable text and source-aware capture.
 * No OCR, inferred semantics or forced navigation to another view. */
import * as pdfjs from 'pdfjs-dist';
import 'pdfjs-dist/web/pdf_viewer.css';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};

export async function showPdf({container,document,api,initialPage=1,onPageChange=()=>{},onCapture=()=>{}}){
  container.replaceChildren(el('div','reader-empty','Carregando página original...'));
  const response=await api('/api/documents/'+encodeURIComponent(document.id));
  const bytes=new Uint8Array(await response.arrayBuffer());
  const pdf=await pdfjs.getDocument({data:bytes}).promise;
  if(!container.isConnected){await pdf.destroy();return;}
  let pageNumber=Math.max(1,Math.min(pdf.numPages,Number(initialPage)||1));
  let disposed=false,rendering=false,queued=false;
  const viewer=el('div','pdf-viewer'),controls=el('div','pdf-controls');
  const previous=el('button','','←'),count=el('span','pdf-page-count'),next=el('button','','→');
  const send=el('button','primary-capture','↗ Caderno');
  const tray=el('button','','＋ Guardar');
  const selectHelp=el('div','pdf-hint','Selecione texto na página; “Caderno” insere sem sair da bancada. “Guardar” preserva na bandeja.');
  const scroller=el('div','pdf-scroll');
  const sheet=el('div','pdf-page-shell');
  const canvas=el('canvas','pdf-preview');
  const textLayer=el('div','pdf-text-layer textLayer');
  sheet.append(canvas,textLayer);scroller.append(sheet);
  controls.append(previous,count,next,send,tray);
  viewer.append(controls,scroller,selectHelp);container.replaceChildren(viewer);
  async function paint(){
    if(disposed||!viewer.isConnected)return;
    if(rendering){queued=true;return;}
    rendering=true;previous.disabled=pageNumber<=1;next.disabled=pageNumber>=pdf.numPages;
    count.textContent=`PÁGINA ${String(pageNumber).padStart(2,'0')} / ${pdf.numPages}`;
    const requestedPage=pageNumber;
    try{
      const page=await pdf.getPage(requestedPage);
      const natural=page.getViewport({scale:1});
      const maxWidth=Math.max(220,scroller.clientWidth-30);
      const scale=Math.max(.32,Math.min(2.5,maxWidth/natural.width));
      const viewport=page.getViewport({scale});
      const dpr=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.ceil(viewport.width*dpr);
      canvas.height=Math.ceil(viewport.height*dpr);
      canvas.style.width=viewport.width+'px';canvas.style.height=viewport.height+'px';
      sheet.style.width=viewport.width+'px';sheet.style.height=viewport.height+'px';
      textLayer.replaceChildren();
      textLayer.style.width=viewport.width+'px';textLayer.style.height=viewport.height+'px';
      textLayer.style.setProperty('--total-scale-factor', String(viewport.scale));
      const context=canvas.getContext('2d',{alpha:false});
      await page.render({canvasContext:context,canvas,viewport,transform:dpr!==1?[dpr,0,0,dpr,0,0]:undefined}).promise;
      if(!disposed&&requestedPage===pageNumber){
        try{
          const selectable=new pdfjs.TextLayer({textContentSource:page.streamTextContent(),container:textLayer,viewport});
          await selectable.render();
        }catch(error){console.warn('PDF text layer unavailable for this page:',error);selectHelp.textContent='Esta página não ofereceu texto selecionável. É possível ler normalmente; OCR fica para uma versão futura.';}
      }
    }finally{
      rendering=false;
      if(queued){queued=false;paint();}
    }
  }
  function navigate(step){
    if(disposed)return;
    const nextPage=Math.max(1,Math.min(pdf.numPages,pageNumber+step));
    if(nextPage===pageNumber)return;
    pageNumber=nextPage;onPageChange(pageNumber);scroller.scrollTop=0;paint();
  }
  previous.onclick=()=>navigate(-1);next.onclick=()=>navigate(1);
  function getCapture(){
    const selection=window.getSelection();
    if(!selection||selection.isCollapsed||!textLayer.contains(selection.anchorNode)||!textLayer.contains(selection.focusNode)){
      selectHelp.textContent='Primeiro selecione um trecho do PDF com o mouse ou toque.';return null;
    }
    const text=selection.toString().trim().slice(0,4500);if(!text)return null;
    const source={kind:'pdf',name:document.name,documentId:document.id,page:pageNumber};
    try{
      const box=textLayer.getBoundingClientRect(),sel=selection.getRangeAt(0).getBoundingClientRect();
      source.rect={x:Math.max(0,(sel.x-box.x)/box.width),y:Math.max(0,(sel.y-box.y)/box.height),
        w:Math.min(1,sel.width/box.width),h:Math.min(1,sel.height/box.height)};
    }catch{}
    return{text,source};
  }
  // Keep the text selection alive while users click the contextual action.
  for(const button of [send,tray])button.addEventListener('pointerdown',e=>e.preventDefault());
  send.onclick=()=>{const capture=getCapture();if(capture)onCapture(capture,'insert');};
  tray.onclick=()=>{const capture=getCapture();if(capture)onCapture(capture,'tray');};
  const observer=new ResizeObserver(()=>{if(!disposed)paint();});
  observer.observe(scroller);
  await paint();
  return async()=>{disposed=true;observer.disconnect();await pdf.destroy();};
}
