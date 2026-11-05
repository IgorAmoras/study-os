import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';

export const PROJECT = {
  id: 'data-driven',
  name: 'Data-driven Dynamics & Control',
  repository: 'https://github.com/IgorAmoras/data-driven-dynamics-and-control',
  branch: 'main',
};

const BASE = {
  version: 1,
  focus: 'task-observers',
  mode: 'explore',
  updatedAt: null,
  tasks: [
    { id: 'task-observers', title: 'Estudar identificação com estados ocultos', stage: 'explorar', path: 'systems/duffing_oscillator/port_hamiltonian_duffing_hidden_state.py', note: 'Revisitar a hipótese e os experimentos existentes.' },
    { id: 'task-koopman', title: 'Comparar abordagens Koopman e SINDy', stage: 'implementar', path: 'systems/duffing_oscillator/classic_koopman.py', note: 'Confrontar código, hipóteses e resultados disponíveis.' },
    { id: 'task-gaussian', title: 'Mapear processos gaussianos', stage: 'compreender', path: 'meeting_notes/2026-10-19_reuniao_luciano.md', note: 'Organizar referências e próximos passos.' },
  ],
  workspace: {
    selected: 'duffing',
    camera: { yaw: -0.42, pitch: 0.16, distance: 25, target: [5, 0, 0] },
    panels: [
      { id: 'code', kind: 'code', title: 'classic_koopman.py', path: 'systems/duffing_oscillator/classic_koopman.py', x: 2, y: 9, w: 50, h: 79 },
      { id: 'notes', kind: 'notes', title: 'Caderno de pesquisa', path: 'meeting_notes/2026-10-19_reuniao_luciano.md', x: 54, y: 9, w: 44, h: 79 },
    ],
  },
  checkpoint: { text: '', updatedAt: null },
  elements: [],
  documents: [],
};

export function createStore(file) {
  let state;
  let writeTail = Promise.resolve();
  const getState = () => structuredClone(state);
  async function init() {
    await mkdir(path.dirname(file), { recursive: true });
    try {
      const raw = JSON.parse(await readFile(file, 'utf8'));
      state = { ...structuredClone(BASE), ...raw, workspace: { ...structuredClone(BASE.workspace), ...raw.workspace } };
      state.elements = Array.isArray(raw.elements) ? raw.elements.filter(validElement).slice(-20000) : [];
      state.documents = Array.isArray(raw.documents) ? raw.documents.filter(d => /^[0-9a-f-]{36}$/.test(d.id ?? "") && typeof d.name === "string").slice(-100) : [];
    } catch (e) {
      if (e.code !== 'ENOENT') throw e;
      state = structuredClone(BASE);
      await persist();
    }
    return getState();
  }
  function persist() {
    const snapshot = JSON.stringify(state);
    const job = async () => {
      const temp = `${file}.${process.pid}.tmp`;
      await writeFile(temp, snapshot);
      await rename(temp, file);
    };
    writeTail = writeTail.catch(() => {}).then(job);
    return writeTail;
  }
  async function applyPatch(patch) {
    if (!patch || typeof patch !== 'object' || Array.isArray(patch)) throw new Error('Invalid patch');
    const permitted = ['focus', 'mode', 'workspace', 'checkpoint', 'tasks'];
    for (const key of Object.keys(patch)) if (!permitted.includes(key)) throw new Error(`Invalid field: ${key}`);
    if (patch.mode != null && !['explore','study','focus'].includes(patch.mode)) throw new Error('Invalid mode');
    if (patch.tasks != null && (!Array.isArray(patch.tasks) || patch.tasks.length > 100)) throw new Error('Invalid tasks');
    if (patch.workspace != null && (!patch.workspace || !Array.isArray(patch.workspace.panels) || patch.workspace.panels.length > 30)) throw new Error('Invalid workspace');
    state = { ...state, ...structuredClone(patch), updatedAt: new Date().toISOString() };
    await persist();
    return getState();
  }
  async function upsertElement(element) {
    if (!validElement(element)) throw new Error('Invalid canvas element');
    const idx = state.elements.findIndex(e => e.id === element.id);
    if (idx >= 0) return false; // immutable append-only strokes; retries are idempotent
    if (state.elements.length >= 20000) throw new Error('Canvas item limit reached');
    state.elements.push(structuredClone(element));
    state.updatedAt = new Date().toISOString();
    await persist();
    return true;
  }
  async function addDocument(document) {
    if (!/^[0-9a-f-]{36}$/.test(document.id) || !document.name || state.documents.length >= 100) throw new Error('Invalid document');
    state.documents.push({id: document.id, name: document.name.slice(0, 160), size: document.size, createdAt: new Date().toISOString()});
    state.updatedAt = new Date().toISOString();
    await persist();
    return state.documents.at(-1);
  }
  function findDocument(id) { return state.documents.find(d => d.id === id) ?? null; }
  async function whenIdle() { await writeTail; }
  return { init, getState, applyPatch, upsertElement, addDocument, findDocument, whenIdle, file, existsSync };
}

export function validElement(e) {
  if (!e || typeof e !== 'object' || !/^[A-Za-z0-9_-]{8,80}$/.test(e.id ?? '')) return false;
  if (e.type === 'stroke') {
    return Array.isArray(e.points) && e.points.length >= 2 && e.points.length <= 30000
      && e.points.every(p => Array.isArray(p) && p.length >= 2 && p.length <= 3 && p.every(v => Number.isFinite(v) && Math.abs(v) < 1e7))
      && /^#[0-9a-fA-F]{6}$/.test(e.color ?? '') && Number.isFinite(e.width) && e.width > 0 && e.width < 50;
  }
  if (e.type === 'text') {
    const origin = e.source;
    const provenanceOk = origin === undefined || (origin && typeof origin === 'object' &&
      (origin.kind === 'pdf' || origin.kind === 'file') && typeof origin.name === 'string' &&
      origin.name.length < 200 && (origin.page === undefined || (Number.isInteger(origin.page) && origin.page > 0 && origin.page < 100000)) &&
      (origin.documentId === undefined || /^[0-9a-f-]{36}$/.test(origin.documentId)));
    return typeof e.text === 'string' && e.text.length <= 5000 && Number.isFinite(e.x) && Number.isFinite(e.y) && Math.abs(e.x) < 1e7 && Math.abs(e.y) < 1e7 && provenanceOk;
  }
  return false;
}
