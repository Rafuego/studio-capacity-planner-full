import { NextResponse } from 'next/server';
import { fullSync } from '../../../../lib/notion';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET() {
  try {
    const data = await fullSync();
    
    return NextResponse.json({
      success: true,
      ...data,
      syncedAt: new Date().toISOString(),
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Notion sync error:', error);
    return NextResponse.json({
      success: false,
      error: error.message,
    }, { status: 500, headers: corsHeaders });
  }
}
