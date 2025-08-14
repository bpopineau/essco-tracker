# ESSCO Project Tracker (Client-Only)

A lightweight, browser-only project tracker for ESSCO’s internal workflows.  
No backend. No cloud lock-in. All data is stored locally in the browser using `IndexedDB` and/or `localStorage`, with simple import/export for backup and sharing.

## Features

- **Projects & Notes**
  - Meeting notes with task linkage
  - Quick add new notes with date + free-form text
- **Tasks**
  - Kanban board with drag-and-drop
  - Table view with sorting by due date
  - Quick add form with assignee, priority, due date, and note link
  - Inline badges for overdue/soon/open counts
- **Insights**
  - Overdue / soon / open task counts
  - Notes → Tasks coverage %
  - Workload chart by assignee
- **100% Client-Side**
  - Works offline
  - No server or API required
  - Local persistence (IndexedDB/localStorage)
  - JSON import/export for backups and migration

## Getting Started

1. **Clone or Download**
   git clone https://github.com/your-org/essco-project-tracker.git  
   cd essco-project-tracker

2. **Open in Browser**
   - Just open `index.html` in any modern browser (Chrome, Edge, Firefox).

3. **Save Data**
   - All changes persist locally in the browser.
   - Use **Export** from the menu to download a `.json` backup.
   - Drag-drop a `.json` backup into the window to restore.

## Development

- Edit `index.html` for markup, styling, and logic.
- Use a simple static server for local dev (optional):
  npx serve  
  or  
  python -m http.server
- No build step is required right now, but a bundler can be added later.

## Browser Support

- Chrome 90+
- Edge 90+
- Firefox 90+
- Safari 14+ (with limited File System Access API support)

## License

MIT — see LICENSE

---

# Roadmap

## Guiding Principles
- Keep it **100% client-side**.
- **No server dependency** — storage is local.
- Focus on **fast, friction-free** daily use.
- Small, iterative improvements that don’t block current work.

## 0. Core Stability (Now)
- [ ] Ensure local data persistence via IndexedDB wrapper.
- [ ] Add export/import JSON backup.
- [ ] Schema versioning for safe upgrades.
- [ ] Fix Kanban empty-space drop targets + hover highlights.

## 1. UX Enhancements
- [ ] Inline task editing.
- [ ] Quick keyboard shortcuts (`/` focus search, `n` note, `t` task, `1/2/3` tabs).
- [ ] Column/row filters for Assignee, Status, Priority, Due.
- [ ] Bulk actions from Table view.
- [ ] Saved filter views (“My Hotlist”, “PM Review”).

## 2. Insights & Reporting
- [ ] Throughput trend (rolling 7-day completed tasks).
- [ ] Aging WIP highlight (>14 days same status).
- [ ] Coverage metrics: notes producing ≥1 task per week.
- [ ] Workload fairness check (flag overload vs median).

## 3. Offline & PWA
- [ ] Add manifest.json + service worker for offline shell.
- [ ] Installable PWA with icon and splash screen.
- [ ] Cache static assets for instant load.

## 4. Reliability Features
- [ ] Undo/redo history (bounded stack).
- [ ] Conflict-safe imports (id collision resolution).
- [ ] Autosave status indicator.

## 5. Theming & Accessibility
- [ ] Light/dark theme toggle with `prefers-color-scheme` default.
- [ ] Density setting (Compact / Cozy).
- [ ] ARIA roles for tabs, task movement announcements.
- [ ] Keyboard-accessible Kanban.

## 6. Integrations (Still Local)
- [ ] CSV/Excel import for bulk task creation.
- [ ] Local file attachments via File System Access API.
- [ ] Paste checklist from notes → bulk create tasks.

## Done When…
- App runs offline on desktop & mobile.
- Users can recover from any mistake (undo/redo).
- All changes persist without manual saves.
- Backup/restore is a one-click action.
- UI stays responsive even with 1,000+ tasks.

_Last updated: 2025-08-14_
