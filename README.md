# Study OS · Cosmic Laboratory

**Primeiro fluxo vertical executável** do Study OS, conforme as 37 rodadas de discovery de 04/11/2026.

> Objetivo: estudar e pesquisar num ambiente espacial local-first, com universo 3D, bancada, arquivos científicos reais, leitura de PDF e Super Caderno Vivo entre PC e tablet. **Sem IA nesta release.**

## Instalação assistida no Windows (06/11/2026)

Clone o repositório e execute a rotina de preparação, que verifica Node/Git,
clona a pesquisa científica em pasta separada caso necessário, instala dependências
e executa testes, typecheck e build:

```powershell
cd $HOME
git clone https://github.com/IgorAmoras/study-os.git StudyOS
cd .\StudyOS
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\setup-windows.ps1
```

Depois da primeira instalação, abra `Start-StudyOS.cmd` por duplo clique.
O app inicia somente em `http://127.0.0.1:4317` e os dados locais ficam em
`.studyos-data/` (ignorada pelo Git). Para usar uma cópia já existente da
pesquisa, passe `-ResearchPath "C:\\caminho\\para\\data-driven-dynamics-and-control"`
ao script de setup. O instalador ainda precisa ser validado num Windows real;
em caso de falha, examine a saída do PowerShell antes de tentar novamente.

O DeepTutor está documentado como [integração futura e opcional](docs/integrations/deeptutor.md),
sem alterar o requisito de **zero IA na primeira release**.

## Sprint 03 · Bancada integrada (05/11/2026) — v0.4.0

A bancada passou de janelas soltas para um ambiente coeso **Referências ↔ Super Caderno ↔ Contexto**, com abas de documento, presets equilibrado/leitura/escrita, divisória ajustável e contexto recolhível. O caderno visível na bancada é **a mesma instância de canvas** usada no modo expandido; os traços não são duplicados e a conexão WebSocket não é reiniciada ao mudar de vista.

No frontend Vite, PDFs importados abrem por PDF.js com camada de texto selecionável sobre a página. Selecionar e clicar em **Caderno** insere um cartão vetorial com referência ao arquivo, página e região do texto; **Guardar** adiciona à bandeja persistente para inserção posterior. Nenhuma das duas ações força mudança de tela. Também é possível selecionar código/Markdown do repositório e enviá-lo ao caderno, ou focar o canvas e colar texto via Ctrl+V. A sessão mantém aba ativa, página do PDF, fragmentos guardados e largura do leitor no JSON local. A visualização do tablet continua especializada em tinta e tem viewport independente.

**Verificações realizadas:** 13/13 testes Node, incluindo estado da bancada e idempotência de fragmentos; teste de interação do fallback no Chromium com seleção de código → bandeja → caderno sem navegar, presets e manuscrito, sem erros JavaScript. As screenshots usam `legacy/` com estado/API simulados e trechos reais de arquivos científicos como fixtures. **Não foram validados** o build React/Vite + PDF.js (registro npm inacessível neste ambiente) nem hardware real do Tab S6 FE. No fallback sem dependências, PDFs usam o visualizador embutido do navegador; a seleção PDF com proveniência fica no frontend Vite.

## Sprint 02 · Cinematic Cosmic Laboratory (05/11/2026)

Iteração visual sobre o mesmo núcleo local-first: Home orbital com atlas de pesquisa; **constelações em profundidade** e cristais facetados para os nós científicos; anéis orbitais, brilhos volumétricos, ligações curvas e sinais animados; perspectiva navegável por arraste e zoom; bancada com painéis científicos e preview de código com linhas numeradas e realce de sintaxe; no tablet, o Super Caderno ocupa a tela sem sidebar de desktop. O mesmo conjunto de coordenadas permanece no fallback canvas e no renderer React Three Fiber.

**Atenção às capturas:** screenshots de verificação usam o código real da interface `legacy/` renderizado no Chromium por `page.set_content`, contornando restrições de navegação do ambiente de testes. Os dados do estado inicial e chamadas de API foram simulados e a bancada recebeu trechos de arquivos científicos reais como fixtures. Não são provas de que a versão WebGL/React compilou, nem testes físicos da S Pen. A integração React, o desempenho GPU e a sincronização PC↔tablet precisam de validação no computador do usuário.

## Iniciar no Windows (PowerShell)

Requisitos: Node.js **20.19+** (preferencialmente Node 22 LTS), npm, Chrome/Edge atualizado.

```powershell
cd study-os
npm install
npm run dev
```

Abra **http://127.0.0.1:5173** no PC. `npm run dev` inicia o servidor de dados na porta 4317 e o Vite na 5173, ambos acessíveis **somente no próprio PC**. A aplicação carrega com Home, universo 3D e bancada. Os dados persistentes são salvos em `.studyos-data/` (fora do Git).

### Associar o repositório científico verdadeiro

O Study OS nunca altera ou duplica os scripts do repositório de pesquisa:

```powershell
# Em outra pasta, só na primeira vez:
git clone https://github.com/IgorAmoras/data-driven-dynamics-and-control.git

# Ajuste para o caminho real no seu computador antes de iniciar o Study OS:
$env:STUDYOS_RESEARCH_DIR = "C:\CAMINHO\data-driven-dynamics-and-control"
npm run dev
```

Se o repositório não estiver configurado, os links originais do GitHub continuam disponíveis, mas o painel não consegue abrir os arquivos locais. O caminho é uma autorização **explícita e somente leitura**: a API rejeita acesso fora desta árvore.

### Tablet Galaxy Tab S6 FE / S Pen (mesma rede Wi-Fi)

Na máquina Windows:

