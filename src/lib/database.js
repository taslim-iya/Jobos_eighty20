import { supabase } from "@/integrations/supabase/client";

// ─── JOBS ───
export async function fetchJobs(userId) {
  const { data, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function upsertJob(userId, job) {
  // If job has a UUID id, update; otherwise insert
  if (job.id && typeof job.id === "string" && job.id.includes("-")) {
    const { data, error } = await supabase
      .from("jobs")
      .update({
        title: job.title,
        firm: job.firm,
        stage: job.stage,
        deadline: job.deadline,
        match_score: job.match || job.match_score || 0,
        tags: job.tags || [],
        track: job.track,
        experience_level: job.level || job.experience_level,
        location: job.location,
        description: job.description,
        source: job.source,
        url: job.url,
      })
      .eq("id", job.id)
      .eq("user_id", userId)
      .select()
      .single();
    return { data, error };
  }

  const { data, error } = await supabase
    .from("jobs")
    .insert({
      user_id: userId,
      title: job.title,
      firm: job.firm,
      stage: job.stage || "saved",
      deadline: job.deadline,
      match_score: job.match || job.match_score || 0,
      tags: job.tags || [],
      track: job.track,
      experience_level: job.level || job.experience_level,
      location: job.location,
      description: job.description,
      source: job.source,
      url: job.url,
    })
    .select()
    .single();
  return { data, error };
}

export async function deleteJob(userId, jobId) {
  return supabase.from("jobs").delete().eq("id", jobId).eq("user_id", userId);
}

// ─── CONTACTS ───
export async function fetchContacts(userId) {
  const { data, error } = await supabase
    .from("contacts")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function upsertContact(userId, contact) {
  if (contact.id && typeof contact.id === "string" && contact.id.includes("-")) {
    const { data, error } = await supabase
      .from("contacts")
      .update({
        name: contact.name,
        firm: contact.firm,
        role: contact.role,
        channel: contact.channel || contact.ch,
        status: contact.status,
        sequence_step: contact.sequence_step || contact.seq,
        last_contact_date: contact.last_contact_date || contact.date,
        notes: contact.notes,
      })
      .eq("id", contact.id)
      .eq("user_id", userId)
      .select()
      .single();
    return { data, error };
  }

  const { data, error } = await supabase
    .from("contacts")
    .insert({
      user_id: userId,
      name: contact.name,
      firm: contact.firm,
      role: contact.role,
      channel: contact.channel || contact.ch || "Email",
      status: contact.status || "pending",
      sequence_step: contact.sequence_step || contact.seq,
      last_contact_date: contact.last_contact_date || contact.date,
      notes: contact.notes,
    })
    .select()
    .single();
  return { data, error };
}

// ─── WEBSITES ───
export async function fetchWebsites(userId) {
  const { data, error } = await supabase
    .from("websites")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return { data: data || [], error };
}

export async function upsertWebsite(userId, site) {
  if (site.id && typeof site.id === "string" && site.id.includes("-")) {
    const { data, error } = await supabase
      .from("websites")
      .update({
        url: site.url,
        label: site.label,
        frequency: site.frequency || site.freq,
        last_scanned: site.last_scanned || site.lastScanned,
        jobs_found: site.jobs_found || site.jobsFound || 0,
        status: site.status,
        keywords: site.keywords,
        job_titles: site.job_titles,
      })
      .eq("id", site.id)
      .eq("user_id", userId)
      .select()
      .single();
    return { data, error };
  }

  const { data, error } = await supabase
    .from("websites")
    .insert({
      user_id: userId,
      url: site.url,
      label: site.label || site.url,
      frequency: site.frequency || site.freq || "daily",
      last_scanned: site.last_scanned || site.lastScanned || "Never",
      jobs_found: site.jobs_found || site.jobsFound || 0,
      status: site.status || "idle",
      keywords: site.keywords || [],
      job_titles: site.job_titles || [],
    })
    .select()
    .single();
  return { data, error };
}

export async function deleteWebsite(userId, siteId) {
  return supabase.from("websites").delete().eq("id", siteId).eq("user_id", userId);
}

// ─── DOCUMENTS ───
export async function fetchDocuments(userId) {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("user_id", userId)
    .order("uploaded_at", { ascending: false });
  return { data: data || [], error };
}

export async function upsertDocument(userId, doc) {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      user_id: userId,
      filename: doc.filename || doc.name,
      file_type: doc.file_type || doc.type,
      doc_category: doc.doc_category || doc.category || "Other",
      ai_status: doc.ai_status || "pending",
      entities_count: doc.entities_count || 0,
      file_path: doc.file_path || null,
      file_size: doc.file_size || null,
    })
    .select()
    .single();
  return { data, error };
}

export async function deleteDocument(userId, docId) {
  return supabase.from("documents").delete().eq("id", docId).eq("user_id", userId);
}

// ─── FILE UPLOAD ───
export async function uploadFile(userId, file) {
  const fileExt = file.name.split('.').pop();
  const filePath = `${userId}/${Date.now()}.${fileExt}`;
  
  const { data, error } = await supabase.storage
    .from("documents")
    .upload(filePath, file);
  
  if (error) return { data: null, error };
  
  return { data: { path: filePath, fullPath: data.path }, error: null };
}

export async function deleteFile(filePath) {
  return supabase.storage.from("documents").remove([filePath]);
}

// ─── EXPORT HELPERS ───
export function exportToCSV(data, filename) {
  if (!data || data.length === 0) return;
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => headers.map(h => {
      const val = row[h];
      if (val === null || val === undefined) return '';
      const str = String(val);
      return str.includes(',') || str.includes('"') || str.includes('\n') 
        ? `"${str.replace(/"/g, '""')}"` : str;
    }).join(','))
  ].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.csv`;
  link.click();
  URL.revokeObjectURL(link.href);
}

export function exportToText(text, filename) {
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().slice(0,10)}.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}
