import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  // Optionally verify admin
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (!userErr && user?.id) {
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .maybeSingle();
      if (!roleData) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }
  }

  const body = await req.json().catch(() => ({}));
  const { source_id, paste_url } = body;

  try {
    // ─── MODE 1: Parse a single pasted URL ───
    if (paste_url) {
      const job = await parseSingleUrl(paste_url, firecrawlKey);
      return new Response(JSON.stringify({ success: true, job }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── MODE 2: Run crawl for specific source or all enabled sources ───
    let sources: any[] = [];
    if (source_id) {
      const { data } = await supabase.from("sources").select("*").eq("id", source_id).single();
      if (data) sources = [data];
    } else {
      const { data } = await supabase.from("sources").select("*").eq("enabled", true);
      sources = data || [];
    }

    if (sources.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No enabled sources", jobs_inserted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalInserted = 0;
    let totalMatches = 0;

    for (const source of sources) {
      // Create crawl run
      const { data: run } = await supabase
        .from("crawl_runs")
        .insert({ source_id: source.id, status: "running" })
        .select()
        .single();

      try {
        const pages = await crawlSource(source, firecrawlKey);

        // Save raw pages
        for (const page of pages) {
          const hash = await hashText(page.url + (page.markdown || "").slice(0, 500));
          await supabase.from("raw_pages").upsert(
            { source_id: source.id, url: page.url, html_text: page.markdown || page.html, hash },
            { onConflict: "id" }
          );
        }

        // Extract jobs from pages using AI
        const extractedJobs = await extractJobsFromPages(pages, source);

        // Dedupe and insert jobs
        let inserted = 0;
        for (const job of extractedJobs) {
          const hash = await hashText(job.source_job_url || job.title + job.company);
          const { error } = await supabase.from("jobs").insert({
            user_id: "00000000-0000-0000-0000-000000000000", // system placeholder
            source_id: source.id,
            source_job_url: job.source_job_url,
            title: job.title,
            firm: job.company,
            location: job.location || null,
            remote_flag: job.remote_flag || false,
            description: job.description || null,
            experience_level: job.seniority || null,
            track: job.track || null,
            apply_url: job.apply_url || job.source_job_url,
            url: job.apply_url || job.source_job_url,
            posted_at: job.posted_at || null,
            deadline: job.deadline || null,
            tags: job.tags || [],
            extracted_json: job.extracted_json || null,
            hash,
            stage: "saved",
            match_score: 0,
          });
          if (!error) inserted++;
        }
        totalInserted += inserted;

        // Update crawl run
        await supabase.from("crawl_runs").update({
          status: "completed",
          ended_at: new Date().toISOString(),
          pages_crawled: pages.length,
        }).eq("id", run.id);

      } catch (err) {
        await supabase.from("crawl_runs").update({
          status: "failed",
          ended_at: new Date().toISOString(),
          errors: [err.message || "Unknown error"],
        }).eq("id", run?.id);
      }
    }

    // ─── Run matching against all profiles ───
    totalMatches = await runMatching(supabase);

    return new Response(
      JSON.stringify({ success: true, jobs_inserted: totalInserted, matches_created: totalMatches, sources_crawled: sources.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Crawl error:", err);
    return new Response(JSON.stringify({ error: err.message || "Crawl failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── CRAWL SOURCE ───
async function crawlSource(source: any, firecrawlKey: string | undefined): Promise<any[]> {
  if (!firecrawlKey) {
    console.warn("No FIRECRAWL_API_KEY, skipping crawl for:", source.name);
    return [];
  }

  const endpoint = source.crawl_type === "single"
    ? "https://api.firecrawl.dev/v1/scrape"
    : source.crawl_type === "sitemap"
    ? "https://api.firecrawl.dev/v1/map"
    : "https://api.firecrawl.dev/v1/crawl";

  if (source.crawl_type === "single") {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: source.base_url, formats: ["markdown"], onlyMainContent: true }),
    });
    const data = await resp.json();
    if (data?.data) return [{ url: source.base_url, markdown: data.data.markdown }];
    return [];
  }

  if (source.crawl_type === "sitemap") {
    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: source.base_url, limit: 60 }),
    });
    const mapJson = await resp.json();

    const baseHost = new URL(source.base_url).hostname.replace(/^www\./, "");

    const filterAllowlist = (u: string) => {
      if (source.allowlist_paths?.length > 0) {
        return source.allowlist_paths.some((p: string) => u.includes(p));
      }
      return true;
    };

    // Firecrawl map sometimes misses JS-rendered links; fall back to scraping links from the page.
    const mapLinks = (mapJson?.links || mapJson?.data?.links || [])
      .filter((u: string) => {
        try {
          return new URL(u).hostname.replace(/^www\./, "") === baseHost;
        } catch {
          return false;
        }
      })
      .filter(filterAllowlist);

    let links: string[] = mapLinks;

    if (links.length < 5) {
      const scrapeResp = await fetch("https://api.firecrawl.dev/v1/scrape", {
        method: "POST",
        headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          url: source.base_url,
          formats: ["links"],
          onlyMainContent: false,
          waitFor: 12000,
        }),
      });
      const scrapeJson = await scrapeResp.json();
      const scrapeLinks = (scrapeJson?.data?.links || scrapeJson?.links || []) as string[];
      links = scrapeLinks
        .filter((u) => {
          try {
            return new URL(u).hostname.replace(/^www\./, "") === baseHost;
          } catch {
            return false;
          }
        })
        .filter(filterAllowlist);
    }

    // Prioritize likely job/programme pages first, then take a bounded sample.
    // (Trackr-style pages often surface opportunities via /programme/* and /company/* routes.)
    const prioritized = links
      .filter((u: string) => /\/programme\/|\/company\/|internship|graduate|summer/i.test(u))
      .concat(links)
      .filter((u: string, i: number, arr: string[]) => arr.indexOf(u) === i)
      .slice(0, 20);

    const scrapeOne = async (url: string) => {
      try {
        const r = await fetch("https://api.firecrawl.dev/v1/scrape", {
          method: "POST",
          headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            formats: ["markdown"],
            onlyMainContent: true,
            // allow dynamic apps a moment to populate content
            waitFor: 8000,
          }),
        });
        const d = await r.json();
        if (d?.data?.markdown) return { url, markdown: d.data.markdown };
      } catch {
        // skip failed pages
      }
      return null;
    };

    // Scrape in bounded batches to keep the edge runtime reliable
    const pages: any[] = [];
    for (let i = 0; i < prioritized.length; i += 4) {
      const batch = prioritized.slice(i, i + 4);
      const settled = await Promise.allSettled(batch.map(scrapeOne));
      pages.push(
        ...settled
          .filter((s): s is PromiseFulfilledResult<any> => s.status === "fulfilled" && !!s.value)
          .map((s) => s.value),
      );
    }

    return pages;
  }

  // Default: crawl
  const resp = await fetch(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: source.base_url,
      limit: 5,
      maxDepth: 1,
      includePaths: source.allowlist_paths?.length > 0 ? source.allowlist_paths : undefined,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  const data = await resp.json();
  return (data?.data || []).map((p: any) => ({ url: p.metadata?.sourceURL || source.base_url, markdown: p.markdown }));
}

