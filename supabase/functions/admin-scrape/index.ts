import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TRACK_QUERIES: Record<string, string[]> = {
  ib: [
    "investment banking analyst",
    "M&A analyst summer analyst",
    "ECM DCM analyst leveraged finance",
  ],
  consulting: [
    "management consulting analyst",
    "strategy consulting associate",
    "business analyst consulting",
  ],
  product: [
    "associate product manager",
    "product manager",
    "growth product manager",
  ],
};

function cleanText(v: unknown): string {
  return String(v || "").replace(/\s+/g, " ").trim();
}

const MAX_JOBS_PER_GROUP = 80;
const EXCLUDED_DOMAINS = /(reddit\.com|quora\.com|medium\.com|youtube\.com|wikipedia\.org|facebook\.com|twitter\.com|instagram\.com)/i;

async function firecrawlSearch(apiKey: string, query: string) {
  const res = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, limit: 40 }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return [];
  return Array.isArray(data?.data) ? data.data : Array.isArray(data?.results) ? data.results : [];
}

function sourceFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("indeed")) return "Indeed";
  if (lower.includes("glassdoor")) return "Glassdoor";
  if (lower.includes("efinancialcareers")) return "eFinancialCareers";
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return "Web"; }
}

const EXPIRED = /(expired|closed|filled|position has been filled|no longer accepting)/i;

function isExpired(title: string, desc: string, deadline: string): boolean {
  const text = `${title} ${desc} ${deadline}`;
  if (EXPIRED.test(text)) return true;
  const d = Date.parse(deadline);
  if (Number.isNaN(d)) return false;
  const today = new Date(); today.setHours(0,0,0,0);
  return d < today.getTime();
}

// Reject results that aren't actual job listings
const NOT_A_JOB_TITLE = /\b(how to|what is|guide|tips|salary|blog|news|article|report|review|interview prep|would a|can i|should i|best way|top \d+|reddit|quora|\d+ things|education|training course)\b/i;
const NOT_A_JOB_URL = /\.(pdf|xls|xlsx|doc|docx|ppt|pptx)(\?|$)/i;
const NOT_A_JOB_DOMAIN = /(alumneye|argaamplus|s3\.amazonaws|blog\.|news\.|forum\.|wiki\.)/i;
const JOB_SIGNALS_TITLE = /(analyst|associate|intern|manager|director|officer|summer|graduate|junior|senior|specialist|coordinator|program|opening|vacancy|hire|career|position|job)/i;
const JOB_SIGNALS_DESC = /(apply|application|deadline|responsibilities|qualifications|requirements|salary|compensation|team|role|hiring|recruit|candidate|resume|cv|cover letter)/i;
const JOB_BOARD_DOMAINS = /(linkedin|indeed|glassdoor|efinancialcareers|workday|greenhouse|lever\.co|smartrecruiters|myworkdayjobs|brightnetwork|targetjobs|gradcracker|prospects\.ac|milkround|handshake)/i;

