// settings.js — the API-key panel.
//
// The whole app runs without this. The panel just lets you paste an Anthropic
// key (kept in this browser only) so the field note can offer a model-written
// era dossier on top of the grounded lookup.

import { getKey, getModel, setConfig, DEFAULT_MODEL } from './narrate.js';

const MODELS = [
  ['claude-opus-5',   'Opus 5 — most capable'],
  ['claude-sonnet-5', 'Sonnet 5 — faster, cheaper'],
  ['claude-haiku-4-5','Haiku 4.5 — quickest'],
];

export function initSettings(){
  const btn   = document.getElementById('settings-btn');
  const panel = document.getElementById('settings');
  const input = document.getElementById('set-key');
  const sel   = document.getElementById('set-model');
  const save  = document.getElementById('set-save');
  const clear = document.getElementById('set-clear');
  const status= document.getElementById('set-status');
  if (!btn || !panel) return;

  for (const [id, label] of MODELS){
    const o = document.createElement('option');
    o.value = id; o.textContent = label;
    sel.appendChild(o);
  }

  const syncLabel = () => {
    btn.textContent = getKey() ? 'API key set ·' : 'Set API key ·';
    btn.classList.toggle('on', !!getKey());
  };

  const openPanel = () => {
    input.value = getKey();
    sel.value   = getModel() || DEFAULT_MODEL;
    status.textContent = '';
    panel.hidden = false;
    input.focus();
  };
  const closePanel = () => { panel.hidden = true; };

  btn.onclick = () => (panel.hidden ? openPanel() : closePanel());

  save.onclick = () => {
    setConfig({ key: input.value, model: sel.value });
    syncLabel();
    status.textContent = input.value.trim()
      ? 'Saved to this browser. Click the map, then “Write the era dossier”.'
      : 'Key cleared.';
  };
  clear.onclick = () => {
    setConfig({ key: '', model: sel.value });
    input.value = '';
    syncLabel();
    status.textContent = 'Key cleared.';
  };

  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closePanel(); });
  panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });

  syncLabel();
}