// ─── PARSE SINGLE URL (paste fallback) ───
async function parseSingleUrl(url: string, firecrawlKey: string | undefined): Promise<any> {
  if (!firecrawlKey) return { title: "Unknown", company: "Unknown", source_job_url: url };

  const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ url, formats: ["markdown"], onlyMainContent: true }),
  });
  const data = await resp.json();
  const markdown = data?.data?.markdown || "";
  const title = data?.data?.metadata?.title || "Unknown Role";

  // Simple extraction from markdown
  return {
    title: title.split("|")[0].split("-")[0].trim().slice(0, 120),
    company: data?.data?.metadata?.ogSiteName || new URL(url).hostname.replace("www.", ""),
    description: markdown.slice(0, 2000),
    source_job_url: url,
    apply_url: url,
    tags: [],
    seniority: null,
    track: null,
    location: null,
  };
}

// ─── EXTRACT JOBS FROM PAGES ───
async function extractJobsFromPages(pages: any[], source: any): Promise<any[]> {
  const jobs: any[] = [];

  for (const page of pages) {
    if (!page.markdown || page.markdown.length < 100) continue;

    // Check for job listing signals
    const text = page.markdown.toLowerCase();
    const urlHint = /\/programme\/|\/company\//i.test(page.url);
    const isJobPage = urlHint || /apply|application|position|vacancy|career|hiring|job description|responsibilities|qualifications|requirements/i.test(text);

    // Simple extraction without AI to keep it fast
    const titleMatch = page.markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : page.markdown.split("\n")[0]?.trim().slice(0, 120) || "Unknown Role";

    jobs.push({
      title,
      company: source.name,
      description: page.markdown.slice(0, 3000),
      source_job_url: page.url,
      apply_url: page.url,
      location: null,
      remote_flag: /remote|hybrid|work from home/i.test(text),
      seniority: /intern|graduate|entry.level|summer.analyst/i.test(text) ? "undergrad" : /senior|director|vp|manager|associate/i.test(text) ? "experienced" : null,
      track: /investment.bank|m&a|ecm|dcm/i.test(text) ? "ib" : /consult|strategy|advisory/i.test(text) ? "consulting" : /product.manag|apm/i.test(text) ? "product" : null,
      tags: [],
      posted_at: null,
      deadline: null,
      extracted_json: { source_url: page.url, extracted_at: new Date().toISOString() },
    });
  }

  return jobs;
}

