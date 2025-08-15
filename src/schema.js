// src/schema.js
export const schemaV1 = {
  version: 1,

  // --- People ---
  users: [
    { id: 'u1', name: 'Ava', email: 'ava@essco.local' },
    { id: 'u2', name: 'Ben', email: 'ben@essco.local' },
    { id: 'u3', name: 'Cam', email: 'cam@essco.local' },
    { id: 'u4', name: 'Dee', email: 'dee@essco.local' },
  ],

  // --- Projects (kept originals, added more fillers) ---
  projects: [
    { id: 'p1', job_number: '1334', name: 'AVC The Commons', client: 'AVC', status: 'active', pm_user_id: 'u2', start_date: '2025-01-10' },
    { id: 'p2', job_number: '1338', name: 'Pierce College ILB', client: 'LACCD', status: 'active', pm_user_id: 'u3', start_date: '2025-03-01' },
    { id: 'p3', job_number: '1340', name: 'Banning Childcare', client: 'LAUSD', status: 'hold', pm_user_id: 'u1', start_date: '2025-02-12' },
    { id: 'p4', job_number: '1350', name: 'ETI and Master File', client: 'ETI', status: 'active', pm_user_id: 'u4', start_date: '2025-05-20' },
    // fillers
    { id: 'p5', job_number: '1351', name: 'Sunset Office Renovation', client: 'Private', status: 'active', pm_user_id: 'u1', start_date: '2025-06-15' },
    { id: 'p6', job_number: '1352', name: 'Riverwalk Lighting', client: 'City of LA', status: 'active', pm_user_id: 'u2', start_date: '2025-07-01' },
    { id: 'p7', job_number: '1353', name: 'West Hall Upgrade', client: 'LACCD', status: 'active', pm_user_id: 'u3', start_date: '2025-04-10' },
    { id: 'p8', job_number: '1354', name: 'Harbor Campus Solar', client: 'LAUSD', status: 'hold', pm_user_id: 'u4', start_date: '2025-05-05' },
    { id: 'p9', job_number: '1355', name: 'Data Center Fit-Out', client: 'AVC', status: 'active', pm_user_id: 'u2', start_date: '2025-07-20' },
    { id: 'p10', job_number: '1356', name: 'Midtown Plaza TI', client: 'Private', status: 'active', pm_user_id: 'u1', start_date: '2025-08-05' },
  ],

  // --- Notes (kept originals, added spread across projects) ---
  notes: [
    { id: 'n1', project_id: 'p1', meeting_date: '2025-08-01', body: 'Agenda: Safety, Schedule.\nDecisions:\n- Proceed with feeder reroute.\nNext steps:\n- Submit RFI #12.' },
    { id: 'n2', project_id: 'p1', meeting_date: '2025-08-12', body: 'Submittals lagging. Weekly check-ins.\nDecision: split panel order.' },
    { id: 'n3', project_id: 'p2', meeting_date: '2025-07-30', body: 'Hold pending DSA comment response.' },
    // fillers
    { id: 'n4',  project_id: 'p2', meeting_date: '2025-08-10', body: 'Coordination with campus IT.\nAction: finalize pathway approvals.' },
    { id: 'n5',  project_id: 'p3', meeting_date: '2025-08-09', body: 'Budget check; awaiting board decision.\nHold items captured.' },
    { id: 'n6',  project_id: 'p4', meeting_date: '2025-08-13', body: 'Spec consolidation in progress.\nNeed vendor feedback.' },
    { id: 'n7',  project_id: 'p5', meeting_date: '2025-08-11', body: 'Kickoff; defined milestones and risks.' },
    { id: 'n8',  project_id: 'p6', meeting_date: '2025-08-08', body: 'Pre-bid walk; clarify luminaire schedule.' },
    { id: 'n9',  project_id: 'p7', meeting_date: '2025-08-07', body: 'Phase split agreed.\nSubmittals cadence weekly.' },
    { id: 'n10', project_id: 'p8', meeting_date: '2025-08-05', body: 'Solar incentives review; awaiting utility reply.' },
    { id: 'n11', project_id: 'p9', meeting_date: '2025-08-12', body: 'DC aisle containment layout discussion.\nFollow-up task list created.' },
    { id: 'n12', project_id: 'p10', meeting_date: '2025-08-14', body: 'Tenant improvement schedule alignment with landlord.' },
    { id: 'n13', project_id: 'p5', meeting_date: '2025-08-02', body: 'Design QA pass 1 done.\nOpen questions logged.' },
    { id: 'n14', project_id: 'p6', meeting_date: '2025-08-01', body: 'RFI tracker setup.\nDue dates assigned.' },
    { id: 'n15', project_id: 'p7', meeting_date: '2025-08-03', body: 'Electrical room clearances confirmed.' },
    { id: 'n16', project_id: 'p8', meeting_date: '2025-07-28', body: 'Procurement long-lead discussion.' },
    { id: 'n17', project_id: 'p9', meeting_date: '2025-08-04', body: 'Rack elevations preliminary review.' },
    { id: 'n18', project_id: 'p10', meeting_date: '2025-08-06', body: 'Ceiling coordination with MEP trades.' },
    { id: 'n19', project_id: 'p1', meeting_date: '2025-08-03', body: 'Safety walkthrough; PPE reminders.' },
    { id: 'n20', project_id: 'p2', meeting_date: '2025-08-12', body: 'DSA resubmittal strategy.' },
  ],

  // --- Tasks (kept originals + lots of filler)
  // Tip: today is 2025-08-15; we include overdue (<15), due-soon (16–18), and future (19+) dates.
  tasks: [
    // originals
    { id: 't1', project_id: 'p1', note_id: 'n1', title: 'Draft RFI #12',              assignee_user_id: 'u1', status: 'in_progress', priority: 'med',  due_date: '2025-08-10' }, // overdue
    { id: 't2', project_id: 'p1', note_id: 'n1', title: 'Feeder reroute layout',      assignee_user_id: 'u2', status: 'backlog',     priority: 'high', due_date: '2025-08-16' }, // due soon
    { id: 't3', project_id: 'p1', note_id: 'n2', title: 'Panel split procurement',    assignee_user_id: 'u4', status: 'blocked',     priority: 'high', due_date: '2025-08-08' }, // overdue
    { id: 't4', project_id: 'p2', note_id: 'n3', title: 'Reply to DSA comments',      assignee_user_id: 'u3', status: 'backlog',     priority: 'med',  due_date: '2025-08-22' },
    { id: 't5', project_id: 'p4', note_id: null, title: 'Create master spec index',   assignee_user_id: 'u2', status: 'in_progress', priority: 'low',  due_date: '2025-08-25' },

    // p1 fillers
    { id: 't6',  project_id: 'p1', note_id: 'n19', title: 'Toolbox talk recap',             assignee_user_id: 'u1', status: 'done',        priority: 'low',  due_date: '2025-08-05' },
    { id: 't7',  project_id: 'p1', note_id: null,  title: 'Pull feeder to MSB',             assignee_user_id: 'u2', status: 'in_progress', priority: 'high', due_date: '2025-08-18' }, // due soon
    { id: 't8',  project_id: 'p1', note_id: null,  title: 'Set pull boxes',                 assignee_user_id: 'u3', status: 'backlog',     priority: 'med',  due_date: '2025-08-28' },
    { id: 't9',  project_id: 'p1', note_id: null,  title: 'Verify grounding lugs',          assignee_user_id: 'u4', status: 'blocked',     priority: 'low',  due_date: '2025-08-13' }, // overdue
    { id: 't10', project_id: 'p1', note_id: null,  title: 'Update one-line diagrams',       assignee_user_id: 'u3', status: 'done',        priority: 'med',  due_date: '2025-08-06' },

    // p2 fillers
    { id: 't11', project_id: 'p2', note_id: 'n20', title: 'Prep DSA resubmittal set',       assignee_user_id: 'u1', status: 'in_progress', priority: 'high', due_date: '2025-08-17' }, // due soon
    { id: 't12', project_id: 'p2', note_id: 'n4',  title: 'Campus IT pathway check',        assignee_user_id: 'u4', status: 'blocked',     priority: 'med',  due_date: '2025-08-19' },
    { id: 't13', project_id: 'p2', note_id: null,  title: 'Order panel boards',             assignee_user_id: 'u2', status: 'backlog',     priority: 'low',  due_date: '2025-08-29' },
    { id: 't14', project_id: 'p2', note_id: null,  title: 'Inspect conduit run',            assignee_user_id: 'u3', status: 'in_progress', priority: 'high', due_date: '2025-08-26' },
    { id: 't15', project_id: 'p2', note_id: null,  title: 'Verify as-built drawings',       assignee_user_id: 'u1', status: 'done',        priority: 'low',  due_date: '2025-08-07' },

    // p3 fillers (on hold project still gets tasks in backlog/blocked/done)
    { id: 't16', project_id: 'p3', note_id: 'n5',  title: 'Budget variance log',            assignee_user_id: 'u4', status: 'backlog',     priority: 'med',  due_date: '2025-09-05' },
    { id: 't17', project_id: 'p3', note_id: null,  title: 'Permit readiness checklist',     assignee_user_id: 'u2', status: 'in_progress', priority: 'high', due_date: '2025-08-29' },
    { id: 't18', project_id: 'p3', note_id: null,  title: 'Long-lead item watch',           assignee_user_id: 'u3', status: 'blocked',     priority: 'high', due_date: '2025-09-01' },
    { id: 't19', project_id: 'p3', note_id: null,  title: 'Site safety walk',               assignee_user_id: 'u1', status: 'done',        priority: 'low',  due_date: '2025-08-06' },
    { id: 't20', project_id: 'p3', note_id: null,  title: 'Utility shutdown planning',      assignee_user_id: 'u4', status: 'in_progress', priority: 'med',  due_date: '2025-08-24' },

    // p4 fillers
    { id: 't21', project_id: 'p4', note_id: 'n6',  title: 'Spec merge pass 2',              assignee_user_id: 'u2', status: 'backlog',     priority: 'low',  due_date: '2025-08-31' },
    { id: 't22', project_id: 'p4', note_id: null,  title: 'Insurance paperwork',            assignee_user_id: 'u3', status: 'in_progress', priority: 'low',  due_date: '2025-08-21' },
    { id: 't23', project_id: 'p4', note_id: null,  title: 'Finalize vendor list',           assignee_user_id: 'u1', status: 'blocked',     priority: 'med',  due_date: '2025-09-03' },
    { id: 't24', project_id: 'p4', note_id: null,  title: 'Review submittals',              assignee_user_id: 'u4', status: 'done',        priority: 'high', due_date: '2025-08-04' },
    { id: 't25', project_id: 'p4', note_id: null,  title: 'Set up project folders',         assignee_user_id: 'u3', status: 'backlog',     priority: 'med',  due_date: '2025-08-19' },

    // p5 fillers
    { id: 't26', project_id: 'p5', note_id: 'n7',  title: 'Milestone baseline',             assignee_user_id: 'u1', status: 'in_progress', priority: 'med',  due_date: '2025-08-27' },
    { id: 't27', project_id: 'p5', note_id: 'n13', title: 'QA Pass 2 issues',               assignee_user_id: 'u2', status: 'backlog',     priority: 'high', due_date: '2025-08-23' },
    { id: 't28', project_id: 'p5', note_id: null,  title: 'MEP coordination rev A',         assignee_user_id: 'u3', status: 'blocked',     priority: 'med',  due_date: '2025-08-18' }, // due soon
    { id: 't29', project_id: 'p5', note_id: null,  title: 'Order finish samples',           assignee_user_id: 'u4', status: 'done',        priority: 'low',  due_date: '2025-08-09' }, // overdue
    { id: 't30', project_id: 'p5', note_id: null,  title: 'Update FF&E list',               assignee_user_id: 'u1', status: 'backlog',     priority: 'low',  due_date: '2025-08-30' },

    // p6 fillers
    { id: 't31', project_id: 'p6', note_id: 'n8',  title: 'Luminaire schedule clarify',     assignee_user_id: 'u2', status: 'in_progress', priority: 'med',  due_date: '2025-08-20' },
    { id: 't32', project_id: 'p6', note_id: 'n14', title: 'RFI tracker review',             assignee_user_id: 'u3', status: 'backlog',     priority: 'low',  due_date: '2025-08-22' },
    { id: 't33', project_id: 'p6', note_id: null,  title: 'Pull photometric cutsheets',     assignee_user_id: 'u4', status: 'blocked',     priority: 'high', due_date: '2025-08-13' }, // overdue
    { id: 't34', project_id: 'p6', note_id: null,  title: 'Bid Q&A responses',              assignee_user_id: 'u1', status: 'done',        priority: 'med',  due_date: '2025-08-12' }, // overdue
    { id: 't35', project_id: 'p6', note_id: null,  title: 'Spec section split',             assignee_user_id: 'u2', status: 'backlog',     priority: 'med',  due_date: '2025-09-02' },

    // p7 fillers
    { id: 't36', project_id: 'p7', note_id: 'n9',  title: 'Submittal cadence setup',        assignee_user_id: 'u3', status: 'in_progress', priority: 'high', due_date: '2025-08-16' }, // due soon
    { id: 't37', project_id: 'p7', note_id: 'n15', title: 'Room clearance markup',          assignee_user_id: 'u4', status: 'backlog',     priority: 'low',  due_date: '2025-08-28' },
    { id: 't38', project_id: 'p7', note_id: null,  title: 'Conduit routing options',        assignee_user_id: 'u1', status: 'blocked',     priority: 'med',  due_date: '2025-08-21' },
    { id: 't39', project_id: 'p7', note_id: null,  title: 'Floor core locations',           assignee_user_id: 'u2', status: 'done',        priority: 'low',  due_date: '2025-08-03' },
    { id: 't40', project_id: 'p7', note_id: null,  title: 'Ceiling clash review',           assignee_user_id: 'u3', status: 'backlog',     priority: 'high', due_date: '2025-09-04' },

    // p8 fillers (hold)
    { id: 't41', project_id: 'p8', note_id: 'n10', title: 'Utility interconnect research',  assignee_user_id: 'u4', status: 'backlog',     priority: 'med',  due_date: '2025-09-06' },
    { id: 't42', project_id: 'p8', note_id: 'n16', title: 'Long-lead PO draft',             assignee_user_id: 'u2', status: 'in_progress', priority: 'high', due_date: '2025-08-27' },
    { id: 't43', project_id: 'p8', note_id: null,  title: 'Racking layout options',         assignee_user_id: 'u1', status: 'blocked',     priority: 'med',  due_date: '2025-09-01' },
    { id: 't44', project_id: 'p8', note_id: null,  title: 'Inverter spec compare',          assignee_user_id: 'u3', status: 'done',        priority: 'low',  due_date: '2025-08-02' },
    { id: 't45', project_id: 'p8', note_id: null,  title: 'PV wire schedule draft',         assignee_user_id: 'u4', status: 'backlog',     priority: 'low',  due_date: '2025-09-03' },

    // p9 fillers
    { id: 't46', project_id: 'p9', note_id: 'n11', title: 'Aisle containment rev B',        assignee_user_id: 'u2', status: 'in_progress', priority: 'high', due_date: '2025-08-18' }, // due soon
    { id: 't47', project_id: 'p9', note_id: 'n17', title: 'Rack elevation updates',         assignee_user_id: 'u3', status: 'backlog',     priority: 'med',  due_date: '2025-08-22' },
    { id: 't48', project_id: 'p9', note_id: null,  title: 'UPS vendor short list',          assignee_user_id: 'u4', status: 'blocked',     priority: 'high', due_date: '2025-08-14' }, // overdue
    { id: 't49', project_id: 'p9', note_id: null,  title: 'Cable tray sizing',              assignee_user_id: 'u1', status: 'done',        priority: 'low',  due_date: '2025-08-10' }, // overdue
    { id: 't50', project_id: 'p9', note_id: null,  title: 'Hot/cold aisle signage',         assignee_user_id: 'u2', status: 'backlog',     priority: 'low',  due_date: '2025-08-31' },

    // p10 fillers
    { id: 't51', project_id: 'p10', note_id: 'n12', title: 'Landlord access windows',       assignee_user_id: 'u1', status: 'in_progress', priority: 'med',  due_date: '2025-08-19' },
    { id: 't52', project_id: 'p10', note_id: 'n18', title: 'Ceiling coordination items',    assignee_user_id: 'u2', status: 'backlog',     priority: 'high', due_date: '2025-08-21' },
    { id: 't53', project_id: 'p10', note_id: null,  title: 'Finish schedule draft',         assignee_user_id: 'u3', status: 'blocked',     priority: 'med',  due_date: '2025-08-16' }, // due soon
    { id: 't54', project_id: 'p10', note_id: null,  title: 'Suite numbering check',         assignee_user_id: 'u4', status: 'done',        priority: 'low',  due_date: '2025-08-01' },
    { id: 't55', project_id: 'p10', note_id: null,  title: 'Door hardware matrix',          assignee_user_id: 'u1', status: 'backlog',     priority: 'med',  due_date: '2025-08-29' },
  ],

  // --- UI defaults ---
  ui: {
    selectedProjectId: 'p1',
    activeTab: 'notes',
    viewMode: 'kanban',
    sortDueAsc: true,
    searchTerm: ''
  }
};
