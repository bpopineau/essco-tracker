export const SCHEMA_VERSION = 3;

export function buildSchema(DEV) {
  const VERSION = SCHEMA_VERSION;

  const emptyUI = {
    selectedProjectId: null,
    activeTab: 'tasks',
    viewMode: 'kanban',
    sortDueAsc: true,
    searchTerm: '',
    taskFilters: {},     // prefilled with empty object
    noteSearch: '',
    editingNoteId: null
  };

  const empty = {
    version: VERSION,
    dev_seed: false,
    users: [],
    projects: [],
    notes: [],
    tasks: [],
    ui: emptyUI
  };

  if (!DEV) return empty;

  const sample = {
    ...empty,
    dev_seed: true,
    users: [ /* ... */ ],
    projects: [ /* ... */ ],
    notes: [ /* ... */ ],
    tasks: [ /* ... */ ],
    ui: { ...emptyUI, selectedProjectId: 'p1' }
  };

  return sample;
}
