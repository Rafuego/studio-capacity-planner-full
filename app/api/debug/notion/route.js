import { NextResponse } from 'next/server';
import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

export async function GET() {
  try {
    const response = await notion.databases.query({
      database_id: process.env.NOTION_PROJECTS_DB,
      page_size: 1,
    });
    
    const firstProject = response.results[0];
    
    return NextResponse.json({
      success: true,
      propertyNames: Object.keys(firstProject?.properties || {}),
      rawProperties: firstProject?.properties,
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error.message
    }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
