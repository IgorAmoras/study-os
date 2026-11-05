# Sprint 03 — A bancada como principal superfície do Study OS

## Por que

Durante o discovery, foi decidido que o caderno seria infinito e compartilhado, que a captura de PDF não deveria roubar foco, que arquivos científicos manteriam sua origem e que o layout seria restaurável. Antes desta sprint, `setView('notebook')` interrompia o fluxo de leitura após cada captura de PDF. Além disso, o caderno estava numa tela distinta da bancada.

## O que mudou

1. A mesma instância do Super Caderno é **movida no DOM** entre a bancada e a visualização expandida: nenhum canvas extra, nenhuma segunda conexão WebSocket.
2. Leitor com abas para materiais do Git ou PDFs importados e seleção de aba ativa persistida (`workspace.activePanelId`). O repositório original permanece somente leitura.
3. Três presets (`balanced`, `reading`, `writing`) e divisória arrastável/operável pelo teclado; largura e bandeja ficam salvas em `workspace.layout` e `workspace.captures`.
4. Captura de trechos selecionados com `documentId`, página e coordenadas normalizadas da seleção no PDF; uma ação insere diretamente no caderno e outra guarda na bandeja.
5. Código/Markdown também podem ser selecionados e capturados com origem (`kind: file` e caminho Git), sem trocar de tela.
6. O canvas aceita Ctrl+V quando focado e desenha cartões de texto como objetos separados, com rótulo da fonte. Câmera/zoom do tablet permanecem independentes.
7. PDF.js agora renderiza uma camada de texto selecionável sobre o canvas da página, sem um segundo bloco de texto extraído abaixo. PDFs sem texto extraível continuam legíveis, mas exigem OCR futuro para captura.

## Fluxo principal

Abrir bancada → importar ou selecionar paper/arquivo → selecionar trecho → `Caderno` → editar/anotar com mouse/S Pen → retomar leitura → salvar checkpoint → fechar/reabrir. Nenhuma dessas ações obrigatórias muda a vista.

## Persistência

`workspace` é um objeto no JSON local contendo `activePanelId`, `panels[]` com `page`/`scrollTop`, `layout` e `captures[]`. O texto copiado para o caderno vira um `CanvasElement` com ID durável, replicado pelo WebSocket e salvo pelo sistema existente. Capturas guardadas são metadados de fluxo: não são cópias de PDFs.

## Limitações verificáveis

- No fallback `legacy/`, o PDF usa o plugin nativo do navegador e não oferece seleção com origem na página; esta parte requer o frontend PDF.js via `npm run dev`.
- Nenhum OCR, equação em LaTeX editável, recorte de figura ou laço/agrupamento robusto ainda.
- A seleção no PDF depende da disponibilidade de camada textual no arquivo.
- O teste na S Pen e a medição de latência em hardware real ainda faltam.
- O build Vite/React/PDF.js e typecheck não puderam ser realizados sem resolver as dependências npm neste ambiente. A captura da interface `legacy/` no Chromium não prova que o build moderno passou.

## Testes

`npm test`: testes HTTP/WS existentes + testes de migração de estado da bancada, presets, promoção de fragmento e recarga da persistência. Fluxo em Chromium: arquivo real de controle → seleção → bandeja → cartão no caderno → desenho → arranjos → caderno expandido.
