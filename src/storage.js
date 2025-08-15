// src/storage.js

const STORAGE_KEY = 'essco_tracker_db_v1';
let saveTimer = null;

export const storage = {
  async load(schema){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw){
        localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
        return structuredClone(schema);
      }
      const parsed = JSON.parse(raw);

      // If version OR dev_seed flips, prefer the new schema.
      const needsReplace =
        parsed.version !== schema.version ||
        parsed.dev_seed !== schema.dev_seed;

      if (needsReplace){
        // Schema wins: ensures dev→prod clears sample data; prod→dev loads samples.
        const merged = { ...parsed, ...schema };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
        return merged;
      }
      return parsed;
    }catch{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(schema));
      return structuredClone(schema);
    }
  },

  save(state){
    if (saveTimer) clearTimeout(saveTimer);
    const ss = document.getElementById('saveStatus');
    if (ss){ ss.textContent = 'Saving…'; }
    saveTimer = setTimeout(()=>{
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      const el = document.getElementById('saveStatus');
      if (el){ el.textContent = 'All changes saved'; }
    }, 250);
  },

  exportJSON(state){
    const blob = new Blob([JSON.stringify(state, null, 2)], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `essco-tracker-${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  },

  async importJSON(file){
    const text = await file.text();
    const incoming = JSON.parse(text);
    const current = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    const merged = { ...current, ...incoming, version: incoming.version || current.version || 1 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
    return merged;
  }
};

export { STORAGE_KEY };
