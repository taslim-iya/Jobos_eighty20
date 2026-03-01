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
    })
    .select()
    .single();
  return { data, error };
}
