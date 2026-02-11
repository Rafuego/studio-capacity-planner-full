import { NextResponse } from 'next/server';
import { getTeamMembers, upsertTeamMember, deleteTeamMember, supabase } from '../../../../lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Fetch all team members
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }
    
    const team = await getTeamMembers();
    
    return NextResponse.json({
      success: true,
      team: team.map(t => ({
        id: t.id,
        name: t.name,
        role: t.role,
        capacity: t.capacity,
        rate: parseFloat(t.rate) || 0,
        color: t.color
      }))
    }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// POST - Create or update team member
export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }
    
    const member = await request.json();
    const saved = await upsertTeamMember(member);
    
    return NextResponse.json({
      success: true,
      member: saved
    }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE - Remove team member
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
    
    await deleteTeamMember(parseInt(id));
    
    return NextResponse.json({ success: true }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
