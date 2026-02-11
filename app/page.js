export default function Home() {
  return (
    <div style={{ padding: '40px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>Studio Planner API</h1>
      <p>API endpoints:</p>
      <ul>
        <li><code>/api/notion/sync</code> - Sync from Notion</li>
        <li><code>/api/supabase/sync</code> - Sync with Supabase</li>
        <li><code>/api/supabase/team</code> - Team members CRUD</li>
        <li><code>/api/supabase/clients</code> - Clients CRUD</li>
        <li><code>/api/supabase/projects</code> - Projects CRUD</li>
        <li><code>/api/supabase/archive</code> - Archived projects</li>
      </ul>
    </div>
  );
}
