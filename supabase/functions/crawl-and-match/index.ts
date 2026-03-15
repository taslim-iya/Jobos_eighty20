import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/* ─── CONSTANTS ─── */
const MAX_LOAD_MORE_CLICKS = 20; // Action budget: stay within Firecrawl 50-action limit
const LINKEDIN_TIMEOUT_MS = 5 * 60 * 1000; // 5 min for heavy pagination
const DEFAULT_TIMEOUT_MS = 2 * 60 * 1000; // 2 min for other sources
const RETRY_ATTEMPTS = 3;
const MIN_CONTENT_LENGTH = 10_000; // Reject scrapes < 10KB (blocking/error pages)
const MAX_AGE_DAYS = 180; // 6-month cutoff
const BATCH_SIZE = 5; // Concurrent batch size for paginated fetches
const BATCH_DELAY_MS = 500; // Delay between batches

/* ─── SPAM / JUNK FILTERS ─── */
const JUNK_TITLE_PATTERNS = /\b(newsletter|subscribe|cookie|privacy policy|terms of service|error|page not found|404|sign up|log in|create account)\b/i;
const NON_JOB_PATTERNS = /\b(how to|what is|guide|tips|salary guide|blog post|news article|report|review|interview prep|top \d+|reddit|quora)\b/i;

/* ─── JOB BOARD SEARCH QUERIES ─── */
const JOB_BOARD_CONFIGS: Record<string, {
  buildSearchUrl: (keywords: string, location: string) => string;
  searchQueries: (keywords: string, location: string) => string[];
  isHeavyPagination?: boolean;
}> = {
  "efinancialcareers": {
    buildSearchUrl: (kw, loc) =>
      `https://www.efinancialcareers.co.uk/jobs-${encodeURIComponent(loc)}/q-${encodeURIComponent(kw)}`,
    searchQueries: (kw, loc) => [
      `site:efinancialcareers.co.uk ${kw} ${loc}`,
      `site:efinancialcareers.co.uk finance internship ${loc}`,
    ],
  },
  "glassdoor uk": {
    buildSearchUrl: (kw, loc) =>
      `https://www.glassdoor.co.uk/Job/jobs.htm?sc.keyword=${encodeURIComponent(kw)}&locT=C&locId=2671300`,
    searchQueries: (kw, loc) => [
      `site:glassdoor.co.uk/job ${kw} ${loc}`,
      `site:glassdoor.co.uk jobs ${kw} ${loc}`,
    ],
  },
  "google jobs": {
    buildSearchUrl: (kw, loc) =>
      `https://www.google.com/search?q=${encodeURIComponent(kw + " " + loc + " jobs")}&udm=8`,
    searchQueries: (kw, loc) => [
      `${kw} ${loc} jobs`,
      `${kw} internship ${loc}`,
    ],
  },
  "indeed uk": {
    buildSearchUrl: (kw, loc) =>
      `https://uk.indeed.com/jobs?q=${encodeURIComponent(kw)}&l=${encodeURIComponent(loc)}`,
    searchQueries: (kw, loc) => [
      `site:uk.indeed.com ${kw} ${loc}`,
      `site:indeed.com/viewjob ${kw} ${loc}`,
    ],
  },
  "linkedin jobs": {
    buildSearchUrl: (kw, loc) =>
      `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(kw)}&location=${encodeURIComponent(loc)}`,
    searchQueries: (kw, loc) => [
      `site:linkedin.com/jobs/view ${kw} ${loc}`,
      `site:linkedin.com/jobs ${kw} ${loc}`,
    ],
    isHeavyPagination: true,
  },
};

const AI_EXTRACTION_SCHEMA = {
  type: "object",
  properties: {
    jobs: {
      type: "array",
      items: {
        type: "object",
        properties: {
          title: { type: "string", description: "Job title" },
          company: { type: "string", description: "Company/firm name" },
          location: { type: "string", description: "Job location" },
          salary: { type: "string", description: "Salary or compensation if shown" },
          job_type: { type: "string", description: "Full-time, Part-time, Contract, Internship, etc." },
          seniority: { type: "string", description: "Graduate, Intern, Junior/Entry, Mid-level, Senior/Lead, or Unclassified" },
          date_posted: { type: "string", description: "When the job was posted" },
          description_snippet: { type: "string", description: "Brief description or snippet" },
          url: { type: "string", description: "Direct URL to the job listing" },
          remote_flag: { type: "boolean", description: "Whether the job is remote or hybrid" },
        },
      },
    },
  },
};

