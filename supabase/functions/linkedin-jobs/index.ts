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

  try {
    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const firecrawlKey = Deno.env.get("FIRECRAWL_API_KEY");

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user?.id) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const { keywords = "finance internship", location = "London", limit = 25 } = body;

    if (!firecrawlKey) {
      return new Response(JSON.stringify({ error: "Firecrawl not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use Firecrawl to scrape LinkedIn's public job search
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(keywords)}&location=${encodeURIComponent(location)}&f_TPR=r604800`;
    
    const resp = await fetch("https://api.firecrawl.dev/v1/scrape", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${firecrawlKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        url: searchUrl,
        formats: [
          {
            type: "json",
            schema: {
              type: "object",
              properties: {
                jobs: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      title: { type: "string" },
                      company: { type: "string" },
                      location: { type: "string" },
                      url: { type: "string" },
                      posted: { type: "string" },
                      description_snippet: { type: "string" },
                    },
                  },
                },
              },
            },
            prompt: "Extract all job listings visible on the page. For each job get the title, company name, location, LinkedIn job URL, when it was posted, and any description snippet shown.",
          },
        ],
        onlyMainContent: true,
        waitFor: 8000,
      }),
    });

    const scrapeData = await resp.json();
    const extractedJobs = scrapeData?.data?.json?.jobs || scrapeData?.json?.jobs || [];

    // Dedupe and upsert into jobs table
    const supabase = createClient(supabaseUrl, serviceKey);
    let inserted = 0;

    for (const job of extractedJobs.slice(0, limit)) {
      if (!job.title || !job.company) continue;

      const sourceJobUrl = job.url?.startsWith("http")
        ? job.url
        : job.url
        ? `https://www.linkedin.com${job.url}`
        : null;

      const jobRow = {
        user_id: user.id,
        title: job.title,
        firm: job.company,
        location: job.location || null,
        source: "LinkedIn",
        source_job_url: sourceJobUrl,
        apply_url: sourceJobUrl,
        url: sourceJobUrl,
        description: job.description_snippet || null,
        stage: "saved",
        match_score: 0,
        tags: ["linkedin"],
        posted_at: null,
      };

      if (sourceJobUrl) {
        const { error } = await supabase.from("jobs").upsert(jobRow, {
          onConflict: "user_id,source_job_url",
          ignoreDuplicates: true,
        });
        if (!error) inserted++;
      } else {
        const { error } = await supabase.from("jobs").insert(jobRow);
        if (!error) inserted++;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        jobs_found: extractedJobs.length,
        jobs_inserted: inserted,
        preview: extractedJobs.slice(0, 5),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("LinkedIn scrape error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Failed to scrape LinkedIn" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
