const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type JobResult = {
  title: string;
  firm: string;
  location: string;
  deadline: string;
  description: string;
  source: string;
  url: string;
  match: number;
  tags: string[];
};

const EXPIRED_KEYWORDS = /(expired|closed|filled|position has been filled|no longer accepting|applications closed)/i;
const JOB_LINK_KEYWORDS = /(job|jobs|career|careers|opportunit|program|opening|vacanc|requisition|apply)/i;
const EXCLUDED_LINK_KEYWORDS = /(privacy|cookie|terms|about|news|investor|press|contact|faq|help|sitemap)/i;

function cleanText(value: unknown): string {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function parseDateFromText(text: string): Date | null {
  const input = cleanText(text);
  if (!input) return null;

  const direct = Date.parse(input);
  if (!Number.isNaN(direct)) return new Date(direct);

  const regexes = [
    /\b(\d{1,2}[\/\-.]\d{1,2}[\/\-.]\d{2,4})\b/,
    /\b(\d{4}[\/\-.]\d{1,2}[\/\-.]\d{1,2})\b/,
    /\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i,
  ];

  for (const re of regexes) {
    const match = input.match(re);
    if (!match?.[0]) continue;
    const parsed = Date.parse(match[0]);
    if (!Number.isNaN(parsed)) return new Date(parsed);
  }

  return null;
}

function isExpired(item: { title?: string; description?: string; deadline?: string; url?: string }): boolean {
  const fullText = cleanText(`${item.title || ""} ${item.description || ""} ${item.deadline || ""}`);
  if (EXPIRED_KEYWORDS.test(fullText)) return true;

  const date = parseDateFromText(item.deadline || fullText);
  if (!date) return false;

  date.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return date.getTime() < today.getTime();
}

function inferTrackTags(track: string): string[] {
  if (track === "consulting") return ["Consulting"];
  if (track === "product") return ["Product"];
  return ["IB"];
}

function sourceFromUrl(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("linkedin")) return "LinkedIn";
  if (lower.includes("indeed")) return "Indeed";
  if (lower.includes("uktrackr")) return "UK Trackr";
  if (lower.includes("efinancialcareers")) return "eFinancialCareers";
  if (lower.includes("glassdoor")) return "Glassdoor";

  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host;
  } catch {
    return "Web";
  }
}

function titleFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const slug = pathname.split("/").filter(Boolean).at(-1) || "job opening";
    return slug.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Job Opening";
  }
}

function firmFromUrl(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const base = host.split(".")[0] || "Company";
    return base.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "Company";
  }
}

function normalizeJob(
  raw: Partial<JobResult> & { title?: string; name?: string; snippet?: string },
  track: string,
  fallbackLocation: string,
): JobResult | null {
  const url = cleanText(raw.url);
  if (!url) return null;

  const title = cleanText(raw.title || raw.name || titleFromUrl(url));
  const description = cleanText(raw.description || raw.snippet || "Live opening discovered from web crawl");
  const firm = cleanText(raw.firm || firmFromUrl(url));
  const location = cleanText(raw.location || fallbackLocation || "Unknown");
  const deadline = cleanText(raw.deadline || "Rolling");

  const job: JobResult = {
    title,
    firm,
    location,
    deadline,
    description,
    source: cleanText(raw.source || sourceFromUrl(url)),
    url,
    match: typeof raw.match === "number" ? raw.match : 82,
    tags: Array.isArray(raw.tags) && raw.tags.length ? raw.tags : inferTrackTags(track),
  };

  if (isExpired(job)) return null;
  return job;
}

function dedupeByUrl(jobs: JobResult[]): JobResult[] {
  const seen = new Set<string>();
  return jobs.filter((job) => {
    const key = job.url.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function firecrawlRequest(apiKey: string, path: string, payload: Record<string, unknown>) {
  const response = await fetch(`https://api.firecrawl.dev/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(`Firecrawl ${path} failed [${response.status}]: ${JSON.stringify(data)}`);
  }

  return data;
}

function buildQueries({ query, track, level, location }: { query: string; track: string; level: string; location: string }) {
  const trackQueries: Record<string, string[]> = {
    ib: [
      "investment banking analyst",
      "M&A analyst",
      "ECM DCM analyst",
      "leveraged finance analyst",
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

  const levelHint = level === "undergrad"
    ? "intern OR graduate OR summer OR analyst"
    : level
      ? "experienced OR associate OR manager"
      : "";

  const sourceHints = ["LinkedIn", "Indeed", "UK Trackr", "eFinancialCareers"];

  const base = cleanText(query);
  const expanded = (trackQueries[track] || trackQueries.ib).map((q) => cleanText(`${q} ${location} ${levelHint}`));

  if (base) {
    return [...expanded, ...sourceHints.map((s) => `${base} ${location} ${s}`)];
  }

  return [...expanded, ...sourceHints.map((s) => `${expanded[0]} ${s}`)];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is not configured");
    }

    const body = await req.json().catch(() => ({}));
    const query = cleanText(body.query);
    const track = cleanText(body.track || "ib").toLowerCase();
    const level = cleanText(body.level).toLowerCase();
    const location = cleanText(body.location || "London");
    const siteUrl = cleanText(body.siteUrl);

    const queries = buildQueries({ query, track, level, location });

    const searchResponses = await Promise.allSettled(
      queries.map((q) =>
        firecrawlRequest(FIRECRAWL_API_KEY, "/search", {
          query: q,
          limit: 100,
          scrapeOptions: {
            formats: ["markdown"],
          },
        })
      )
    );

    const jobs: JobResult[] = [];

    for (const result of searchResponses) {
      if (result.status !== "fulfilled") continue;
      const rows = result.value?.data || result.value?.results || [];
      if (!Array.isArray(rows)) continue;

      for (const row of rows) {
        const normalized = normalizeJob(
          {
            title: row.title,
            description: row.description,
            url: row.url,
            source: sourceFromUrl(row.url || ""),
            location,
          },
          track,
          location,
        );
        if (normalized) jobs.push(normalized);
      }
    }

    if (siteUrl) {
      const mapResult = await firecrawlRequest(FIRECRAWL_API_KEY, "/map", {
        url: siteUrl,
        search: "jobs careers opportunities programs",
        includeSubdomains: true,
        limit: 5000,
      });

      const links = mapResult?.links || mapResult?.data?.links || [];
      if (Array.isArray(links)) {
        for (const link of links) {
          const url = cleanText(link);
          if (!url) continue;
          if (!JOB_LINK_KEYWORDS.test(url) || EXCLUDED_LINK_KEYWORDS.test(url)) continue;

          const normalized = normalizeJob(
            {
              title: titleFromUrl(url),
              description: `Role page discovered while crawling ${siteUrl}`,
              url,
              source: sourceFromUrl(url),
              location,
            },
            track,
            location,
          );
          if (normalized) jobs.push(normalized);
        }
      }
    }

    const liveJobs = dedupeByUrl(jobs).filter((job) => !isExpired(job));

    return new Response(
      JSON.stringify({ jobs: liveJobs, total: liveJobs.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown crawler error";
    console.error("job-crawl-search error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