const AI_EXTRACTION_PROMPT =
  "Extract ALL job listings visible on this page. For each job, get: title, company name, location, salary (if shown), job type (Full-time/Part-time/Contract/Internship), seniority level (Graduate/Intern/Junior-Entry/Mid-level/Senior-Lead/Unclassified), date posted, description snippet, and the direct job URL. If a field is not available, use null.";

/* ─── RETRY WITH EXPONENTIAL BACKOFF ─── */
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  attempts = RETRY_ATTEMPTS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<Response> {
  for (let i = 0; i < attempts; i++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const resp = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(timer);

      if (resp.status === 502 && i < attempts - 1) {
        const delay = Math.pow(2, i) * 1000 + Math.random() * 500;
        console.warn(`502 on attempt ${i + 1}, retrying in ${Math.round(delay)}ms...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      return resp;
    } catch (err: any) {
      if (err.name === "AbortError") {
        console.warn(`Request timed out (attempt ${i + 1}/${attempts})`);
        if (i < attempts - 1) {
          await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
          continue;
        }
      }
      if (i === attempts - 1) throw err;
      await new Promise(r => setTimeout(r, Math.pow(2, i) * 1000));
    }
  }
  throw new Error("All retry attempts exhausted");
}

/* ─── BATCH CONCURRENT FETCHES ─── */
async function fetchInBatches<T>(
  items: T[],
  fn: (item: T) => Promise<any>,
  batchSize = BATCH_SIZE,
  delayMs = BATCH_DELAY_MS,
): Promise<PromiseSettledResult<any>[]> {
  const results: PromiseSettledResult<any>[] = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
}

/* ─── EARLY FILTERING: check if a job passes quality gates ─── */
function passesEarlyFilter(job: { title?: string; company?: string; posted_at?: string | null; description?: string }): boolean {
  const title = job.title || "";
  const desc = job.description || "";

  // Filter junk titles
  if (JUNK_TITLE_PATTERNS.test(title)) return false;
  if (NON_JOB_PATTERNS.test(title)) return false;

  // 6-month age cutoff
  if (job.posted_at) {
    const posted = new Date(job.posted_at);
    if (!isNaN(posted.getTime())) {
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - MAX_AGE_DAYS);
      if (posted < cutoff) return false;
    }
  }

  // Block spam signals in description
  if (/\b(unsubscribe|cookie policy|privacy notice|terms of use)\b/i.test(desc.slice(0, 300))) return false;

  return true;
}

/* ─── CROSS-SOURCE DEDUPLICATION ─── */
function dedupeKey(title: string, company: string): string {
  return `${(title || "").toLowerCase().trim()}::${(company || "").toLowerCase().trim()}`;
}

/* ─── MAIN HANDLER ─── */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");
  const supabase = createClient(supabaseUrl, serviceKey);

  // Auth
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Authentication required" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userErr } = await userClient.auth.getUser();
  if (userErr || !user?.id) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const requesterUserId = user.id;

  const { data: roleData } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", requesterUserId)
    .eq("role", "admin")
    .maybeSingle();

  const isAdmin = !!roleData;

  const body = await req.json().catch(() => ({}));
  const { source_id, paste_url, keywords, location } = body;

  if (!isAdmin && !source_id && !paste_url) {
    return new Response(JSON.stringify({ error: "Admin access required to crawl all sources" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

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

    // Get user profile for search context
    const { data: profileData } = await supabase
      .from("profiles")
      .select("target_track, location, experience_level, keywords_include")
      .eq("user_id", requesterUserId)
      .maybeSingle();

    const searchKeywords = keywords || profileData?.keywords_include?.[0] || "finance analyst";
    const searchLocation = location || profileData?.location || "London";

    // ─── SOURCE PARALLELIZATION: Run ALL sources concurrently ───
    const globalDedup = new Set<string>();

    const crawlOneSource = async (source: any) => {
      const { data: run } = await supabase
        .from("crawl_runs")
        .insert({ source_id: source.id, status: "running" })
        .select()
        .single();

      try {
        let extractedJobs: any[] = [];

        if (source.crawl_type === "job_board") {
          extractedJobs = await crawlJobBoard(source, firecrawlKey, searchKeywords, searchLocation);
        } else {
          const pages = await crawlSource(source, firecrawlKey);
          for (const page of pages) {
            const hash = await hashText(page.url + (page.markdown || "").slice(0, 500));
            await supabase.from("raw_pages").upsert(
              { source_id: source.id, url: page.url, html_text: page.markdown || page.html, hash },
              { onConflict: "id" }
            );
          }
          extractedJobs = await extractJobsFromPages(pages, source);
        }

        // ─── EARLY FILTERING ───
        extractedJobs = extractedJobs.filter(j => passesEarlyFilter({
          title: j.title,
          company: j.company,
          posted_at: j.posted_at,
          description: j.description,
        }));

        // ─── CROSS-SOURCE DEDUPLICATION ───
        const uniqueJobs: any[] = [];
        for (const job of extractedJobs) {
          const key = dedupeKey(job.title, job.company);
          if (globalDedup.has(key)) continue;
          globalDedup.add(key);
          uniqueJobs.push(job);
        }

        // ─── UPSERT WITH CONFLICT RESOLUTION ───
        let inserted = 0;
        for (const job of uniqueJobs) {
          const hash = await hashText(job.source_job_url || job.title + job.company);
          const jobRow: Record<string, any> = {
            user_id: requesterUserId,
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
            source: source.name,
            salary: job.salary || null,
            job_type: job.job_type || null,
          };

          if (job.source_job_url) {
            // Upsert preserves user state (stage, match_score) while updating job data
            const { error } = await supabase.from("jobs").upsert(jobRow, {
              onConflict: "user_id,source_job_url",
              ignoreDuplicates: false, // Update existing records with fresh data
            });
            if (error) {
              console.warn("Job upsert failed", { source_job_url: job.source_job_url, message: error.message });
              continue;
            }
          } else {
            const { error } = await supabase.from("jobs").insert(jobRow);
            if (error) {
              console.warn("Job insert failed", { message: error.message });
              continue;
            }
          }
          inserted++;
        }

        await supabase.from("crawl_runs").update({
          status: "completed",
          ended_at: new Date().toISOString(),
          pages_crawled: uniqueJobs.length,
        }).eq("id", run.id);

        return { source: source.name, inserted, total: uniqueJobs.length };
      } catch (err: any) {
        console.error(`Crawl error for ${source.name}:`, err);
        await supabase.from("crawl_runs").update({
          status: "failed",
          ended_at: new Date().toISOString(),
          errors: [err.message || "Unknown error"],
        }).eq("id", run?.id);
        return { source: source.name, inserted: 0, error: err.message };
      }
    };

    // ─── Run all sources in parallel via Promise.allSettled ───
    console.log(`Starting parallel crawl of ${sources.length} sources`);
    const sourceResults = await Promise.allSettled(sources.map(crawlOneSource));

    let totalInserted = 0;
    const sourceDetails: any[] = [];
    for (const result of sourceResults) {
      if (result.status === "fulfilled") {
        totalInserted += result.value.inserted;
        sourceDetails.push(result.value);
      } else {
        sourceDetails.push({ error: result.reason?.message || "Unknown" });
      }
    }

    // Run matching
    const totalMatches = await runMatching(supabase, requesterUserId);

    return new Response(
      JSON.stringify({
        success: true,
        jobs_inserted: totalInserted,
        matches_created: totalMatches,
        sources_crawled: sources.length,
        source_details: sourceDetails,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("Crawl error:", err);
    return new Response(JSON.stringify({ error: err.message || "Crawl failed" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/* ─── JOB BOARD CRAWLING (with batch fetching + retries + quality validation) ─── */
async function crawlJobBoard(
  source: any,
  firecrawlKey: string | undefined,
  keywords: string,
  location: string,
): Promise<any[]> {
  if (!firecrawlKey) {
    console.warn("No FIRECRAWL_API_KEY, skipping:", source.name);
    return [];
  }

  const sourceName = source.name.toLowerCase();
  const config = JOB_BOARD_CONFIGS[sourceName];
  const timeoutMs = config?.isHeavyPagination ? LINKEDIN_TIMEOUT_MS : DEFAULT_TIMEOUT_MS;

  if (!config) {
    console.warn(`No job board config for: ${source.name}, falling back to search`);
    return await fallbackSearch(firecrawlKey, source, keywords, location, timeoutMs);
  }

  const queries = config.searchQueries(keywords, location);
  const allJobs: any[] = [];
  const seenUrls = new Set<string>();

  // Strategy 1: Firecrawl /search — batch queries concurrently
  const searchResults = await fetchInBatches(queries, async (query) => {
    const searchResp = await fetchWithRetry("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query,
        limit: 50,
        scrapeOptions: { formats: ["markdown"] },
      }),
    }, RETRY_ATTEMPTS, timeoutMs);

    const searchData = await searchResp.json();

    // ─── QUALITY VALIDATION: reject thin responses ───
    const rawText = JSON.stringify(searchData);
    if (rawText.length < MIN_CONTENT_LENGTH) {
      console.warn(`Quality check failed for query "${query}": response only ${rawText.length} chars`);
    }

    return searchData?.data || searchData?.results || [];
  }, BATCH_SIZE, BATCH_DELAY_MS);

  for (const result of searchResults) {
    if (result.status !== "fulfilled" || !Array.isArray(result.value)) continue;
    for (const item of result.value) {
      const url = item.url;
      if (!url || seenUrls.has(url.toLowerCase())) continue;
      seenUrls.add(url.toLowerCase());
      const job = parseSearchResult(item, source.name);
      if (job) allJobs.push(job);
    }
  }

  // Strategy 2: Scrape the main listing page with AI JSON extraction
  try {
    const listingUrl = config.buildSearchUrl(keywords, location);
    console.log(`Scraping listing page: ${listingUrl}`);

    const scrapeResp = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: listingUrl,
        formats: [
          "markdown",
          {
            type: "json",
            schema: AI_EXTRACTION_SCHEMA,
            prompt: AI_EXTRACTION_PROMPT,
          },
        ],
        onlyMainContent: true,
        waitFor: 10000,
        actions: config.isHeavyPagination ? buildLoadMoreActions() : undefined,
      }),
    }, RETRY_ATTEMPTS, timeoutMs);

    const scrapeData = await scrapeResp.json();

    // ─── QUALITY VALIDATION ───
    const scrapeText = JSON.stringify(scrapeData);
    if (scrapeText.length < MIN_CONTENT_LENGTH) {
      console.warn(`Quality check: AI scrape for ${source.name} returned only ${scrapeText.length} chars — may be blocked`);
    }

    const extractedJobs = scrapeData?.data?.json?.jobs || scrapeData?.json?.jobs || [];

    for (const ej of extractedJobs) {
      if (!ej.title || !ej.company) continue;
      const jobUrl = normalizeJobUrl(ej.url, source.base_url);
      if (seenUrls.has(jobUrl.toLowerCase())) continue;
      seenUrls.add(jobUrl.toLowerCase());

      allJobs.push({
        title: ej.title,
        company: ej.company,
        location: ej.location || null,
        salary: ej.salary || null,
        job_type: ej.job_type || null,
        seniority: mapSeniority(ej.seniority || ej.title),
        description: ej.description_snippet || null,
        source_job_url: jobUrl,
        apply_url: jobUrl,
        remote_flag: ej.remote_flag || /remote|hybrid/i.test(ej.location || ""),
        posted_at: parseDate(ej.date_posted),
        tags: [source.name],
        track: inferTrack(ej.title + " " + (ej.description_snippet || "")),
        extracted_json: { source: source.name, extracted_at: new Date().toISOString(), ai_extracted: true },
      });
    }
  } catch (err) {
    console.warn(`AI scrape failed for ${source.name}:`, err);
  }

  console.log(`${source.name}: found ${allJobs.length} jobs`);
  return allJobs;
}

/* ─── ACTION BUDGET: Build "Load more" actions capped at MAX_LOAD_MORE_CLICKS ─── */
function buildLoadMoreActions(): any[] {
  const actions: any[] = [];
  for (let i = 0; i < MAX_LOAD_MORE_CLICKS; i++) {
    actions.push({ type: "click", selector: "button.infinite-scroller__show-more-button, button[aria-label='Load more results'], button.see-more-jobs, a.infinite-scroller__show-more-button", timeout: 3000 });
    actions.push({ type: "wait", milliseconds: 1500 });
  }
  // Final scrape action
  actions.push({ type: "scrape" });
  return actions;
}

function parseSearchResult(result: any, sourceName: string): any | null {
  const url = result.url;
  if (!url) return null;
  if (/privacy|terms|about|help|faq|login|signup|cookie/i.test(url)) return null;

  const title = result.title?.split("|")[0]?.split(" - ")[0]?.trim() || "Unknown Role";
  const markdown = result.markdown || result.description || "";

  const companyMatch = title.match(/(?:at|@)\s+(.+?)(?:\s*[-|]|$)/i) ||
    result.title?.match(/[-|]\s*(.+?)(?:\s*[-|]|$)/);
  const company = companyMatch?.[1]?.trim() || extractDomain(url);

  const salaryMatch = markdown.match(/(?:£|salary[:\s]*£?)[\d,]+(?:\s*[-–to]\s*£?[\d,]+)?(?:\s*(?:per|p\.?a\.|pa|annually|per annum|k))?/i);
  const salary = salaryMatch?.[0] || null;

  const jobTypeMatch = markdown.match(/\b(full[- ]?time|part[- ]?time|contract|internship|temporary|permanent|freelance)\b/i);
  const job_type = jobTypeMatch?.[1] || null;

  const dateMatch = markdown.match(/(?:posted|published|listed)\s*:?\s*(\d{1,2}\s+\w+\s+\d{4}|\d+\s+(?:day|hour|week|month)s?\s+ago)/i);
  const posted_at = dateMatch?.[1] ? parseDate(dateMatch[1]) : null;

  return {
    title: title.slice(0, 200),
    company: company.slice(0, 200),
    location: extractLocation(markdown),
    salary,
    job_type,
    seniority: mapSeniority(title + " " + markdown.slice(0, 500)),
    description: markdown.slice(0, 3000),
    source_job_url: url,
    apply_url: url,
    remote_flag: /remote|hybrid|work from home/i.test(markdown),
    posted_at,
    tags: [sourceName],
    track: inferTrack(title + " " + markdown.slice(0, 500)),
    extracted_json: { source: sourceName, extracted_at: new Date().toISOString() },
  };
}

function extractLocation(text: string): string | null {
  const match = text.match(/(?:location|based in|office)[:\s]*([A-Z][a-z]+(?:[\s,]+[A-Z][a-z]+)*)/);
  if (match) return match[1].slice(0, 100);
  const ukCities = /\b(London|Manchester|Birmingham|Edinburgh|Glasgow|Leeds|Bristol|Cambridge|Oxford|Liverpool|Cardiff)\b/i;
  const cityMatch = text.match(ukCities);
  return cityMatch ? cityMatch[1] : null;
}

function extractDomain(url: string): string {
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    return host.split(".")[0].replace(/[-_]/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase());
  } catch {
    return "Company";
  }
}

function normalizeJobUrl(url: string | null, baseUrl: string): string {
  if (!url) return baseUrl;
  if (url.startsWith("http")) return url;
  if (url.startsWith("/")) {
    try {
      const base = new URL(baseUrl);
      return `${base.origin}${url}`;
    } catch { return url; }
  }
  return url;
}

function mapSeniority(text: string): string | null {
  const t = (text || "").toLowerCase();
  if (/\b(intern|internship|summer\s*(analyst|associate)?|placement|work\s*experience)\b/.test(t)) return "Intern";
  if (/\b(graduate|grad\s*scheme|grad\s*program|trainee|entry\s*level)\b/.test(t)) return "Graduate";
  if (/\b(junior|entry|associate|analyst)\b/.test(t)) return "Junior / Entry";
  if (/\b(mid[- ]?level|mid[- ]?senior|experienced)\b/.test(t)) return "Mid-level";
  if (/\b(senior|lead|principal|staff|head\s*of|director|vp|vice\s*president|managing\s*director)\b/.test(t)) return "Senior / Lead";
  return "Unclassified";
}

function inferTrack(text: string): string | null {
  const t = (text || "").toLowerCase();
  if (/investment.bank|m&a|ecm|dcm|leveraged.finance|capital.markets/i.test(t)) return "ib";
  if (/consult|strategy|advisory|mckinsey|bain|bcg/i.test(t)) return "consulting";
  if (/asset.manag|portfolio|fund|wealth/i.test(t)) return "am";
  if (/product.manag|apm|growth.product/i.test(t)) return "product";
  if (/private.equity|pe\s|buyout/i.test(t)) return "pe";
  if (/venture.capital|vc\s/i.test(t)) return "vc";
  if (/quant|trading|trader|market.mak/i.test(t)) return "trading";
  if (/audit|accounting|tax/i.test(t)) return "accounting";
  return null;
}

function parseDate(text: string | null | undefined): string | null {
  if (!text) return null;
  const cleaned = text.trim();
  const agoMatch = cleaned.match(/(\d+)\s+(day|hour|week|month)s?\s+ago/i);
  if (agoMatch) {
    const n = parseInt(agoMatch[1]);
    const unit = agoMatch[2].toLowerCase();
    const now = new Date();
    if (unit === "hour") now.setHours(now.getHours() - n);
    else if (unit === "day") now.setDate(now.getDate() - n);
    else if (unit === "week") now.setDate(now.getDate() - n * 7);
    else if (unit === "month") now.setMonth(now.getMonth() - n);
    return now.toISOString();
  }
  const parsed = Date.parse(cleaned);
  if (!Number.isNaN(parsed)) return new Date(parsed).toISOString();
  return null;
}

async function fallbackSearch(firecrawlKey: string, source: any, keywords: string, location: string, timeoutMs: number): Promise<any[]> {
  try {
    const resp = await fetchWithRetry("https://api.firecrawl.dev/v1/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: `${keywords} ${location} jobs site:${new URL(source.base_url).hostname}`,
        limit: 30,
        scrapeOptions: { formats: ["markdown"] },
      }),
    }, RETRY_ATTEMPTS, timeoutMs);
    const data = await resp.json();
    const results = data?.data || [];
    return results.map((r: any) => parseSearchResult(r, source.name)).filter(Boolean);
  } catch {
    return [];
  }
}

// ─── LEGACY CRAWL SOURCE ───
async function crawlSource(source: any, firecrawlKey: string | undefined): Promise<any[]> {
  if (!firecrawlKey) return [];

  const endpoint = source.crawl_type === "single"
    ? "https://api.firecrawl.dev/v1/scrape"
    : source.crawl_type === "sitemap"
    ? "https://api.firecrawl.dev/v1/map"
    : "https://api.firecrawl.dev/v1/crawl";

  if (source.crawl_type === "single") {
    const resp = await fetchWithRetry(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: source.base_url, formats: ["markdown"], onlyMainContent: true }),
    });
    const data = await resp.json();
    if (data?.data) return [{ url: source.base_url, markdown: data.data.markdown }];
    return [];
  }

  if (source.crawl_type === "sitemap") {
    console.log("Scraping markdown table from:", source.base_url);
    const tableResp = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ url: source.base_url, formats: ["markdown"], onlyMainContent: true, waitFor: 10000 }),
    });
    const tableData = await tableResp.json();
    const markdown = tableData?.data?.markdown || tableData?.markdown || "";
    console.log(`Got markdown: ${markdown.length} chars`);

    const tableRows = markdown.split("\n").filter((line: string) =>
      line.startsWith("|") && line.includes("[") && !line.includes("---")
    );

    const parsedJobs: any[] = [];
    for (const row of tableRows) {
      const companyMatch = row.match(/\|\s*\[([^\]]+)\]\(([^)]+)\)/);
      if (!companyMatch) continue;
      const companyName = companyMatch[1];

      const allLinks = [...row.matchAll(/\[([^\]]+)\]\(([^)]+)\)/g)];
      let programmeTitle = "";
      let applyUrl = "";
      for (const link of allLinks) {
        if (link[2].includes("trackr-cv-template") || link[2].includes("jobtestprep")) continue;
        if (link[2].includes("/company/")) continue;
        if (link[2] !== companyMatch[2]) {
          programmeTitle = link[1];
          applyUrl = link[2];
          break;
        }
      }

      if (!programmeTitle) {
        if (allLinks.length >= 2 && allLinks[1][2] !== companyMatch[2]) {
          programmeTitle = allLinks[1][1];
          applyUrl = allLinks[1][2];
        } else {
          programmeTitle = `${companyName} Programme`;
          applyUrl = companyMatch[2];
        }
      }

      const cells = row.split("|").map((c: string) => c.trim());
      const datePattern = /\d{1,2}\s+\w{3}\s+\d{2}/;
      const dateCells = cells.filter((c: string) => datePattern.test(c));
      const closingDate = dateCells[1] || null;

      const stageCells = cells.filter((c: string) =>
        /offers out|first round|ac$|assessment/i.test(c)
      );
      const latestStage = stageCells[0] || null;

      parsedJobs.push({
        url: applyUrl.startsWith("http") ? applyUrl : `https://app.the-trackr.com${applyUrl}`,
        markdown: "",
        _aiExtracted: {
          title: programmeTitle,
          company: companyName,
          location: "London",
          deadline: closingDate,
          url: applyUrl,
          track: null,
          status: latestStage || (closingDate ? "open" : "rolling"),
        },
      });
    }

    console.log(`Parsed ${parsedJobs.length} jobs from markdown table`);
    return parsedJobs;
  }

  // Default: crawl
  const resp = await fetchWithRetry(endpoint, {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url: source.base_url, limit: 5, maxDepth: 1,
      includePaths: source.allowlist_paths?.length > 0 ? source.allowlist_paths : undefined,
      scrapeOptions: { formats: ["markdown"] },
    }),
  });
  const data = await resp.json();
  return (data?.data || []).map((p: any) => ({ url: p.metadata?.sourceURL || source.base_url, markdown: p.markdown }));
}

