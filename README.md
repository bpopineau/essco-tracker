# ESSCO Project Tracker


ESSCO Project Tracker is a modern, single-page web application for tracking projects, meeting notes, and tasks, designed for engineering, construction, and consulting teams. It is built for speed, offline use, and simplicity—no backend or server required. All data is stored locally in your browser, making it ideal for small teams or individuals who need a private, portable, and robust project tracker.

---

## Table of Contents

- [ESSCO Project Tracker](#essco-project-tracker)
  - [Table of Contents](#table-of-contents)
  - [Features](#features)
  - [Project Overview](#project-overview)
  - [Getting Started](#getting-started)
    - [1. Clone or Download](#1-clone-or-download)
    - [2. Open in Browser](#2-open-in-browser)
    - [3. (Optional) Install as App](#3-optional-install-as-app)
  - [Usage](#usage)
  - [Usage Guide](#usage-guide)
    - [Sidebar](#sidebar)
    - [Header](#header)
    - [Tabs](#tabs)
    - [Quick Add \& Linking](#quick-add--linking)
    - [Import/Export](#importexport)
  - [Data Model](#data-model)
    - [Example Data Structure](#example-data-structure)
  - [Architecture](#architecture)
  - [UI Walkthrough](#ui-walkthrough)
    - [Main Layout](#main-layout)
    - [Notes](#notes)
    - [Tasks](#tasks)
    - [Insights](#insights)
  - [Offline \& PWA Details](#offline--pwa-details)
  - [Extending \& Customizing](#extending--customizing)
  - [Troubleshooting](#troubleshooting)
  - [FAQ](#faq)
  - [Screenshots](#screenshots)
  - [Accessibility](#accessibility)
  - [Security \& Privacy](#security--privacy)
  - [Contributing](#contributing)
  - [Release \& Versioning](#release--versioning)
  - [Best Practices \& Recommendations](#best-practices--recommendations)
  - [Acknowledgments](#acknowledgments)
  - [File Structure](#file-structure)
    - [Directory/Module Details](#directorymodule-details)
  - [Development](#development)
  - [License](#license)

## Features

- **Project Management**: Create, archive, and delete projects with job numbers, client, PM, and status.
- **Meeting Notes**: Log meeting notes per project, link tasks to notes, and track decisions and next steps.
- **Task Tracking**: Kanban and table views for tasks, with quick add, priorities, due dates, assignees, and note links.
- **Insights Dashboard**: Visualize workload, due/overdue tasks, and meeting coverage per project.
- **Offline-First**: All data is stored in the browser (IndexedDB); works fully offline.
- **Import/Export**: Backup or transfer your data as JSON.
- **No Login Required**: All data is local; no accounts or cloud needed.
- **PWA**: Installable as a Progressive Web App for desktop-like experience.

---

## Project Overview

ESSCO Project Tracker is designed to help project managers, engineers, and teams:

- Track multiple projects, each with its own job number, client, PM, and status (active, hold, archived)
- Log and review meeting notes, decisions, and next steps for each project
- Manage tasks in Kanban or table view, with priorities, due dates, assignees, and links to meeting notes
- Visualize project health and workload with an insights dashboard
- Operate fully offline, with all data stored in the browser (no cloud, no login)
- Export/import data for backup or transfer

---

## Getting Started

### 1. Clone or Download

```sh
git clone https://github.com/bpopineau/essco-tracker.git
cd SinglePageWebApp
```

Or simply download and unzip the folder.

### 2. Open in Browser

Just open `index.html` in your browser. No build or server required.

### 3. (Optional) Install as App

- In Chrome/Edge: Click the install icon in the address bar to add to your desktop.

---

## Usage


## Usage Guide

### Sidebar
- Search and filter projects by name, client, PM, or job number
- Add new projects with the "+ Project" button
- Select a project to view its details, notes, tasks, and insights

### Header
- Displays selected project info (job number, name, client, PM, status)
- Export all data as JSON (for backup or transfer)
- Import data from a JSON file (merges with current data)
- Quick actions: add meeting note, add task, delete/archive project

### Tabs
- **Notes**: Add, edit, and review meeting notes for the selected project. Each note can be linked to tasks.
- **Tasks**: Add, edit, and move tasks between statuses (Kanban or Table view). Tasks can be linked to meeting notes, assigned to users, prioritized, and given due dates.
- **Insights**: Visualize open/overdue tasks, workload by assignee, and meeting coverage (how many notes have linked tasks).

### Quick Add & Linking
- Use "Quick Add Task" for fast entry of new tasks
- Link tasks to meeting notes for traceability
- Attach files to tasks (browser support required)

### Import/Export
- Export your entire database as a JSON file for backup or migration
- Import a JSON file to restore or merge data

---

## Data Model

- **Users**: Project managers and assignees.
- **Projects**: Each with job number, name, client, PM, status, and start date.
- **Notes**: Meeting notes per project, with date and body.
- **Tasks**: Linked to projects (and optionally notes), with assignee, status, priority, due date, and attachments.

### Example Data Structure

```js
{
  users: [ { id, name, email } ],
  projects: [ { id, job_number, name, client, status, pm_user_id, start_date } ],
  notes: [ { id, project_id, meeting_date, body } ],
  tasks: [ { id, project_id, note_id, title, assignee_user_id, status, priority, due_date, attachments } ],
  ui: { selectedProjectId, activeTab, viewMode, ... }
}
```

---

## Architecture

- **Frontend Only**: 100% client-side, no backend or server required
- **State Management**: Simple observable store pattern (`src/store.js`)
- **Persistence**: Uses browser `localStorage` for main data, and IndexedDB for file attachments
- **Modular UI**: All UI logic is in `src/views/` (header, sidebar, notes, tasks, insights)
- **Utilities**: Date formatting, ID generation, and DOM helpers in `src/utils/` and `src/ui/`
- **PWA**: Service worker (`sw.js`) and manifest for installability and offline support

---

## UI Walkthrough

### Main Layout
- **Sidebar**: Project list, search/filter, and "+ Project" button
- **Header**: Project details, status, and quick actions (export, import, add note/task, delete/archive)
- **Tabs**: Switch between Notes, Tasks, and Insights
- **Content Area**: Displays notes, tasks, or insights for the selected project

### Notes
- Add new meeting notes with date and body
- Link tasks to notes for traceability
- See how many tasks are linked to each note

### Tasks
- Kanban view: Drag-and-drop tasks between statuses (Backlog, In Progress, Blocked, Done)
- Table view: See all tasks in a sortable table
- Quick add: Enter title, assignee, priority, due date, and note link in one row
- Attach files to tasks (if browser supports File System Access API)

### Insights
- Workload chart: Visualizes open tasks by assignee (color-coded for overdue, due soon, OK)
- Meeting coverage: Shows what % of meeting notes have at least one linked task
- Overdue and due-soon task counts

---

## Offline & PWA Details

- **Offline-First**: All data is stored in your browser; works with no internet connection
- **PWA**: Installable on desktop (and some mobile browsers) for an app-like experience
- **Service Worker**: Caches core files for offline use; updates automatically when new files are available
- **Data Storage**: Uses `localStorage` for main data, IndexedDB for file attachments (see `src/storage/`)

---

## Extending & Customizing

- **Add More Fields**: Extend the schema in `src/schema.js` and update UI in `src/views/`
- **Custom Branding**: Edit `index.html`, `styles.css`, and `icon.svg`
- **Add More Views**: Create new modules in `src/views/` and add to the main UI
- **Integrate with Backend**: (Advanced) Replace or supplement `storage.js` with API calls

---

## Troubleshooting

- **Data not saving?** Ensure your browser allows localStorage and IndexedDB
- **File attachments not working?** Use Chrome or Edge on desktop for File System Access API support
- **App not updating?** Try a hard refresh (Ctrl+Shift+R) or clear browser cache
- **Import/Export issues?** Only import files exported from this app; merging is shallow (overwrites by key)

---

## FAQ

**Q: Is my data private?**
A: Yes. All data stays in your browser/device. No cloud, no tracking, no login.

**Q: Can I use this with a team?**
A: This app is designed for single-user or small-team use on a shared device. For multi-user sync, a backend would be needed.

**Q: How do I back up my data?**
A: Use the Export button in the header to download a JSON backup. Import restores or merges data.

**Q: Can I add more fields or change the workflow?**
A: Yes! The code is modular and easy to extend. See the Extending section above.

**Q: What browsers are supported?**
A: Chrome and Edge (desktop) are fully supported. Firefox and Safari work, but file attachments may be limited.

---



## Screenshots

<!--
Add screenshots or animated GIFs here to showcase the UI and features. Example:
![Project List and Insights](docs/screenshots/project-list.png)
![Kanban Task Board](docs/screenshots/kanban-board.gif)
-->

---

## Accessibility

- Keyboard navigation is supported throughout the app (tab, enter, escape, etc.)
- High-contrast color scheme for readability
- All interactive elements are accessible via keyboard and have visible focus
- ARIA roles and labels are used where appropriate

---

## Security & Privacy

- All data is stored locally in your browser; nothing is sent to any server
- No analytics, tracking, or third-party scripts
- File attachments are stored using browser APIs and never leave your device
- To clear all data, use your browser's storage/cookie settings or the "Reset Seed" button (in DEV mode)

---

## Contributing

Contributions are welcome! To propose a feature, bugfix, or improvement:

1. Fork the repository and create a new branch
2. Make your changes with clear commit messages
3. Test thoroughly in Chrome/Edge (and optionally Firefox/Safari)
4. Open a pull request with a description of your changes

For major changes, please open an issue first to discuss your ideas.

---

## Release & Versioning

- The app version is tracked in `src/version.js` and displayed in the UI
- Releases are tagged in git and described in the changelog (if present)
- Semantic versioning is followed: MAJOR.MINOR.PATCH

---

## Best Practices & Recommendations

- Use Chrome or Edge for the best experience and full feature support
- Regularly export your data as a backup
- For team use, consider a shared device or export/import workflow
- To reset to the default seed, use the DEV "Reset Seed" button (if enabled)

---

## Acknowledgments

- Inspired by real-world project management needs in engineering and construction
- Built with plain JavaScript, no frameworks, for maximum portability
- Thanks to all contributors and users for feedback and ideas

---


## File Structure

- [index.html](index.html) — Main entry point (loads the app)
- [styles.css](styles.css) — App styles (CSS)
- [manifest.json](manifest.json) — PWA manifest (installability)
- [sw.js](sw.js) — Service worker for offline/PWA support
- [icon.svg](icon.svg) — App icon (used in manifest)
- [README.md](README.md) — Project documentation
- [src/](src/) — All JavaScript source code
  - [main.js](src/main.js) — App bootstrap and initialization
  - [schema.js](src/schema.js) — Initial data and schema definition
  - [storage.js](src/storage.js) — Persistence logic (localStorage, import/export)
  - [store.js](src/store.js) — State management (observable store)
  - [version.js](src/version.js) — App version string
  - [storage/](src/storage/) — File attachment logic (IndexedDB)
    - [fileDB.js](src/storage/fileDB.js) — FileSystemHandle storage helpers
  - [ui/](src/ui/) — DOM helper utilities
    - [dom.js](src/ui/dom.js) — DOM element creation/clearing helpers
  - [utils/](src/utils/) — General utilities
    - [date.js](src/utils/date.js) — Date formatting and calculations
  - [views/](src/views/) — UI modules (one per main view/component)
    - [header.js](src/views/header.js) — Header bar (project info, actions)
    - [insights.js](src/views/insights.js) — Insights dashboard (charts, stats)
    - [notes.js](src/views/notes.js) — Meeting notes view
    - [sidebar.js](src/views/sidebar.js) — Sidebar (project list, search, add)
    - [tasks.js](src/views/tasks.js) — Task board/table view

### Directory/Module Details

- **src/main.js**: Entry point, initializes state, mounts all UI modules.
- **src/schema.js**: Defines the initial data structure (users, projects, notes, tasks, UI state).
- **src/storage.js**: Handles saving/loading to localStorage, import/export, and debounced persistence.
- **src/store.js**: Simple observable store for state management and subscriptions.
- **src/version.js**: App version string (for display or cache busting).
- **src/storage/fileDB.js**: Stores file attachments using IndexedDB and File System Access API.
- **src/ui/dom.js**: Helper functions for creating and clearing DOM elements.
- **src/utils/date.js**: Date formatting and calculation utilities.
- **src/views/**: Contains all UI modules, each responsible for a major part of the interface:
  - **header.js**: Project info, status, and global actions (export, import, delete, etc.)
  - **insights.js**: Project insights dashboard (workload, overdue, meeting coverage)
  - **notes.js**: Meeting notes list and editor
  - **sidebar.js**: Project list, search/filter, and add project modal
  - **tasks.js**: Kanban and table task views, quick add, attachments

---

## Development

No build step is required. For development, just edit the files and refresh the browser. All logic is in plain ES modules.

## License

MIT License. See [LICENSE](LICENSE) if present.

---

*ESSCO Project Tracker is designed for small teams needing a fast, private, and portable project/task/note tracker without cloud dependencies.*