function isActualJobListing(title: string, desc: string, url: string): boolean {
  if (JOB_BOARD_DOMAINS.test(url)) return true;
  if (NOT_A_JOB_DOMAIN.test(url)) return false;
  if (NOT_A_JOB_URL.test(url)) return false;
  if (NOT_A_JOB_TITLE.test(title)) return false;
  if (!JOB_SIGNALS_TITLE.test(title) && !JOB_SIGNALS_DESC.test(desc)) return false;
  return true;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");

    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY not configured");

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Verify caller is admin (or service role for cron)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Unauthorized");
    const token = authHeader.replace("Bearer ", "");

    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      const userClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!, {
        global: { headers: { Authorization: authHeader } },
      });
      const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) throw new Error("Unauthorized");
      const callerId = claimsData.claims.sub as string;

      const { data: roleRow } = await admin.from("user_roles").select("role").eq("user_id", callerId).eq("role", "admin").maybeSingle();
      if (!roleRow) throw new Error("Admin access required");
    }

    // Fetch all profiles
    const { data: profiles } = await admin.from("profiles").select("user_id, target_track, experience_level, location");
    if (!profiles || profiles.length === 0) {
      return new Response(JSON.stringify({ message: "No profiles found", inserted: 0 }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch ALL user websites with their keywords and job titles
    const { data: allWebsites } = await admin.from("websites").select("user_id, url, label, keywords, job_titles");
    const websitesByUser = new Map<string, Array<{ url: string; label: string; keywords: string[]; job_titles: string[] }>>();
    for (const w of (allWebsites || [])) {
      if (!websitesByUser.has(w.user_id)) websitesByUser.set(w.user_id, []);
      websitesByUser.get(w.user_id)!.push({
        url: w.url,
        label: w.label || w.url,
        keywords: w.keywords || [],
        job_titles: w.job_titles || [],
      });
    }

    console.log(`Admin scrape started for ${profiles.length} profiles, ${(allWebsites || []).length} website configs`);

    let totalInserted = 0;
    const errors: string[] = [];

    // Group profiles by track+level+location
    const groups = new Map<string, { userIds: string[]; track: string; level: string; location: string }>();
    for (const p of profiles) {
      const track = p.target_track || "ib";
      const level = p.experience_level || "undergrad";
      const location = p.location || "London";
      const key = `${track}|${level}|${location}`;
      if (!groups.has(key)) {
        groups.set(key, { userIds: [], track, level, location });
      }
      groups.get(key)!.userIds.push(p.user_id);
    }

    for (const [key, group] of groups) {
      console.log(`Scraping for group: ${key} (${group.userIds.length} users)`);

      // Base queries from track config
      const baseQueries = (TRACK_QUERIES[group.track] || TRACK_QUERIES.ib).map(
        q => `${q} ${group.location} ${group.level === "undergrad" ? "intern graduate summer analyst" : "experienced associate"}`
      );

      // Always include LinkedIn-specific searches
      const linkedinQueries = (TRACK_QUERIES[group.track] || TRACK_QUERIES.ib).map(
        q => `site:linkedin.com/jobs ${q} ${group.location}`
      );

      // Collect custom queries from user websites in this group
      const customQueries: string[] = [];
      for (const userId of group.userIds) {
        const userSites = websitesByUser.get(userId) || [];
        for (const site of userSites) {
          // Build search queries from job titles + keywords scoped to this site
          const titles = site.job_titles || [];
          const kw = site.keywords || [];
          if (titles.length > 0 || kw.length > 0) {
            const titleStr = titles.join(" OR ");
            const kwStr = kw.join(" ");
            // Search within the specific site domain
            const siteDomain = site.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
            customQueries.push(`site:${siteDomain} ${titleStr} ${kwStr} ${group.location}`);
          } else {
            // If no custom keywords, search the site with track defaults
            const siteDomain = site.url.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
            const trackDefault = (TRACK_QUERIES[group.track] || TRACK_QUERIES.ib)[0];
            customQueries.push(`site:${siteDomain} ${trackDefault} ${group.location}`);
          }
        }
      }

      // Deduplicate queries
      const allQueries = [...new Set([...baseQueries, ...linkedinQueries, ...customQueries])];
      console.log(`Running ${allQueries.length} search queries for group ${key}`);

      const allResults = await Promise.allSettled(allQueries.map(q => firecrawlSearch(FIRECRAWL_API_KEY, q)));

      const jobs: Array<{ title: string; firm: string; url: string; description: string; source: string; deadline: string; location: string; track: string; level: string }> = [];
      const seenUrls = new Set<string>();

      for (const result of allResults) {
        if (result.status !== "fulfilled") continue;
        for (const row of result.value) {
          const url = cleanText(row.url);
          if (!url || seenUrls.has(url.toLowerCase()) || EXCLUDED_DOMAINS.test(url)) continue;
          seenUrls.add(url.toLowerCase());

          const title = cleanText(row.title || "Job Opening");
          const description = cleanText(row.description || "Live opening from web crawl");
          if (isExpired(title, description, "")) continue;
          if (!isActualJobListing(title, description, url)) continue;

          let firm = "Company";
          try { firm = new URL(url).hostname.replace(/^www\./, "").split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, c => c.toUpperCase()); } catch {}

          jobs.push({
            title,
            firm,
            url,
            description: description.slice(0, 500),
            source: sourceFromUrl(url),
            deadline: "Rolling",
            location: group.location,
            track: group.track,
            level: group.level,
          });

          if (jobs.length >= MAX_JOBS_PER_GROUP) break;
        }
        if (jobs.length >= MAX_JOBS_PER_GROUP) break;
      }

      const curatedJobs = jobs.slice(0, MAX_JOBS_PER_GROUP);
      console.log(`Found ${curatedJobs.length} unique jobs for group ${key}`);

      // Insert jobs for each user in this group
      for (const userId of group.userIds) {
        const { data: existingJobs } = await admin.from("jobs").select("title, firm").eq("user_id", userId);
        const existingKeys = new Set((existingJobs || []).map(j => `${j.title}|${j.firm}`.toLowerCase()));

        const newJobs = curatedJobs.filter(j => !existingKeys.has(`${j.title}|${j.firm}`.toLowerCase()));

        if (newJobs.length === 0) continue;

        const inserts = newJobs.map(j => ({
          user_id: userId,
          title: j.title,
          firm: j.firm,
          stage: "saved",
          deadline: j.deadline,
          match_score: 80,
          tags: j.track === "ib" ? ["IB"] : j.track === "consulting" ? ["Consulting"] : ["Product"],
          track: j.track,
          experience_level: j.level,
          location: j.location,
          description: j.description,
          source: j.source,
          url: j.url,
        }));

        const { error: insertErr } = await admin.from("jobs").insert(inserts);
        if (insertErr) {
          errors.push(`User ${userId}: ${insertErr.message}`);
        } else {
          totalInserted += inserts.length;
        }
      }
    }

    console.log(`Admin scrape complete. Inserted ${totalInserted} jobs total.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        inserted: totalInserted, 
        profiles: profiles.length,
        websites: (allWebsites || []).length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-scrape error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: error instanceof Error && msg.includes("Unauthorized") ? 403 : 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