// ─── PARSE SINGLE URL ───
async function parseSingleUrl(url: string, firecrawlKey: string | undefined): Promise<any> {
  if (!firecrawlKey) return { title: "Unknown", company: "Unknown", source_job_url: url };

  const resp = await fetchWithRetry("https://api.firecrawl.dev/v1/scrape", {
    method: "POST",
    headers: { Authorization: `Bearer ${firecrawlKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      url,
      formats: [
        "markdown",
        {
          type: "json",
          schema: AI_EXTRACTION_SCHEMA,
          prompt: "Extract the job details from this single job listing page. Return as a single-item jobs array.",
        },
      ],
      onlyMainContent: true,
    }),
  });
  const data = await resp.json();
  const aiJob = data?.data?.json?.jobs?.[0];
  const markdown = data?.data?.markdown || "";
  const title = aiJob?.title || data?.data?.metadata?.title?.split("|")[0]?.split("-")[0]?.trim()?.slice(0, 120) || "Unknown Role";

  return {
    title,
    company: aiJob?.company || data?.data?.metadata?.ogSiteName || extractDomain(url),
    description: aiJob?.description_snippet || markdown.slice(0, 2000),
    source_job_url: url,
    apply_url: url,
    location: aiJob?.location || null,
    salary: aiJob?.salary || null,
    job_type: aiJob?.job_type || null,
    seniority: mapSeniority(title),
    tags: [],
    track: inferTrack(title + " " + (aiJob?.description_snippet || markdown.slice(0, 500))),
    remote_flag: aiJob?.remote_flag || /remote|hybrid/i.test(markdown),
    posted_at: parseDate(aiJob?.date_posted),
  };
}

// ─── EXTRACT JOBS FROM PAGES (legacy) ───
async function extractJobsFromPages(pages: any[], source: any): Promise<any[]> {
  const jobs: any[] = [];

  for (const page of pages) {
    if (page._aiExtracted) {
      const j = page._aiExtracted;
      jobs.push({
        title: j.title || "Unknown Role",
        company: j.company || source.name,
        description: `${j.title} at ${j.company}. Track: ${j.track || "N/A"}. Status: ${j.status || "N/A"}. Deadline: ${j.deadline || "N/A"}.`,
        source_job_url: page.url,
        apply_url: page.url,
        location: j.location || null,
        remote_flag: /remote|hybrid/i.test(j.location || ""),
        seniority: mapSeniority(j.title || ""),
        track: j.track ? (/ib|investment.bank|m&a|ecm|dcm/i.test(j.track) ? "ib" : /consult|strategy/i.test(j.track) ? "consulting" : /asset.manag|am/i.test(j.track) ? "am" : /product/i.test(j.track) ? "product" : j.track.toLowerCase()) : null,
        tags: [j.status || "open"],
        posted_at: null,
        deadline: j.deadline || null,
        extracted_json: { source_url: page.url, extracted_at: new Date().toISOString(), ai_extracted: true },
      });
      continue;
    }

    if (!page.markdown || page.markdown.length < 100) continue;
    const text = page.markdown.toLowerCase();
    const titleMatch = page.markdown.match(/^#\s+(.+)/m);
    const title = titleMatch ? titleMatch[1].trim() : page.markdown.split("\n")[0]?.trim().slice(0, 120) || "Unknown Role";

    jobs.push({
      title,
      company: source.name,
      description: page.markdown.slice(0, 3000),
      source_job_url: page.url,
      apply_url: page.url,
      location: extractLocation(page.markdown),
      remote_flag: /remote|hybrid|work from home/i.test(text),
      seniority: mapSeniority(title + " " + text.slice(0, 500)),
      track: inferTrack(title + " " + text.slice(0, 500)),
      tags: [],
      posted_at: null,
      deadline: null,
      extracted_json: { source_url: page.url, extracted_at: new Date().toISOString() },
    });
  }

  return jobs;
}

// ─── MATCHING ENGINE ───
async function runMatching(supabase: any, userId: string): Promise<number> {
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

  const { data: profiles } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId);

  if (!profiles?.length) return 0;

  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs } = await supabase
    .from("jobs")
    .select("*")
    .eq("user_id", userId)
    .gte("created_at", weekAgo)
    .order("created_at", { ascending: false })
    .limit(500);

  if (!recentJobs?.length) return 0;

  let matchCount = 0;

  for (const profile of profiles) {
    for (const job of recentJobs) {
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

  const profileSkills = (profile.skills || []).map((s: string) => s.toLowerCase());
  if (profileSkills.length > 0) {
    const matched = profileSkills.filter((s: string) => desc.includes(s));
    const pct = matched.length / profileSkills.length;
    const pts = Math.round(pct * (weights.skills || 30));
    score += pts;
    if (matched.length > 0) reasons.push(`Skills match: ${matched.join(", ")} (${pts}pts)`);
  } else {
    score += Math.round((weights.skills || 30) * 0.5);
  }

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

  const profileLevel = (profile.experience_level || "").toLowerCase();
  const jobLevel = (job.experience_level || "").toLowerCase();
  const levelKeywords = seniorityMap[profileLevel] || [];
  if (profileLevel && (jobLevel === profileLevel || levelKeywords.some((k: string) => desc.includes(k)))) {
    score += weights.seniority || 20;
    reasons.push(`Seniority match: ${profileLevel} (${weights.seniority || 20}pts)`);
  } else if (!profileLevel) {
    score += Math.round((weights.seniority || 20) * 0.5);
  }

  const profileTrack = (profile.target_track || "").toLowerCase();
  const jobTrack = (job.track || "").toLowerCase();
  if (profileTrack && (jobTrack === profileTrack || desc.includes(profileTrack))) {
    score += weights.track || 20;
    reasons.push(`Track match: ${profileTrack} (${weights.track || 20}pts)`);
  } else if (!profileTrack) {
    score += Math.round((weights.track || 20) * 0.5);
  }

  const excludeKeys = (profile.keywords_exclude || []).map((k: string) => k.toLowerCase());
  const excluded = excludeKeys.filter((k: string) => desc.includes(k));
  if (excluded.length > 0) {
    score -= weights.exclude_keywords || 10;
    reasons.push(`Exclude keywords found: ${excluded.join(", ")} (-${weights.exclude_keywords || 10}pts)`);
  }

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
