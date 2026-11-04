/** PDF panel: actual PDF.js rendering, page text & source-linked capture. */
import * as pdfjs from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

export async function showPdf({container, document, api, onCapture}) {
  container.replaceChildren(el('p','', 'Abrindo PDF original...'));
  const r = await api('/api/documents/'+encodeURIComponent(document.id));
  const bytes = new Uint8Array(await r.arrayBuffer());
  const pdf = await pdfjs.getDocument({data: bytes}).promise;
  if (!container.isConnected) {await pdf.destroy(); return;}
  let pageNumber = 1;
  let currentText = '';
  const viewer = el('div','pdf-viewer');
  const toolbar = el('div','pdf-controls');
  const prev = el('button','','← Página');
  const number = el('span','', `1 / ${pdf.numPages}`);
  const next = el('button','','Próxima →');
  const capture = el('button','','↗ Enviar texto ao caderno');
  const figure = el('canvas','pdf-preview');
  const help = el('small','', 'Selecione um trecho do texto extraído abaixo para capturar só a seleção.');
  const selectedText = el('pre','pdf-extracted');
  toolbar.append(prev,number,next,capture);
  viewer.append(toolbar,figure,help,selectedText);
  container.replaceChildren(viewer);
  let rendering = false;
  async function paint() {
    if(rendering || !viewer.isConnected) return;
    rendering=true;
    prev.disabled = pageNumber === 1;
    next.disabled = pageNumber === pdf.numPages;
    number.textContent = `${pageNumber} / ${pdf.numPages}`;
    try {
      const page = await pdf.getPage(pageNumber);
      const natural = page.getViewport({scale:1});
      const scale = Math.max(.5, Math.min(1.8, (container.clientWidth - 22) / natural.width));
      const vp = page.getViewport({scale});
      const dpr = Math.min(devicePixelRatio || 1, 2);
      figure.width = Math.ceil(vp.width * dpr);
      figure.height = Math.ceil(vp.height * dpr);
      figure.style.width = Math.ceil(vp.width) + 'px';
      figure.style.height = Math.ceil(vp.height) + 'px';
      const ctx=figure.getContext('2d', {alpha:false});
      await page.render({canvasContext:ctx,canvas:figure,viewport:vp,transform:dpr!==1?[dpr,0,0,dpr,0,0]:undefined}).promise;
      const content = await page.getTextContent();
      currentText = content.items.filter(item => 'str' in item).map(item => item.str).join(' ');
      selectedText.textContent = currentText || '(Esta página não contém texto extraível; OCR fica para uma release futura.)';
    } finally {rendering=false;}
  }
  prev.onclick=()=>{if(!rendering && pageNumber>1){pageNumber--;paint();}};
  next.onclick=()=>{if(!rendering && pageNumber<pdf.numPages){pageNumber++;paint();}};
  capture.onclick=()=>{
    const selection = window.getSelection();
    const selected = selection && selectedText.contains(selection.anchorNode) && selectedText.contains(selection.focusNode)
      ? selection.toString().trim() : '';
    const text=(selected || currentText).slice(0,4000).trim();
    if(!text) {window.alert('A página não tem texto extraível.');return;}
    onCapture({text,source:{kind:'pdf',name:document.name,documentId:document.id,page:pageNumber}});
  };
  await paint();
}