// ─── MATCHING ENGINE ───
async function runMatching(supabase: any): Promise<number> {
  // Get match config
  const { data: ruleData } = await supabase
    .from("admin_rules")
    .select("json_rules")
    .eq("name", "match_config")
    .eq("active", true)
    .maybeSingle();

  const config = ruleData?.json_rules || { threshold: 50, weights: { skills: 30, location: 20, seniority: 20, track: 20, exclude_keywords: 10 } };
  const threshold = config.threshold || 50;
  const weights = config.weights || {};
  const seniorityMap = config.seniority_mappings || {};

  // Get all profiles
  const { data: profiles } = await supabase.from("profiles").select("*");
  if (!profiles?.length) return 0;

  // Get recent jobs (last 7 days) that haven't been matched yet
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("*")
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(60);

  if (!recentJobs?.length) return 0;

  let matchCount = 0;

  for (const profile of profiles) {
    for (const job of recentJobs) {
      // Skip if match already exists
      const { data: existing } = await supabase
        .from("profile_job_matches")
        .select("id")
        .eq("profile_id", profile.id)
        .eq("job_id", job.id)
        .maybeSingle();
      if (existing) continue;

      const { score, reasons } = scoreMatch(profile, job, weights, seniorityMap);

      if (score >= threshold) {
        const { error } = await supabase.from("profile_job_matches").insert({
          profile_id: profile.id,
          job_id: job.id,
          match_score: score,
          match_reasons: reasons,
          status: "new",
        });
        if (!error) matchCount++;
      }
    }
  }

  return matchCount;
}

function scoreMatch(profile: any, job: any, weights: any, seniorityMap: any): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const desc = ((job.description || "") + " " + (job.title || "") + " " + (job.firm || "")).toLowerCase();

  // Skills overlap
  const profileSkills = (profile.skills || []).map((s: string) => s.toLowerCase());
  if (profileSkills.length > 0) {
    const matched = profileSkills.filter((s: string) => desc.includes(s));
    const pct = matched.length / profileSkills.length;
    const pts = Math.round(pct * (weights.skills || 30));
    score += pts;
    if (matched.length > 0) reasons.push(`Skills match: ${matched.join(", ")} (${pts}pts)`);
  } else {
    score += Math.round((weights.skills || 30) * 0.5); // Neutral if no skills set
  }

  // Location match
  const profileLocations = (profile.locations || []).map((l: string) => l.toLowerCase());
  const jobLoc = (job.location || "").toLowerCase();
  if (profileLocations.length > 0 && jobLoc) {
    if (profileLocations.some((l: string) => jobLoc.includes(l) || l.includes(jobLoc))) {
      score += weights.location || 20;
      reasons.push(`Location match: ${job.location} (${weights.location || 20}pts)`);
    }
  } else {
    score += Math.round((weights.location || 20) * 0.5);
  }

  // Seniority match
  const profileLevel = (profile.experience_level || "").toLowerCase();
  const jobLevel = (job.experience_level || "").toLowerCase();
  const levelKeywords = seniorityMap[profileLevel] || [];
  if (profileLevel && (jobLevel === profileLevel || levelKeywords.some((k: string) => desc.includes(k)))) {
    score += weights.seniority || 20;
    reasons.push(`Seniority match: ${profileLevel} (${weights.seniority || 20}pts)`);
  } else if (!profileLevel) {
    score += Math.round((weights.seniority || 20) * 0.5);
  }

  // Track match
  const profileTrack = (profile.target_track || "").toLowerCase();
  const jobTrack = (job.track || "").toLowerCase();
  if (profileTrack && (jobTrack === profileTrack || desc.includes(profileTrack))) {
    score += weights.track || 20;
    reasons.push(`Track match: ${profileTrack} (${weights.track || 20}pts)`);
  } else if (!profileTrack) {
    score += Math.round((weights.track || 20) * 0.5);
  }

  // Exclude keywords penalty
  const excludeKeys = (profile.keywords_exclude || []).map((k: string) => k.toLowerCase());
  const excluded = excludeKeys.filter((k: string) => desc.includes(k));
  if (excluded.length > 0) {
    score -= weights.exclude_keywords || 10;
    reasons.push(`Exclude keywords found: ${excluded.join(", ")} (-${weights.exclude_keywords || 10}pts)`);
  }

  // Company blacklist
  const blacklist = (profile.company_blacklist || []).map((c: string) => c.toLowerCase());
  if (blacklist.some((c: string) => (job.firm || "").toLowerCase().includes(c))) {
    score = 0;
    reasons.push("Company blacklisted (0pts)");
  }

  return { score: Math.max(0, Math.min(100, score)), reasons };
}

async function hashText(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}
