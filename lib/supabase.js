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

export async function upsertProject(project, validClientIds = null) {
  // Normalize dates to ISO strings
  const startDate = project.startDate instanceof Date ? project.startDate.toISOString() :
                    (project.startDate || new Date().toISOString());
  const endDate = project.endDate instanceof Date ? project.endDate.toISOString() :
                  (project.endDate || new Date().toISOString());

  // Validate client_id - only include if it exists in the clients table
  let clientId = project.clientId || null;
  if (clientId && validClientIds) {
    if (!validClientIds.includes(clientId)) {
      console.warn(`Project "${project.name}" has invalid client_id ${clientId}, setting to null`);
      clientId = null;
    }
  }

  // Build project record
  const projectRecord = {
    notion_id: project.notionId || null,
    name: project.name,
    client_id: clientId,
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

  if (projectError) {
    console.error(`Error upserting project "${project.name}":`, projectError);
    // If it's a FK constraint error on client_id, retry without client_id
    if (projectError.code === '23503' && projectError.message?.includes('client_id')) {
      console.warn(`Retrying project "${project.name}" without client_id`);
      projectRecord.client_id = null;
      const { data: retryData, error: retryError } = await supabase
        .from('projects')
        .upsert(projectRecord, { onConflict: 'id' })
        .select()
        .single();
      if (retryError) throw retryError;
      // Continue with retried data
      return await upsertProjectRelations(retryData.id, project);
    }
    throw projectError;
  }
  
  const projectId = projectData.id;

  // Save relations (phases, team, invoices, notes)
  await upsertProjectRelations(projectId, project);

  return projectData;
}

// Helper to save all project relation tables (called separately to allow retry)
async function upsertProjectRelations(projectId, project) {
  const errors = [];

  // Update phases - delete existing and re-insert
  const { error: phasesDeleteError } = await supabase.from('project_phases').delete().eq('project_id', projectId);
  if (phasesDeleteError) errors.push({ table: 'project_phases', op: 'delete', error: phasesDeleteError });

  if (project.phases?.length > 0) {
    const phases = project.phases.map((ph, index) => ({
      project_id: projectId,
      notion_id: ph.notionId || null,
      phase_index: ph.id != null ? ph.id : index,
      name: ph.name,
      status: ph.status || 'upcoming',
      start_date: ph.start instanceof Date ? ph.start.toISOString() : (ph.start || null),
      end_date: ph.end instanceof Date ? ph.end.toISOString() : (ph.end || null)
    }));

    const { error: phasesInsertError } = await supabase.from('project_phases').insert(phases);
    if (phasesInsertError) errors.push({ table: 'project_phases', op: 'insert', error: phasesInsertError, data: phases });
  }

  // Update team assignments
  const { error: teamDeleteError } = await supabase.from('project_team').delete().eq('project_id', projectId);
  if (teamDeleteError) errors.push({ table: 'project_team', op: 'delete', error: teamDeleteError });

  if (project.team?.length > 0) {
    // Filter to valid integer IDs only
    const validTeamIds = project.team
      .map(id => typeof id === 'number' ? id : parseInt(id))
      .filter(id => !isNaN(id) && id > 0);

    if (validTeamIds.length > 0) {
      // Insert one-by-one to avoid a single bad FK killing all team assignments
      for (const memberId of validTeamIds) {
        const { error: teamInsertError } = await supabase.from('project_team').insert({
          project_id: projectId,
          team_member_id: memberId
        });
        if (teamInsertError) {
          errors.push({ table: 'project_team', op: 'insert', error: teamInsertError, memberId });
          console.error(`Error inserting project_team for project ${projectId}, member ${memberId}:`, teamInsertError);
        }
      }
    }
  }

  // Update invoices
  const { error: invoicesDeleteError } = await supabase.from('project_invoices').delete().eq('project_id', projectId);
  if (invoicesDeleteError) errors.push({ table: 'project_invoices', op: 'delete', error: invoicesDeleteError });

  if (project.budget?.invoices?.length > 0) {
    const invoices = project.budget.invoices.map(inv => ({
      project_id: projectId,
      name: inv.description || inv.name || '',
      amount: inv.amount,
      status: inv.status,
      due_date: inv.dueDate
    }));

    const { error: invoicesInsertError } = await supabase.from('project_invoices').insert(invoices);
    if (invoicesInsertError) errors.push({ table: 'project_invoices', op: 'insert', error: invoicesInsertError });
  }

  // Update notes
  const { error: notesDeleteError } = await supabase.from('project_notes').delete().eq('project_id', projectId);
  if (notesDeleteError) errors.push({ table: 'project_notes', op: 'delete', error: notesDeleteError });

  if (project.notes?.length > 0) {
    const notes = project.notes.map(n => ({
      project_id: projectId,
      content: n.content,
      author: n.author || 'Unknown'
    }));

    const { error: notesInsertError } = await supabase.from('project_notes').insert(notes);
    if (notesInsertError) errors.push({ table: 'project_notes', op: 'insert', error: notesInsertError });
  }

  if (errors.length > 0) {
    console.error(`Project ${projectId} ("${project.name}") had ${errors.length} relation errors:`, errors);
  }

  return { projectId, errors };
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
  const errors = [];

  // === BATCH SAVE TEAM MEMBERS ===
  try {
    if (data.team) {
      const { data: existingTeam } = await supabase.from('team_members').select('id');
      const newTeamIds = data.team.filter(m => m.id).map(m => m.id);

      // Delete removed team members
      const toDelete = (existingTeam || []).filter(e => !newTeamIds.includes(e.id)).map(e => e.id);
      if (toDelete.length > 0) {
        await supabase.from('team_members').delete().in('id', toDelete);
      }

      // Batch upsert all team members at once
      const teamRecords = data.team.map(m => ({
        id: m.id || undefined,
        name: m.name,
        role: m.role,
        capacity: m.capacity || 40,
        rate: m.rate || 0,
        color: m.color || '#7d7259'
      }));
      if (teamRecords.length > 0) {
        const { error: teamErr } = await supabase.from('team_members').upsert(teamRecords, { onConflict: 'id' });
        if (teamErr) errors.push({ step: 'team_upsert', error: teamErr.message });
      }
    }
  } catch (e) {
    errors.push({ step: 'team_members', error: e.message });
  }

  // === BATCH SAVE CLIENTS ===
  try {
    if (data.clients) {
      const { data: existingClients } = await supabase.from('clients').select('id');
      const newClientIds = data.clients.filter(c => c.id).map(c => c.id);

      const toDeleteClients = (existingClients || []).filter(e => !newClientIds.includes(e.id)).map(e => e.id);
      if (toDeleteClients.length > 0) {
        await supabase.from('clients').delete().in('id', toDeleteClients);
      }

      // Batch upsert all clients at once
      const clientRecords = data.clients.map(c => ({
        id: c.id || undefined,
        name: c.name,
        contact: c.contact,
        email: c.email,
        phone: c.phone,
        industry: c.industry,
        notes: c.notes,
        archived: c.archived || false
      }));
      if (clientRecords.length > 0) {
        const { error: clientErr } = await supabase.from('clients').upsert(clientRecords, { onConflict: 'id' });
        if (clientErr) errors.push({ step: 'clients_upsert', error: clientErr.message });
      }
    }
  } catch (e) {
    errors.push({ step: 'clients', error: e.message });
  }

  // === SAVE PROJECTS ===
  const projectErrors = [];
  let validClientIds = [];
  let validTeamMemberIds = [];

  try {
    if (data.projects) {
      const { data: existingProjects } = await supabase.from('projects').select('id');
      const newProjectIds = data.projects.filter(p => p.id).map(p => p.id);

      // Delete removed projects
      const toDeleteProjects = (existingProjects || []).filter(e => !newProjectIds.includes(e.id)).map(e => e.id);
      if (toDeleteProjects.length > 0) {
        await supabase.from('projects').delete().in('id', toDeleteProjects);
      }

      // Pre-fetch valid client IDs and team member IDs for FK validation
      const [{ data: validClients }, { data: validTeam }] = await Promise.all([
        supabase.from('clients').select('id'),
        supabase.from('team_members').select('id')
      ]);
      validClientIds = validClients ? validClients.map(c => c.id) : [];
      validTeamMemberIds = validTeam ? validTeam.map(t => t.id) : [];

      // Batch upsert all project records at once (main table only)
      const projectRecords = data.projects.map(project => {
        let clientId = project.clientId || null;
        if (clientId && !validClientIds.includes(clientId)) clientId = null;

        const startDate = project.startDate instanceof Date ? project.startDate.toISOString() :
                          (project.startDate || new Date().toISOString());
        const endDate = project.endDate instanceof Date ? project.endDate.toISOString() :
                        (project.endDate || new Date().toISOString());

        const rec = {
          notion_id: project.notionId || null,
          name: project.name,
          client_id: clientId,
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
        if (project.id) rec.id = project.id;
        return rec;
      });

      if (projectRecords.length > 0) {
        const { error: projErr } = await supabase.from('projects').upsert(projectRecords, { onConflict: 'id' });
        if (projErr) {
          console.error('Batch project upsert error:', projErr);
          errors.push({ step: 'projects_batch_upsert', error: projErr.message });
          // If batch fails (e.g. FK), fall back to one-by-one
          for (const project of data.projects) {
            try {
              await upsertProject(project, validClientIds);
            } catch (err) {
              projectErrors.push({ project: project.name, id: project.id, error: err.message });
            }
          }
        }
      }

      // Now batch save all relations
      const projectIds = data.projects.filter(p => p.id).map(p => p.id);

      if (projectIds.length > 0) {
        // Bulk delete all existing relations for these projects in parallel
        const deleteResults = await Promise.all([
          supabase.from('project_phases').delete().in('project_id', projectIds),
          supabase.from('project_team').delete().in('project_id', projectIds),
          supabase.from('project_invoices').delete().in('project_id', projectIds),
          supabase.from('project_notes').delete().in('project_id', projectIds)
        ]);
        deleteResults.forEach((r, i) => {
          if (r.error) errors.push({ step: `relation_delete_${i}`, error: r.error.message });
        });

        // Collect all relation records
        const allPhases = [];
        const allTeam = [];
        const allInvoices = [];
        const allNotes = [];

        for (const project of data.projects) {
          if (!project.id) continue;
          const pid = project.id;

          // Phases
          if (project.phases?.length > 0) {
            project.phases.forEach((ph, index) => {
              allPhases.push({
                project_id: pid,
                notion_id: ph.notionId || null,
                phase_index: ph.id != null ? ph.id : index,
                name: ph.name,
                status: ph.status || 'upcoming',
                start_date: ph.start instanceof Date ? ph.start.toISOString() : (ph.start || null),
                end_date: ph.end instanceof Date ? ph.end.toISOString() : (ph.end || null)
              });
            });
          }

          // Team — validate against actual team_members table to avoid FK errors
          if (project.team?.length > 0) {
            const teamIds = project.team
              .map(id => typeof id === 'number' ? id : parseInt(id))
              .filter(id => !isNaN(id) && id > 0 && validTeamMemberIds.includes(id));
            teamIds.forEach(memberId => {
              allTeam.push({ project_id: pid, team_member_id: memberId });
            });
          }

          // Invoices
          if (project.budget?.invoices?.length > 0) {
            project.budget.invoices.forEach(inv => {
              allInvoices.push({
                project_id: pid,
                name: inv.description || inv.name || '',
                amount: inv.amount,
                status: inv.status,
                due_date: inv.dueDate
              });
            });
          }

          // Notes
          if (project.notes?.length > 0) {
            project.notes.forEach(n => {
              allNotes.push({
                project_id: pid,
                content: n.content,
                author: n.author || 'Unknown'
              });
            });
          }
        }

        // Deduplicate team assignments (same project_id + team_member_id)
        const teamKey = (r) => `${r.project_id}_${r.team_member_id}`;
        const uniqueTeam = [...new Map(allTeam.map(r => [teamKey(r), r])).values()];

        // Batch insert all relations in parallel — each wrapped to not kill the others
        const insertResults = await Promise.all([
          allPhases.length > 0
            ? supabase.from('project_phases').insert(allPhases).then(r => ({ table: 'phases', count: allPhases.length, ...r }))
            : { table: 'phases', error: null, count: 0 },
          uniqueTeam.length > 0
            ? supabase.from('project_team').insert(uniqueTeam).then(r => ({ table: 'team', count: uniqueTeam.length, ...r }))
            : { table: 'team', error: null, count: 0 },
          allInvoices.length > 0
            ? supabase.from('project_invoices').insert(allInvoices).then(r => ({ table: 'invoices', count: allInvoices.length, ...r }))
            : { table: 'invoices', error: null, count: 0 },
          allNotes.length > 0
            ? supabase.from('project_notes').insert(allNotes).then(r => ({ table: 'notes', count: allNotes.length, ...r }))
            : { table: 'notes', error: null, count: 0 }
        ]);

        for (const r of insertResults) {
          if (r.error) {
            console.error(`Batch ${r.table} insert error (${r.count} rows):`, r.error);
            errors.push({ step: `${r.table}_insert`, error: r.error.message, count: r.count, code: r.error.code, details: r.error.details });
          }
        }
      }
    }
  } catch (e) {
    errors.push({ step: 'projects', error: e.message });
  }

  // === SAVE PROJECT TYPES ===
  try {
    if (data.projectTypes) {
      const typeRecords = Object.entries(data.projectTypes).map(([key, td]) => ({
        key,
        name: td.name,
        color: td.color,
        phases: td.phases
      }));
      if (typeRecords.length > 0) {
        const { error: typeErr } = await supabase.from('project_types').upsert(typeRecords, { onConflict: 'key' });
        if (typeErr) errors.push({ step: 'project_types', error: typeErr.message });
      }
    }
  } catch (e) {
    errors.push({ step: 'project_types', error: e.message });
  }

  if (errors.length > 0) {
    console.error('saveFullData completed with errors:', JSON.stringify(errors, null, 2));
  }

  // Only report success if there were no critical errors
  const hasCriticalError = errors.some(e =>
    e.step === 'projects' || e.step === 'projects_batch_upsert' ||
    e.step === 'team_members' || e.step === 'clients'
  );

  return {
    success: !hasCriticalError,
    errors: errors.length > 0 ? errors : undefined,
    projectErrors: projectErrors.length > 0 ? projectErrors : undefined,
    projectsSaved: data.projects ? data.projects.length - projectErrors.length : 0,
    projectsFailed: projectErrors.length,
    debugInfo: {
      teamCount: data.team?.length || 0,
      clientCount: data.clients?.length || 0,
      projectCount: data.projects?.length || 0,
      errorsCount: errors.length
    }
  };
}
