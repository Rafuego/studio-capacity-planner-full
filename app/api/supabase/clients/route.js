import { NextResponse } from 'next/server';
import { getClients, upsertClient, deleteClient, supabase } from '../../../../lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Fetch all clients
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }
    
    const clients = await getClients();
    
    return NextResponse.json({
      success: true,
      clients: clients.map(c => ({
        id: c.id,
        name: c.name,
        contact: c.contact,
        email: c.email,
        phone: c.phone,
        industry: c.industry,
        notes: c.notes,
        archived: c.archived
      }))
    }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// POST - Create or update client
export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500, headers: corsHeaders });
    }
    
    const client = await request.json();
    const saved = await upsertClient(client);
    
    return NextResponse.json({
      success: true,
      client: saved
    }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}

// DELETE - Remove client
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
    
    await deleteClient(parseInt(id));
    
    return NextResponse.json({ success: true }, { headers: corsHeaders });
    
  } catch (error) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500, headers: corsHeaders });
  }
}
