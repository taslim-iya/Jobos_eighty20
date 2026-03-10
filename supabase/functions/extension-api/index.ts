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

    const { action, ...payload } = await req.json();

    // ── Get Profile ──
    if (action === "getProfile") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      return new Response(JSON.stringify({ profile: { ...profile, email: user.email } }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Learn Field (save manually entered data to profile) ──
    if (action === "learnField") {
      const { fieldType, value } = payload;
      if (!fieldType || !value) {
        return new Response(JSON.stringify({ error: "Missing fieldType or value" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Known profile columns
      const knownColumns: Record<string, string> = {
        first_name: "display_name",
        last_name: "display_name",
        location: "location",
        university: "university",
        gpa: "gpa",
        graduation: "graduation_year",
        visa: "visa_status",
        start_date: "start_date",
        experience: "experience_level",
        salary: "salary_min",
        linkedin: "linkedin_url",
        website: "website",
        phone: "phone",
        email: "email",
      };

      // Get current profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (!profile) {
        return new Response(JSON.stringify({ error: "Profile not found" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const updateData: Record<string, unknown> = {};

      if (knownColumns[fieldType]) {
        // Handle known fields with special cases
        if (fieldType === "first_name") {
          const parts = (profile.display_name || "").split(" ");
          parts[0] = value;
          updateData.display_name = parts.join(" ").trim();
        } else if (fieldType === "last_name") {
          const parts = (profile.display_name || "").split(" ");
          if (parts.length > 1) parts.splice(1, parts.length - 1, value);
          else parts.push(value);
          updateData.display_name = parts.join(" ").trim();
        } else if (fieldType === "salary") {
          const numVal = parseInt(value.replace(/[^0-9]/g, ""), 10);
          if (!isNaN(numVal)) updateData.salary_min = numVal;
        } else if (fieldType === "skills") {
          const newSkills = value.split(",").map((s: string) => s.trim()).filter(Boolean);
          const existing = profile.skills || [];
          updateData.skills = [...new Set([...existing, ...newSkills])];
        } else {
          updateData[knownColumns[fieldType]] = value;
        }
      } else {
        // Unknown field → store in auto_fill_data JSON
        const existing = (profile.auto_fill_data as Record<string, string>) || {};
        existing[fieldType] = value;
        updateData.auto_fill_data = existing;
      }

      const { error: updateErr } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("user_id", user.id);

      if (updateErr) {
        return new Response(JSON.stringify({ error: updateErr.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ ok: true, learned: fieldType, value }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AI Field Identification ──
    if (action === "identifyFields") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("AI not configured");

      const { fields } = payload;
      if (!fields || !Array.isArray(fields) || fields.length === 0) {
        return new Response(JSON.stringify({ error: "No fields provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Build a concise description of each field for the AI
      const fieldDescriptions = fields.map((f: { index: number; label: string; name: string; id: string; placeholder: string; type: string; ariaLabel: string; autocomplete: string }, i: number) =>
        `[${i}] label="${f.label || ""}" name="${f.name || ""}" id="${f.id || ""}" placeholder="${f.placeholder || ""}" type="${f.type || "text"}" aria-label="${f.ariaLabel || ""}" autocomplete="${f.autocomplete || ""}"`
      ).join("\n");

      const profileFields = [
        "first_name", "last_name", "email", "phone", "linkedin", "location",
        "university", "gpa", "graduation", "website", "salary", "visa",
        "start_date", "experience", "skills"
      ];

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [
            {
              role: "system",
              content: `You map HTML form fields to profile data types. Given form field metadata, return a JSON array where each element is the profile field name or null if no match. Profile fields: ${profileFields.join(", ")}. IMPORTANT: Distinguish first_name from last_name carefully based on labels/names/placeholders. Return ONLY a JSON array of strings/nulls, no explanation.`,
            },
            { role: "user", content: fieldDescriptions },
          ],
        }),
      });

      if (!aiResp.ok) {
        if (aiResp.status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI field identification failed");
      }

      const aiData = await aiResp.json();
      let content = aiData.choices?.[0]?.message?.content || "[]";
      // Extract JSON array from response
      const jsonMatch = content.match(/\[[\s\S]*\]/);
      let mappings: (string | null)[] = [];
      if (jsonMatch) {
        try { mappings = JSON.parse(jsonMatch[0]); } catch { mappings = []; }
      }

      return new Response(JSON.stringify({ mappings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Generate Cover Letter ──
    if (action === "generateCoverLetter") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("AI not configured");

      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("user_id", user.id)
        .single();

      const profileCtx = profile
        ? `Candidate: ${profile.display_name || ""}. University: ${profile.university || "N/A"}. GPA: ${profile.gpa || "N/A"}. Skills: ${(profile.skills || []).join(", ") || "N/A"}. Experience: ${profile.experience_level || "N/A"}. CV: ${(profile.cv_text || "").slice(0, 1500)}`
        : "No profile.";

      const jobCtx = payload.jobContext ? `Job context from page: ${payload.jobContext}` : "No job context available.";

      const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
            {
              role: "system",
              content: `You are a career coach. Write a 250-350 word cover letter tailored to the role. Professional, specific, not generic. Use the candidate's actual name.`,
            },
            { role: "user", content: `${profileCtx}\n\n${jobCtx}\n\nWrite the cover letter.` },
          ],
        }),
      });

      if (!aiResp.ok) {
        const status = aiResp.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error("AI generation failed");
      }

      const aiData = await aiResp.json();
      const coverLetter = aiData.choices?.[0]?.message?.content || "";

      return new Response(JSON.stringify({ coverLetter }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Extension API error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
