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

    // Allow service role key (used by cron) to bypass admin check
    const isServiceRole = token === SUPABASE_SERVICE_ROLE_KEY;

    if (!isServiceRole) {
      // Create a client scoped to the caller's token
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

    console.log(`Admin scrape started for ${profiles.length} profiles`);

    let totalInserted = 0;
    const errors: string[] = [];

    // Group profiles by track+level+location to avoid duplicate searches
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

      const queries = (TRACK_QUERIES[group.track] || TRACK_QUERIES.ib).map(
        q => `${q} ${group.location} ${group.level === "undergrad" ? "intern graduate summer analyst" : "experienced associate"}`
      );

      const allResults = await Promise.allSettled(queries.map(q => firecrawlSearch(FIRECRAWL_API_KEY, q)));

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
