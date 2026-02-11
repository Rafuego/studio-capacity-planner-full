import { NextResponse } from 'next/server';
import { getProjects, upsertProject, deleteProject, archiveProject, addProjectNote, supabase } from '../../../../lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Fetch all projects
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }
    
    const projects = await getProjects();
    
    return NextResponse.json({
      success: true,
      projects
    }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// POST - Create or update project
export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }
    
    const body = await request.json();
    
    // Check if this is a note addition
    if (body.action === 'addNote') {
      const note = await addProjectNote(body.projectId, body.note);
      return NextResponse.json({ success: true, note }, { headers: corsHeaders });
    }
    
    // Check if this is an archive action
    if (body.action === 'archive') {
      const archived = await archiveProject(body.project);
      return NextResponse.json({ success: true, archived }, { headers: corsHeaders });
    }
    
    // Default: upsert project
    const saved = await upsertProject(body);
    
    return NextResponse.json({
      success: true,
      project: saved
    }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE - Remove project
export async function DELETE(request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }
    
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ success: false, error: 'ID required' }, { status: 400, headers: corsHeaders });
    }
    
    await deleteProject(parseInt(id));
    
    return NextResponse.json({ success: true }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
