// src/schema.js

// Build the runtime schema based on DEV_MODE.
// When DEV_MODE is false, we export an empty seed (no sample data).

export const SCHEMA_VERSION = 3;

export function buildSchema(DEV_MODE) {
  // Bump VERSION only when the seed structure changes in a way that
  // requires a refresh. Keeping it at 3 avoids blowing away local data.
  const VERSION = SCHEMA_VERSION;

  // Base empty schema (prod)
  const empty = {
    version: VERSION,
    dev_seed: false, // used by storage to detect switching between dev/prod seeds
    users: [],
    projects: [],
    notes: [],
    tasks: [],
    ui: {
      selectedProjectId: null,
      activeTab: 'tasks',   // default to Tasks for first-run UX
      viewMode: 'kanban',
      sortDueAsc: true,
      searchTerm: '',
      // Optional: filters slot (created by tasks view if missing)
      taskFilters: undefined,
      // Notes view UI (created lazily if missing)
      noteSearch: undefined,
      editingNoteId: undefined
    }
  };

  if (!DEV_MODE) return empty;

  // --- DEV seed (sample data) ---
  const sample = {
    ...empty,
    dev_seed: true,
    users: [
      { id:'u1', name:'Ava', email:'ava@essco.local' },
      { id:'u2', name:'Ben', email:'ben@essco.local' },
      { id:'u3', name:'Cam', email:'cam@essco.local' },
      { id:'u4', name:'Dee', email:'dee@essco.local' },
    ],
    projects: [
      { id:'p1', job_number:'1334', name:'AVC The Commons', client:'AVC',   status:'active', pm_user_id:'u2', start_date:'2025-01-10' },
      { id:'p2', job_number:'1338', name:'Pierce College ILB', client:'LACCD', status:'active', pm_user_id:'u3', start_date:'2025-03-01' },
      { id:'p3', job_number:'1340', name:'Banning Childcare', client:'LAUSD', status:'hold',   pm_user_id:'u1', start_date:'2025-02-12' },
      { id:'p4', job_number:'1350', name:'ETI and Master File', client:'ETI', status:'active', pm_user_id:'u4', start_date:'2025-05-20' },
    ],
    notes: [
      { id:'n1', project_id:'p1', meeting_date:'2025-08-01', pinned:false,
        body:'Agenda: Safety, Schedule.\nDecisions:\n- Proceed with feeder reroute.\nNext steps:\n- Submit RFI #12.' },
      { id:'n2', project_id:'p1', meeting_date:'2025-08-12', pinned:true,
        body:'Submittals lagging. Weekly check-ins.\nDecision: split panel order.' },
      { id:'n3', project_id:'p2', meeting_date:'2025-07-30', pinned:false,
        body:'Hold pending DSA comment response.' },
    ],
    tasks: [
      { id:'t1', project_id:'p1', note_id:'n1', title:'Draft RFI #12',            assignee_user_id:'u1', status:'in_progress', priority:'med',  due_date:'2025-08-10' },
      { id:'t2', project_id:'p1', note_id:'n1', title:'Feeder reroute layout',    assignee_user_id:'u2', status:'backlog',     priority:'high', due_date:'2025-08-16' },
      { id:'t3', project_id:'p1', note_id:'n2', title:'Panel split procurement',  assignee_user_id:'u4', status:'blocked',     priority:'high', due_date:'2025-08-08' },
      { id:'t4', project_id:'p2', note_id:'n3', title:'Reply to DSA comments',    assignee_user_id:'u3', status:'backlog',     priority:'med',  due_date:'2025-08-22' },
      { id:'t5', project_id:'p4', note_id:null, title:'Create master spec index', assignee_user_id:'u2', status:'in_progress', priority:'low',  due_date:'2025-08-25' },
    ],
    ui: {
      ...empty.ui,
      selectedProjectId: 'p1'
    }
  };

  return sample;
}
