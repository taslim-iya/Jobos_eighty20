import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, systemPrompt, useCase, tools, tool_choice } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Build system prompt based on use case
    let system = systemPrompt || "You are a helpful AI assistant.";
    
    if (useCase === "interview") {
      system = "You are an elite interview coach for finance, consulting, and product management roles. Score answers across structure, relevance, specificity, and concision. Be direct and specific. Format feedback with **bold** headers.";
    } else if (useCase === "cover-letter") {
      system = "You are an elite career coach writing cover letters for top-tier finance and consulting roles. Be specific, concrete, and impressive. Use the candidate's actual experiences and metrics.";
    } else if (useCase === "cv-tailor") {
      system = "You are a CV optimization expert. Tailor CVs to match job descriptions by reordering and rewriting bullets for maximum ATS score and relevance.";
    } else if (useCase === "job-search") {
      system = "You are a job search assistant. Return ONLY valid JSON arrays of job objects. No markdown, no explanation. Each job should have: title, firm, location, deadline, description, match (number 70-99), tags (array).";
    } else if (useCase === "outreach") {
      system = "You are a networking and outreach expert for finance and consulting professionals. Write concise, personalized messages that get replies.";
    } else if (useCase === "website-scan") {
      system = "Return only a JSON array of job objects found. No markdown. Each object: {title, location, deadline, description}.";
    }

    const requestBody: any = {
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        ...messages,
      ],
      stream: false,
      max_tokens: 2000,
    };

    // Pass through tools and tool_choice if provided
    if (tools) requestBody.tools = tools;
    if (tool_choice) requestBody.tool_choice = tool_choice;

    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      }
    );

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI usage credits exhausted. Please add credits in Settings." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "AI service temporarily unavailable." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    
    // If tool calls are present, return the full choices object
    if (data.choices?.[0]?.message?.tool_calls) {
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const content =
      data.choices?.[0]?.message?.content || "No response generated.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-chat error:", e);
    return new Response(
      JSON.stringify({
        error: e instanceof Error ? e.message : "Unknown error",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
