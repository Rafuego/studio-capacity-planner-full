# Studio Capacity Planner

A studio management tool with Notion integration and Supabase backend.

## Project Structure

```
├── frontend/
│   └── index.html          # Main planner UI (single HTML file)
├── app/
│   └── api/
│       ├── notion/
│       │   ├── projects/   # Notion projects CRUD
│       │   ├── tasks/      # Notion tasks CRUD
│       │   └── sync/       # Full Notion sync
│       ├── supabase/
│       │   ├── sync/       # Supabase data sync
│       │   ├── projects/   # Projects CRUD
│       │   ├── clients/    # Clients CRUD
│       │   ├── team/       # Team members CRUD
│       │   └── archive/    # Archived projects
│       └── debug/
│           ├── route.js    # Env var debug endpoint
│           └── notion/     # Notion raw data debug
├── lib/
│   ├── notion.js           # Notion API client
│   └── supabase.js         # Supabase client
├── package.json
├── next.config.js
└── .env.example
```

## Setup

### 1. API Backend (Vercel)

1. Create a new Vercel project from this repo (excluding frontend/)
2. Add environment variables in Vercel:
   - `NOTION_TOKEN` - Notion integration token
   - `NOTION_PROJECTS_DB` - Notion projects database ID
   - `NOTION_TASKS_DB` - Notion tasks database ID
   - `SUPABASE_URL` - Your Supabase project URL (e.g., https://xxx.supabase.co)
   - `SUPABASE_ANON_KEY` - Supabase anon/public key

3. Deploy

### 2. Supabase

Create these tables in Supabase:

```sql
-- Projects table
CREATE TABLE projects (
  id SERIAL PRIMARY KEY,
  notion_id TEXT,
  name TEXT NOT NULL,
  client TEXT,
  client_id INTEGER,
  status TEXT DEFAULT 'pipeline',
  type TEXT DEFAULT 'other',
  start_date TIMESTAMP,
  end_date TIMESTAMP,
  hours_per_week INTEGER DEFAULT 20,
  estimated_hours INTEGER,
  team INTEGER[] DEFAULT '{}',
  phases JSONB DEFAULT '[]',
  budget JSONB,
  notes JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Team table
CREATE TABLE team (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  capacity INTEGER DEFAULT 40,
  color TEXT,
  rate NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Clients table
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  contact TEXT,
  email TEXT,
  phone TEXT,
  industry TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Archived projects table
CREATE TABLE archived_projects (
  id SERIAL PRIMARY KEY,
  original_id INTEGER,
  data JSONB NOT NULL,
  archived_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Frontend

The frontend is a single HTML file (`frontend/index.html`). You can:
- Host it on Vercel/Netlify/GitHub Pages
- Open it locally in a browser
- Embed it in another project

Configure in the UI:
1. Settings → Notion Integration → Enter your Vercel API URL
2. Settings → Cloud Storage → Enter your Vercel API URL

## Key Features

- **Dashboard**: Overview of capacity, active projects, alerts
- **Timeline**: Gantt chart view with team assignments
- **Projects**: Manage projects, phases, budgets, invoices
- **Team**: Manage team members and capacity
- **Clients**: Client database with contacts
- **Archive**: Completed projects stored for reference

## Notion Integration

The Notion database should have:

**Projects Database:**
- `Project name` (title)
- `Status` (status)
- `Rate $` (number)
- `Account Owner` (people)
- `Dates` (date range)
- `Priority` (select)

**Tasks Database:**
- `Name` (title)
- `Status` (status)
- `Project` (relation to Projects)
- `Date` (date range)

## Data Flow

```
Notion → Vercel API → Supabase (source of truth)
                ↑
            Frontend
```

1. Initial setup: Import from Notion to Supabase
2. Daily use: Frontend ↔ Supabase via Vercel API
3. Notion import: Manual "Import from Notion" merges new projects

## Debug Endpoints

- `/api/debug` - Check if env vars are loaded
- `/api/debug/notion` - See raw Notion property structure
