// Global app types used by JSDoc across .js files

export interface User { id: string; name: string }

export interface Attachment { id: string; name: string; kind?: string }

export interface Task {
  id: string;
  project_id: string;
  assignee_user_id?: string | null;
  due_date?: string | null;
  status: string;
  note_id?: string | null;
  attachments?: Attachment[];
}

export interface Note {
  id: string;
  project_id: string;
  body?: string;
  meeting_date?: string | null;
  pinned?: boolean;
}

export interface Project {
  id: string;
  job_number: string;
  name: string;
  client: string;
  pm_user_id?: string | null;
  status?: string;
  start_date?: string | null;
}

export interface State {
  users: User[];
  tasks: Task[];
  notes: Note[];
  projects: Project[];
  ui: any;
}

// Updater returns a partial patch applied via store.set/update
export type Updater = (s: State) => Partial<State> | void;

export interface Store {
  get(): State;
  set(patch: Partial<State>, opts?: { silent?: boolean }): void;
  update(fn: Updater, opts?: { silent?: boolean }): void;
  replace(next: State, opts?: { silent?: boolean }): void;
  reset(opts?: { silent?: boolean }): void;
  emit(keys?: string[]): void;
  batch(run: () => void): void;
  undo(): void;
  redo(): void;
  getLastChangedKeys(): string[];
  subscribe(fn: (s: State, keys: string[]) => void, deps?: string[] | ((s: State, keys: string[]) => boolean)): () => void;
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

