// Global app types used by JSDoc across .js files

interface User { id: string; name: string }

interface Attachment { id: string; name: string; kind?: string }

interface Task {
  id: string;
  project_id: string;
  assignee_user_id?: string | null;
  due_date?: string | null;
  status: string;
  note_id?: string | null;
  attachments?: Attachment[];
}

interface Note {
  id: string;
  project_id: string;
  body?: string;
  meeting_date?: string | null;
  pinned?: boolean;
}

interface Project {
  id: string;
  job_number: string;
  name: string;
  client: string;
  pm_user_id?: string | null;
  status?: string;
  start_date?: string | null;
}

interface State {
  users: User[];
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  ui: any;
}

type Updater = (s: State) => State;

interface Store {
  get(): State;
  update(fn: Updater): void;
  subscribe(fn: (s: State, keys: string[]) => void): () => void;
}

// Window augments we actually use
declare global {
  interface Window {
    showOpenFilePicker?: (opts?: any) => Promise<any[]>;
    fileDB?: any;
  }
  // Make TS okay with the occasional Element.focus() usage
  interface Element {
    focus?: () => void;
  }
}

export { }; // keep this a global script .d.ts

