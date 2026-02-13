import { NextResponse } from 'next/server';
import { supabase } from '../../../../lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// POST - Wipe all data from all tables
export async function POST() {
  try {
    if (!supabase) {
      return NextResponse.json({ error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }

    const results = {};

    // Delete in correct order (child tables first to respect FK constraints)
    const deleteOrder = [
      'project_phases',
      'project_team',
      'project_invoices',
      'project_notes',
      'archived_projects',
      'projects',
      'clients',
      'team_members',
      'project_types'
    ];

    for (const table of deleteOrder) {
      try {
        // Delete all rows — use neq on id to match everything
        const { error } = await supabase.from(table).delete().neq('id', -99999);
        if (error) {
          // Some tables might use 'key' instead of 'id' (like project_types)
          const { error: error2 } = await supabase.from(table).delete().neq('key', '___none___');
          results[table] = error2 ? { error: error2.message } : { cleared: true };
        } else {
          results[table] = { cleared: true };
        }
      } catch (e) {
        results[table] = { error: e.message };
      }
    }

    return NextResponse.json({
      success: true,
      message: 'All data has been cleared',
      tables: results
    }, { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: corsHeaders });
  }
}
