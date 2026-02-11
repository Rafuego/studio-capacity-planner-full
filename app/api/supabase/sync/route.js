import { NextResponse } from 'next/server';
import { getFullData, saveFullData, supabase } from '../../../../lib/supabase';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

// GET - Fetch all data from Supabase
export async function GET() {
  try {
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase not configured'
      }, { status: 500, headers: corsHeaders });
    }
    
    const data = await getFullData();
    
    return NextResponse.json({
      success: true,
      data,
      syncedAt: new Date().toISOString()
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Supabase fetch error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}

// POST - Save all data to Supabase
export async function POST(request) {
  try {
    if (!supabase) {
      return NextResponse.json({
        success: false,
        error: 'Supabase not configured'
      }, { status: 500, headers: corsHeaders });
    }
    
    const data = await request.json();
    
    await saveFullData(data);
    
    return NextResponse.json({
      success: true,
      savedAt: new Date().toISOString()
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Supabase save error:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500, headers: corsHeaders });
  }
}
