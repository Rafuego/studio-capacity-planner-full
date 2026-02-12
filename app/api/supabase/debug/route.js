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

// GET - Debug: test each table and show raw data
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }

    const tableTests = {};

    // Test each table the code depends on
    const tables = [
      'team_members',
      'clients',
      'projects',
      'project_team',
      'project_phases',
      'project_invoices',
      'project_notes',
      'project_types',
      'archived_projects'
    ];

    for (const table of tables) {
      try {
        const { data, error, count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: false })
          .limit(5);

        if (error) {
          tableTests[table] = { exists: false, error: error.message, code: error.code, hint: error.hint };
        } else {
          tableTests[table] = {
            exists: true,
            rowCount: data?.length || 0,
            sampleColumns: data && data.length > 0 ? Object.keys(data[0]) : [],
            sample: data?.slice(0, 2) || []
          };
        }
      } catch (e) {
        tableTests[table] = { exists: false, error: e.message };
      }
    }

    // Also do a join test like getProjects does
    let joinTest = null;
    try {
      const { data, error } = await supabase
        .from('projects')
        .select(`
          id, name,
          clients (name),
          project_phases (id, name),
          project_team (team_member_id),
          project_invoices (id),
          project_notes (id)
        `)
        .limit(2);

      if (error) {
        joinTest = { success: false, error: error.message, code: error.code, hint: error.hint };
      } else {
        joinTest = { success: true, sampleProject: data?.[0] || null };
      }
    } catch (e) {
      joinTest = { success: false, error: e.message };
    }

    // Test a minimal write + read cycle on project_team
    let writeTest = null;
    try {
      // Get a valid project and team member
      const { data: proj } = await supabase.from('projects').select('id').limit(1).single();
      const { data: tm } = await supabase.from('team_members').select('id').limit(1).single();

      if (proj && tm) {
        // Try inserting
        const { error: insertErr } = await supabase.from('project_team').insert({
          project_id: proj.id,
          team_member_id: tm.id
        });

        if (insertErr) {
          // Might be duplicate — that's OK, try upsert
          writeTest = {
            success: false,
            insertError: insertErr.message,
            code: insertErr.code,
            hint: insertErr.hint,
            projectId: proj.id,
            teamMemberId: tm.id
          };
        } else {
          // Read it back
          const { data: readBack, error: readErr } = await supabase
            .from('project_team')
            .select('*')
            .eq('project_id', proj.id)
            .eq('team_member_id', tm.id);

          writeTest = {
            success: !readErr,
            inserted: true,
            readBack: readBack,
            readError: readErr?.message
          };

          // Clean up — delete the test row
          await supabase
            .from('project_team')
            .delete()
            .eq('project_id', proj.id)
            .eq('team_member_id', tm.id);
        }
      } else {
        writeTest = { success: false, error: 'No projects or team members found to test with' };
      }
    } catch (e) {
      writeTest = { success: false, error: e.message };
    }

    return NextResponse.json({
      tables: tableTests,
      joinTest,
      writeTest,
      summary: {
        allTablesExist: Object.values(tableTests).every(t => t.exists),
        missingTables: Object.entries(tableTests).filter(([, t]) => !t.exists).map(([name]) => name),
        joinsWork: joinTest?.success,
        writeWorks: writeTest?.success
      }
    }, { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
