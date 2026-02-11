import { NextResponse } from 'next/server';
import { updateTask } from '../../../../../lib/notion';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function PATCH(request, { params }) {
  try {
    const { id } = params;
    const data = await request.json();
    
    const updated = await updateTask(id, data);
    
    return NextResponse.json({
      success: true,
      task: updated,
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Task update error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders });
  }
}
