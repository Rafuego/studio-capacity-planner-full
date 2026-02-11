import { Client } from '@notionhq/client';

const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const PROJECTS_DB = process.env.NOTION_PROJECTS_DB;
const TASKS_DB = process.env.NOTION_TASKS_DB;

// Transform Notion project to simple format
function transformProject(page) {
  const props = page.properties;
  
  return {
    id: page.id,
    name: props['Project name']?.title?.[0]?.plain_text || 'Untitled',
    status: props.Status?.status?.name?.toLowerCase() || 'pipeline',
    type: props.Type?.select?.name?.toLowerCase() || 'other',
    accountOwner: props['Account Owner']?.people?.map(p => p.name) || [],
    rate: props['Rate $']?.number || 0,
    startDate: props.Dates?.date?.start || null,
    endDate: props.Dates?.date?.end || props.Dates?.date?.start || null,
    priority: props.Priority?.select?.name || null,
    lastEdited: page.last_edited_time,
  };
}

// Transform Notion task to simple format
function transformTask(page) {
  const props = page.properties;
  
  // Get project relation
  const projectRelation = props.Project?.relation?.[0]?.id || null;
  
  // Get dates
  const dateRange = props.Date?.date;
  
  return {
    id: page.id,
    name: props.Name?.title?.[0]?.plain_text || 'Untitled',
    status: props.Status?.status?.name || 'Not Started',
    projectId: projectRelation,
    startDate: dateRange?.start || null,
    endDate: dateRange?.end || dateRange?.start || null,
    lastEdited: page.last_edited_time,
  };
}

// Get all projects
export async function getProjects() {
  const response = await notion.databases.query({
    database_id: PROJECTS_DB,
  });
  
  return response.results.map(transformProject);
}

// Get all tasks
export async function getTasks() {
  const response = await notion.databases.query({
    database_id: TASKS_DB,
  });
  
  return response.results.map(transformTask);
}

// Full sync - get both projects and tasks
export async function fullSync() {
  const [projects, tasks] = await Promise.all([
    getProjects(),
    getTasks(),
  ]);
  
  return { projects, tasks };
}

// Create a new project
export async function createProject(data) {
  const response = await notion.pages.create({
    parent: { database_id: PROJECTS_DB },
    properties: {
      Name: {
        title: [{ text: { content: data.name } }],
      },
      Status: {
        status: { name: data.status || 'Pipeline' },
      },
      ...(data.type && {
        Type: {
          select: { name: data.type },
        },
      }),
      ...(data.rate && {
        Rate: {
          number: data.rate,
        },
      }),
    },
  });
  
  return transformProject(response);
}

// Update a project
export async function updateProject(pageId, data) {
  const properties = {};
  
  if (data.name) {
    properties.Name = {
      title: [{ text: { content: data.name } }],
    };
  }
  
  if (data.status) {
    properties.Status = {
      status: { name: data.status },
    };
  }
  
  if (data.type) {
    properties.Type = {
      select: { name: data.type },
    };
  }
  
  if (data.rate !== undefined) {
    properties.Rate = {
      number: data.rate,
    };
  }
  
  const response = await notion.pages.update({
    page_id: pageId,
    properties,
  });
  
  return transformProject(response);
}

// Create a new task
export async function createTask(data) {
  const properties = {
    Name: {
      title: [{ text: { content: data.name } }],
    },
  };
  
  if (data.status) {
    properties.Status = {
      status: { name: data.status },
    };
  }
  
  if (data.projectId) {
    properties.Project = {
      relation: [{ id: data.projectId }],
    };
  }
  
  if (data.startDate) {
    properties.Date = {
      date: {
        start: data.startDate,
        end: data.endDate || data.startDate,
      },
    };
  }
  
  const response = await notion.pages.create({
    parent: { database_id: TASKS_DB },
    properties,
  });
  
  return transformTask(response);
}

// Update a task
export async function updateTask(pageId, data) {
  const properties = {};
  
  if (data.name) {
    properties.Name = {
      title: [{ text: { content: data.name } }],
    };
  }
  
  if (data.status) {
    properties.Status = {
      status: { name: data.status },
    };
  }
  
  if (data.startDate) {
    properties.Date = {
      date: {
        start: data.startDate,
        end: data.endDate || data.startDate,
      },
    };
  }
  
  const response = await notion.pages.update({
    page_id: pageId,
    properties,
  });
  
  return transformTask(response);
}
