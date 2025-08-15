// src/main.js

// ---------- Imports ----------
import { buildSchema } from './schema.js';
import { storage } from './storage.js';
import { createStore } from './store.js';
import { toast } from './ui/dom.js';
import { BUILD_VERSION } from './version.js';
import { mountHeader } from './views/header.js';
import { mountInsights } from './views/insights.js';
import { mountNotes } from './views/notes.js';
import { mountSidebar } from './views/sidebar.js';
import { mountTasks } from './views/tasks.js';

// ---------- Dev_Mode ----------
const DEV_MODE = true; // set to false in production
const schema = buildSchema(DEV_MODE);

// ---------- Boot ----------
(async function main () {
  const initial = await storage.load(schema);
  const store = createStore(initial);

  // Ensure a default active tab exists
  const s0 = store.get();
  if (!s0.ui || !('activeTab' in s0.ui)) {
    store.set({ ui: { ...(s0.ui || {}), activeTab: 'notes' } });
  }

  // Persist on changes (autosave; ignore UI-only keys; don't store `ui`)
  storage.attachAutosave(store, {
    debounce: 300,
    ignoreKeysPrefix: ['ui'],
    persistFilter: (s) => {
      const { ui, ...rest } = s;
      return rest;
    }
  });

  // Sidebar
  mountSidebar(
    document.getElementById('projList'),
    document.getElementById('search'),
    store
  );

  // Header
  mountHeader({
    projTitleEl: document.getElementById('projTitle'),
    projMetaEl: document.getElementById('projMeta'),
    statusBadgeEl: document.getElementById('statusBadge'),
    exportBtn: document.getElementById('btnExport'),
    importInput: document.getElementById('importFile'),
    newNoteBtn: document.getElementById('newNoteBtn'),
    newTaskBtn: document.getElementById('newTaskBtn'),
  }, store);

  // Dev-only Reset Seed button
  if (DEV_MODE) {
    const actionsRow = document.querySelector('header .row');
    if (actionsRow) {
      const resetBtn = document.createElement('button');
      resetBtn.className = 'ghost';
      resetBtn.textContent = 'Reset Seed';
      resetBtn.style.marginLeft = '8px';
      resetBtn.title = 'Clear local data and reload default seed';
      resetBtn.onclick = async () => {
        if (!confirm('Reset local data to the default seed? This will clear your current changes.')) return;
        try {
          localStorage.removeItem('essco_tracker_db_v1');
          if ('caches' in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter(k => k.startsWith('essco-cache-')).map(k => caches.delete(k)));
          }
        } finally {
          location.reload();
        }
      };
      actionsRow.appendChild(resetBtn);
    }
  }

  // Views
  mountNotes(document.getElementById('panel-notes'), store);
  mountTasks(document.getElementById('panel-tasks'), store);
  mountInsights(document.getElementById('panel-insights'), store);

  // Tabs (top-level app tabs)
  const tabs = document.querySelectorAll('.tabs .tab');
  tabs.forEach(t => {
    t.addEventListener('click', () => {
      const tab = t.dataset.tab;
      const ui = store.get().ui || {};
      store.set({ ui: { ...ui, activeTab: tab } });
    });
    // Keyboard activate on Space/Enter
    t.addEventListener('keydown', (e) => {
      if (e.key === ' ' || e.key === 'Space' || e.key === 'Spacebar' || e.key === 'Enter') {
        e.preventDefault();
        t.click();
      }
    });
  });

  // Ensure ARIA attributes are always correct on tab state change
  function updateTabsAndPanels (state) {
    const active = state?.ui?.activeTab ?? 'notes';
    const sections = {
      notes:    { panel: '#panel-notes',    tab: '#tab-notes' },
      tasks:    { panel: '#panel-tasks',    tab: '#tab-tasks' },
      insights: { panel: '#panel-insights', tab: '#tab-insights' }
    };
    for (const [k, { panel, tab }] of Object.entries(sections)) {
      const $panel = document.querySelector(panel);
      const $tab   = document.querySelector(tab);
      const isActive = (k === active);

      // Panel visibility + a11y
      if ($panel) {
        if (isActive) $panel.removeAttribute('hidden');
        else $panel.setAttribute('hidden', '');
        // Keep legacy grid display for non-[hidden] user agents
        $panel.style.display = isActive ? 'grid' : 'none';
        $panel.setAttribute('aria-hidden', String(!isActive));
      }

      // Tab state + a11y
      if ($tab) {
        $tab.classList.toggle('active', isActive);
        $tab.setAttribute('aria-selected', String(isActive));
        $tab.setAttribute('tabindex', isActive ? '0' : '-1');
      }
    }
    if (active === 'insights') window.dispatchEvent(new Event('resize'));
  }

  // Single subscription
  store.subscribe((state, keys) => {
    if (keys.includes('ui')) updateTabsAndPanels(state);
  });

  // Initial render
  store.emit();
  updateTabsAndPanels(store.get());

  // Service worker: versioned register + toast-based update prompt
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`./sw.js?v=${encodeURIComponent(BUILD_VERSION)}`).then((reg) => {
      // If a waiting worker already exists, prompt now
      if (reg.waiting && navigator.serviceWorker.controller) {
        showUpdateToast(reg);
      }
      // When a new worker is found and installed, prompt to refresh
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateToast(reg);
          }
        });
      });
    }).catch(err => {
      console.warn('[sw] register failed:', err);
    });

    // Reload after skipWaiting activates the new worker
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      location.reload();
    });

    console.log('ESSCO build', BUILD_VERSION, 'DEV_MODE:', DEV_MODE ? 'dev' : 'prod');
  }
})();

/* ------------ helpers ------------ */

function showUpdateToast (reg) {
  toast('An update is ready.', {
    type: 'info',
    action: {
      label: 'Refresh',
      onClick: () => {
        try {
          reg.waiting?.postMessage?.({ type: 'SKIP_WAITING' });
        } catch {}
      }
    }
  });
}
