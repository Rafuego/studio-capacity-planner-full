import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Debug: show raw project_team data and project info
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }

    const [
      { data: projectTeam, error: ptErr },
      { data: projects, error: pErr },
      { data: teamMembers, error: tmErr },
      { data: clients, error: cErr }
    ] = await Promise.all([
      supabase.from('project_team').select('*'),
      supabase.from('projects').select('id, name, client_id, status'),
      supabase.from('team_members').select('id, name'),
      supabase.from('clients').select('id, name')
    ]);

    return NextResponse.json({
      project_team: projectTeam || [],
      project_team_error: ptErr?.message || null,
      projects: (projects || []).map(p => ({ id: p.id, name: p.name, client_id: p.client_id, status: p.status })),
      projects_error: pErr?.message || null,
      team_members: teamMembers || [],
      team_members_error: tmErr?.message || null,
      clients: (clients || []).map(c => ({ id: c.id, name: c.name })),
      clients_error: cErr?.message || null,
      counts: {
        project_team_rows: (projectTeam || []).length,
        projects: (projects || []).length,
        team_members: (teamMembers || []).length,
        clients: (clients || []).length
      }
    }, { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
