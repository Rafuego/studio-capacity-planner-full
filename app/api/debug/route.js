import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    supabase_url_exists: !!process.env.SUPABASE_URL,
    supabase_url_length: process.env.SUPABASE_URL?.length || 0,
    supabase_key_exists: !!process.env.SUPABASE_ANON_KEY,
    supabase_key_length: process.env.SUPABASE_ANON_KEY?.length || 0,
    notion_token_exists: !!process.env.NOTION_TOKEN,
    all_env_keys: Object.keys(process.env).filter(k => k.includes('SUPA') || k.includes('NOTION')),
  }, {
    headers: {
      'Access-Control-Allow-Origin': '*',
    }
  });
}