```powershell
npm run build
$env:STUDYOS_HOST = "0.0.0.0"
npm start
```

No terminal aparecerá um **token de acesso**; não o divulgue. Descubra o IPv4 local do PC com `ipconfig` e acesse no tablet `http://IP-DO-PC:4317/?tablet=1`. Insira o token quando o Study OS solicitar. Autorize a porta **somente na rede privada** no firewall do Windows, se necessário. Não exponha esta porta diretamente à internet.

No modo tablet a interface abre **somente o Super Caderno**, sem iniciar WebGL/Three.js. A caneta escreve diretamente no canvas, os dedos movem a visualização e os novos traços são salvos no armazenamento local do navegador antes de sincronizar pelo WebSocket. Ao reconectar, pendências são reenviadas e os traços remotos são recuperados, preservando zoom e posição locais.

> Atenção: acesso por HTTP na LAN não criptografa o token ou os dados. Use **somente rede Wi-Fi privada e confiável**; para uso fora de casa, acrescente HTTPS e autenticação apropriada. Não é um servidor público.

## Funcionalidades desta entrega

| Área | Implementado neste incremento |
|---|---|
| Central | Foco do dia, checkpoints e retomada da bancada |
| Universo | Objetos científicos WebGL com coordenadas 3D estáveis, constelações, zoom/órbita e seleção de destinos |
| Bancada | Leitor com abas e largura ajustável ao lado do Super Caderno; captura de código e bandeja de fragmentos, três presets de layout |
| PDF | Importar PDF, ler e selecionar sobre a página por PDF.js (Vite), capturar texto com documento/página/região e voltar à fonte |
| Caderno | Canvas compartilhado entre bancada e modo expandido; tinta vetorial, pressão quando disponível, texto, Ctrl+V, zoom, pan e cor |
| Sincronização | WebSocket PC↔tablet; IndexedDB para pendências offline, IDs idempotentes, salvamento atômico no servidor |
| Dados | JSON e arquivos locais; nenhuma API paga, serviço de IA ou SQLite obrigatório |

Para capturar texto de PDF no **frontend Vite**: na bancada clique **Importar PDF**, selecione texto diretamente sobre a página, então escolha **Caderno** (insere no mesmo espaço, mantendo o leitor aberto) ou **Guardar** (bandeja à direita). A ação exige seleção explícita: não captura uma página inteira por acidente. Na bandeja, **Fonte** reabre o mesmo PDF na página correspondente. É possível selecionar trechos de código e fazer o mesmo, inclusive sem rede/IA.

## Verificação

```powershell
npm test             # 13 testes automatizados: servidor/API/WS e estado da bancada
npm run build        # Build de produção React/Three.js/PDF.js
npm run typecheck    # Verificação TypeScript da ilha WebGL
```

> Limitação de validação do ambiente de geração em 05/11/2026: **os testes Node de backend passaram**, mas o ambiente não tinha acesso DNS ao npm, portanto não foi possível baixar as dependências e executar `npm run build`/`npm run typecheck` da nova interface aqui. Execute esses comandos no seu computador antes de confiar no frontend. O bundle `dist/` não está incluído; será produzido pelo Vite depois de `npm install`. Um frontend anterior, sem dependências, permanece em `legacy/` como fallback para testes locais de servidor, mas **a experiência WebGL/PDF.js atual fica no código `src/`**.

## Estrutura

```text
study-os/
├── index.html                 # Entrada Vite da interface atual
├── src/
│   ├── app.js                 # Home, bancada, importação, painéis e modos
│   ├── cosmos-react.tsx       # React + R3F + Three.js (WebGL, sob demanda)
│   ├── nodes.js               # Nós científicos/posições estáveis
│   ├── pdf.js                 # PDF.js: páginas, texto e captura
│   ├── notebook.js            # Canvas de tinta local-first, IndexedDB e WS
│   ├── workspace-model.js     # Layout, abas ativas e captura persistente
│   └── styles.css             # Cosmic Laboratory
├── server/
│   ├── index.mjs              # Node HTTP + validação de caminhos/PDF
│   ├── store.mjs              # Persistência atômica JSON
│   └── websocket.mjs          # Canal de tinta e replicação
├── tests/                     # Testes Node sem dependências externas
├── public/                    # Favicon copiado pelo Vite
├── legacy/                    # Fallback sem dependências, UI da bancada também atualizada
├── docs/discovery/            # Registro integral consolidado
└── scripts/dev.mjs            # Inicialização conjunta Node + Vite
```

## Não está implementado ainda

Não tratar esta fatia como produto completo das 37 rodadas. Faltam recortes gráficos/figuras PDF (além de texto selecionável), OCR, edição nativa de código, execução Jupyter integrada, grupos/seleção por laço/undo-redo completos do caderno, zoom semântico refinado, múltiplos projetos editáveis, histórico avançado de experimentos, segurança de acesso remoto, e testes reais de latência de S Pen no Tab S6 FE. O frontend WebGL ainda depende da verificação de build e do teste em hardware real.

## Decisões preservadas

- Home: **Central de Projetos modular**, não canvas livre na entrada.
- Mundo: entidades canônicas, projeções e posições estáveis; sem rearranjo silencioso.
- Tablet: **só Super Caderno**, não universo 3D nem Jupyter.
- Projetos: Git e arquivos reais continuam como fonte de verdade.
- Caderno: espaço infinito, original vetorial da S Pen, sem IA obrigatória.
- Usuário: **um só**, sem contas corporativas/microserviços/outbox SQLite.
- Sem IA na primeira release, mesmo que modelos locais sejam baratos.

O registro mestre está em `docs/discovery/2026-11-04-37-rodadas.txt`.
