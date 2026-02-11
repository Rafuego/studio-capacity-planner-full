import { NextResponse } from 'next/server';
import { getArchivedProjects, deleteArchivedProject, restoreProject, archiveProject, supabase } from '../../../../lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Fetch all archived projects
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }

    const archivedProjects = await getArchivedProjects();

    return NextResponse.json({
      success: true,
      archivedProjects
    }, { headers: corsHeaders });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// POST - Archive or restore a project
export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }

    const body = await request.json();

    if (body.action === 'restore') {
      await restoreProject(body.project);
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    if (body.action === 'archive') {
      await archiveProject(body.project);
      return NextResponse.json({ success: true }, { headers: corsHeaders });
    }

    return NextResponse.json({ success: false, error: 'Unknown action. Use action: "archive" or "restore"' }, { status: 400, headers: corsHeaders });

  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE - Permanently delete archived project
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
    
    await deleteArchivedProject(parseInt(id));
    
    return NextResponse.json({ success: true }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
