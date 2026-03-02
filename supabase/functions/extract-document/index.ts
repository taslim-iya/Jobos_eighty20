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
    const { base64, fileName, mimeType } = await req.json();

    if (!base64) {
      return new Response(
        JSON.stringify({ error: "No file data provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    // Determine mime type
    let detectedMime = mimeType || "application/pdf";
    if (fileName) {
      const ext = fileName.toLowerCase().split(".").pop();
      if (ext === "pdf") detectedMime = "application/pdf";
      else if (ext === "docx") detectedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      else if (ext === "doc") detectedMime = "application/msword";
    }

    console.log(`Extracting text from: ${fileName} (${detectedMime})`);

    // Use Gemini Vision API via Lovable AI gateway to extract text from the document
    const response = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            {
              role: "system",
              content: "You are a document text extraction tool. Extract ALL text from the provided document exactly as it appears. Preserve all formatting, sections, bullet points, dates, numbers, and structure. Return ONLY the extracted text content with no commentary, headers, or explanations. Maintain the original layout with proper line breaks and section headings."
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: `Extract the complete text from this document file (${fileName}). Return ALL text exactly as it appears in the document, preserving structure, sections, bullet points, and formatting. Return ONLY the extracted text.`
                },
                {
                  type: "image_url",
                  image_url: {
                    url: `data:${detectedMime};base64,${base64}`
                  }
                }
              ]
            }
          ],
          max_tokens: 8000,
        }),
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
          JSON.stringify({ error: "AI credits exhausted. Please add credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(
        JSON.stringify({ error: "Failed to extract text from document." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const extractedText = data.choices?.[0]?.message?.content || "";

    if (!extractedText || extractedText.length < 20) {
      return new Response(
        JSON.stringify({ error: "Could not extract meaningful text from the document. Please try a different file format." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Successfully extracted ${extractedText.length} characters`);

    return new Response(
      JSON.stringify({ text: extractedText }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("extract-document error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
