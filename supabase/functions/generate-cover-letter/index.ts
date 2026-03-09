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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Invalid session" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { job_id, type } = await req.json();
    // type: "cover_letter" | "form_answers"

    // Fetch job details
    const { data: job } = await supabase
      .from("jobs")
      .select("*")
      .eq("id", job_id)
      .eq("user_id", user.id)
      .single();

    if (!job) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();

    const profileContext = profile
      ? `Candidate: ${profile.display_name || ""}. University: ${profile.university || "N/A"}. GPA: ${profile.gpa || "N/A"}. Experience: ${profile.experience_level || "N/A"}. Skills: ${(profile.skills || []).join(", ") || "N/A"}. Target tracks: ${(profile.target_tracks || [profile.target_track]).join(", ") || "N/A"}. Location: ${profile.location || "N/A"}. CV summary: ${(profile.cv_text || "").slice(0, 1500)}`
      : "No profile available.";

    const jobContext = `Role: ${job.title} at ${job.firm}. Track: ${job.track || "N/A"}. Location: ${job.location || "N/A"}. Level: ${job.experience_level || "N/A"}. Description: ${(job.description || "").slice(0, 2000)}`;

    let systemPrompt = "";
    if (type === "form_answers") {
      systemPrompt = `You are an expert career coach for finance/consulting/tech internships. Given the candidate profile and job details, generate common application form answers. Return a JSON object with these keys: "why_company", "why_role", "strengths", "relevant_experience", "career_goals". Each should be 100-200 words, professional, specific to this company and role. Do not be generic.`;
    } else {
      systemPrompt = `You are an expert career coach specializing in finance, consulting, and tech internship applications. Write a compelling, tailored cover letter for this specific role. The letter should:
- Be 250-350 words
- Reference specific aspects of the company and role
- Highlight relevant skills and experiences from the candidate's profile
- Sound authentic and confident, not generic
- Use a professional but engaging tone appropriate for the industry
- Start with "Dear Hiring Team at [Company],"
- End with a professional sign-off

Do NOT use placeholder brackets like [Your Name]. Use the candidate's actual name.`;
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `${profileContext}\n\n${jobContext}\n\nGenerate the ${type === "form_answers" ? "form answers as JSON" : "cover letter"}.` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "AI rate limit reached. Please try again in a moment." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI usage limit reached. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI error:", response.status, t);
      throw new Error("AI generation failed");
    }

    const aiData = await response.json();
    const content = aiData.choices?.[0]?.message?.content || "";

    return new Response(JSON.stringify({ success: true, content, type }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Generate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
