import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase credentials not configured');
}

export const supabase = supabaseUrl && supabaseKey 
  ? createClient(supabaseUrl, supabaseKey)
  : null;

// ============ TEAM MEMBERS ============

export async function getTeamMembers() {
  const { data, error } = await supabase
    .from('team_members')
    .select('*')
    .order('id');
  
  if (error) throw error;
  return data;
}

export async function upsertTeamMember(member) {
  const { data, error } = await supabase
    .from('team_members')
    .upsert({
      id: member.id || undefined,
      name: member.name,
      role: member.role,
      capacity: member.capacity || 40,
      rate: member.rate || 0,
      color: member.color || '#7d7259'
    }, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteTeamMember(id) {
  const { error } = await supabase
    .from('team_members')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
}

// ============ CLIENTS ============

export async function getClients() {
  const { data, error } = await supabase
    .from('clients')
    .select('*')
    .order('id');
  
  if (error) throw error;
  return data;
}

export async function upsertClient(client) {
  const { data, error } = await supabase
    .from('clients')
    .upsert({
      id: client.id || undefined,
      name: client.name,
      contact: client.contact,
      email: client.email,
      phone: client.phone,
      industry: client.industry,
      notes: client.notes,
      archived: client.archived || false
    }, { onConflict: 'id' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

export async function deleteClient(id) {
  const { error } = await supabase
    .from('clients')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
}

// ============ PROJECTS ============

export async function getProjects() {
  // Get projects with their phases, team, invoices, notes, and client info
  const { data: projects, error } = await supabase
    .from('projects')
    .select(`
      *,
      clients (name),
      project_phases (*),
      project_team (team_member_id),
      project_invoices (*),
      project_notes (*)
    `)
    .eq('archived', false)
    .order('id');
  
  if (error) throw error;
  
  // Transform to match frontend format
  return projects.map(p => ({
    id: p.id,
    notionId: p.notion_id,
    name: p.name || 'Untitled',
    client: p.clients?.name || '',
    clientId: p.client_id,
    status: p.status,
    type: p.type,
    currentPhase: p.current_phase,
    hoursPerWeek: p.hours_per_week,
    startDate: p.start_date ? new Date(p.start_date) : new Date(),
    endDate: p.end_date ? new Date(p.end_date) : new Date(),
    team: p.project_team?.map(pt => pt.team_member_id) || [],
    budget: {
      total: parseFloat(p.budget_total) || 0,
      currency: p.budget_currency || 'USD',
      invoices: p.project_invoices?.map(inv => ({
        id: inv.id,
        description: inv.name || '',
        amount: parseFloat(inv.amount) || 0,
        status: inv.status,
        dueDate: inv.due_date
      })) || []
    },
    notes: p.project_notes?.map(n => ({
      id: n.id,
      content: n.content,
      author: n.author,
      date: n.created_at
    })) || [],
    estimatedHours: p.estimated_hours || 0,
    loggedHours: p.logged_hours || 0,
    phases: p.project_phases?.sort((a, b) => a.phase_index - b.phase_index).map(ph => ({
      id: ph.phase_index,
      dbId: ph.id,
      notionId: ph.notion_id,
      name: ph.name,
      status: ph.status,
      start: ph.start_date ? new Date(ph.start_date) : new Date(),
      end: ph.end_date ? new Date(ph.end_date) : new Date()
    })) || []
  }));
}

export async function upsertProject(project) {
  // Normalize dates to ISO strings
  const startDate = project.startDate instanceof Date ? project.startDate.toISOString() :
                    (project.startDate || new Date().toISOString());
  const endDate = project.endDate instanceof Date ? project.endDate.toISOString() :
                  (project.endDate || new Date().toISOString());

  // Build project record
  const projectRecord = {
    notion_id: project.notionId || null,
    name: project.name,
    client_id: project.clientId || null,
    status: project.status,
    type: project.type,
    current_phase: project.currentPhase || 0,
    hours_per_week: project.hoursPerWeek || 20,
    start_date: startDate,
    end_date: endDate,
    budget_total: project.budget?.total || 0,
    budget_currency: project.budget?.currency || 'USD',
    estimated_hours: project.estimatedHours || 0,
    logged_hours: project.loggedHours || 0,
    archived: false
  };

  // Include id only if it exists (for updates)
  if (project.id) projectRecord.id = project.id;

  // First, upsert the main project record
  const { data: projectData, error: projectError } = await supabase
    .from('projects')
    .upsert(projectRecord, { onConflict: 'id' })
    .select()
    .single();

  if (projectError) throw projectError;
  
  const projectId = projectData.id;
  
  // Update phases - delete existing and re-insert
  const { error: phasesDeleteError } = await supabase.from('project_phases').delete().eq('project_id', projectId);
  if (phasesDeleteError) console.error('Error deleting project_phases:', phasesDeleteError);

  if (project.phases?.length > 0) {
    const phases = project.phases.map((ph, index) => ({
      project_id: projectId,
      notion_id: ph.notionId || null,
      phase_index: ph.id != null ? ph.id : index,
      name: ph.name,
      status: ph.status || 'upcoming',
      start_date: ph.start instanceof Date ? ph.start.toISOString() : ph.start,
      end_date: ph.end instanceof Date ? ph.end.toISOString() : ph.end
    }));

    const { error: phasesInsertError } = await supabase.from('project_phases').insert(phases);
    if (phasesInsertError) console.error('Error inserting project_phases:', phasesInsertError, 'Data:', phases);
  }
  
  // Update team assignments
  const { error: teamDeleteError } = await supabase.from('project_team').delete().eq('project_id', projectId);
  if (teamDeleteError) console.error('Error deleting project_team:', teamDeleteError);

  if (project.team?.length > 0) {
    // Filter to valid integer IDs only
    const validTeamIds = project.team
      .map(id => typeof id === 'number' ? id : parseInt(id))
      .filter(id => !isNaN(id) && id > 0);

    if (validTeamIds.length > 0) {
      const teamAssignments = validTeamIds.map(memberId => ({
        project_id: projectId,
        team_member_id: memberId
      }));

      const { error: teamInsertError } = await supabase.from('project_team').insert(teamAssignments);
      if (teamInsertError) {
        console.error('Error inserting project_team:', teamInsertError, 'Data:', teamAssignments);
      }
    }
  }
  
  // Update invoices
  const { error: invoicesDeleteError } = await supabase.from('project_invoices').delete().eq('project_id', projectId);
  if (invoicesDeleteError) console.error('Error deleting project_invoices:', invoicesDeleteError);

  if (project.budget?.invoices?.length > 0) {
    const invoices = project.budget.invoices.map(inv => ({
      project_id: projectId,
      name: inv.description || inv.name || '',
      amount: inv.amount,
      status: inv.status,
      due_date: inv.dueDate
    }));

    const { error: invoicesInsertError } = await supabase.from('project_invoices').insert(invoices);
    if (invoicesInsertError) console.error('Error inserting project_invoices:', invoicesInsertError);
  }

  // Update notes
  const { error: notesDeleteError } = await supabase.from('project_notes').delete().eq('project_id', projectId);
  if (notesDeleteError) console.error('Error deleting project_notes:', notesDeleteError);

  if (project.notes?.length > 0) {
    const notes = project.notes.map(n => ({
      project_id: projectId,
      content: n.content,
      author: n.author || 'Unknown'
    }));

    const { error: notesInsertError } = await supabase.from('project_notes').insert(notes);
    if (notesInsertError) console.error('Error inserting project_notes:', notesInsertError);
  }

  return projectData;
}

export async function deleteProject(id) {
  // Cascades will handle related records
  const { error } = await supabase
    .from('projects')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
}

export async function addProjectNote(projectId, note) {
  const { data, error } = await supabase
    .from('project_notes')
    .insert({
      project_id: projectId,
      content: note.content,
      author: note.author
    })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============ ARCHIVED PROJECTS ============

export async function getArchivedProjects() {
  const { data, error } = await supabase
    .from('archived_projects')
    .select('*')
    .order('archived_at', { ascending: false });
  
  if (error) throw error;
  
  return data.map(ap => ({
    id: ap.id,
    originalId: ap.original_id,
    name: ap.name,
    client: ap.client_name,
    type: ap.type,
    budget: { total: parseFloat(ap.budget_total) || 0 },
    startDate: ap.start_date,
    endDate: ap.end_date,
    archivedAt: ap.archived_at,
    data: ap.data
  }));
}

export async function archiveProject(project) {
  // Add to archived_projects
  const { data, error } = await supabase
    .from('archived_projects')
    .insert({
      original_id: project.id,
      name: project.name,
      client_name: project.client,
      type: project.type,
      budget_total: project.budget?.total || 0,
      start_date: project.startDate,
      end_date: project.endDate,
      data: project
    })
    .select()
    .single();
  
  if (error) throw error;
  
  // Delete from active projects
  await deleteProject(project.id);
  
  return data;
}

export async function deleteArchivedProject(id) {
  const { error } = await supabase
    .from('archived_projects')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
  return true;
}

export async function restoreProject(archivedProject) {
  // Re-insert project from archived data
  const projectData = archivedProject.data;
  
  if (projectData) {
    await upsertProject({
      ...projectData,
      id: undefined // Get new ID
    });
  }
  
  // Delete from archive
  await deleteArchivedProject(archivedProject.id);
  
  return true;
}

// ============ PROJECT TYPES ============

export async function getProjectTypes() {
  const { data, error } = await supabase
    .from('project_types')
    .select('*')
    .order('key');
  
  if (error) throw error;
  
  // Convert to object format expected by frontend
  const types = {};
  data.forEach(pt => {
    types[pt.key] = {
      name: pt.name,
      color: pt.color,
      phases: pt.phases || []
    };
  });
  
  return types;
}

export async function upsertProjectType(key, typeData) {
  const { data, error } = await supabase
    .from('project_types')
    .upsert({
      key: key,
      name: typeData.name,
      color: typeData.color,
      phases: typeData.phases
    }, { onConflict: 'key' })
    .select()
    .single();
  
  if (error) throw error;
  return data;
}

// ============ FULL DATA SYNC ============

export async function getFullData() {
  const [team, clients, projects, archivedProjects, projectTypes] = await Promise.all([
    getTeamMembers(),
    getClients(),
    getProjects(),
    getArchivedProjects(),
    getProjectTypes()
  ]);
  
  return {
    team: team.map(t => ({
      id: t.id,
      name: t.name,
      role: t.role,
      capacity: t.capacity,
      rate: parseFloat(t.rate) || 0,
      color: t.color
    })),
    clients: clients.map(c => ({
      id: c.id,
      name: c.name,
      contact: c.contact,
      email: c.email,
      phone: c.phone,
      industry: c.industry,
      notes: c.notes,
      archived: c.archived
    })),
    projects,
    archivedProjects,
    projectTypes
  };
}

export async function saveFullData(data) {
  // Save team members - delete ones not in the list first
  if (data.team) {
    // Get existing team member IDs
    const { data: existingTeam } = await supabase.from('team_members').select('id');
    const newTeamIds = data.team.filter(m => m.id).map(m => m.id);
    
    // Delete team members not in the new list
    if (existingTeam) {
      for (const existing of existingTeam) {
        if (!newTeamIds.includes(existing.id)) {
          await supabase.from('team_members').delete().eq('id', existing.id);
        }
      }
    }
    
    // Upsert remaining team members
    for (const member of data.team) {
      await upsertTeamMember(member);
    }
  }
  
  // Save clients - delete ones not in the list first
  if (data.clients) {
    const { data: existingClients } = await supabase.from('clients').select('id');
    const newClientIds = data.clients.filter(c => c.id).map(c => c.id);
    
    if (existingClients) {
      for (const existing of existingClients) {
        if (!newClientIds.includes(existing.id)) {
          await supabase.from('clients').delete().eq('id', existing.id);
        }
      }
    }
    
    for (const client of data.clients) {
      await upsertClient(client);
    }
  }
  
  // Save projects - delete ones not in the list first
  if (data.projects) {
    const { data: existingProjects } = await supabase.from('projects').select('id');
    const newProjectIds = data.projects.filter(p => p.id).map(p => p.id);
    
    if (existingProjects) {
      for (const existing of existingProjects) {
        if (!newProjectIds.includes(existing.id)) {
          await supabase.from('projects').delete().eq('id', existing.id);
        }
      }
    }
    
    for (const project of data.projects) {
      await upsertProject(project);
    }
  }
  
  // Save project types
  if (data.projectTypes) {
    for (const [key, typeData] of Object.entries(data.projectTypes)) {
      await upsertProjectType(key, typeData);
    }
  }
  
  return { success: true };
}
