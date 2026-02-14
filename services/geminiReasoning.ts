import type { ClassificationResult, EarthquakeEvent } from "./zoneClassifier.types";

const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";

function buildSummary(result: ClassificationResult, quake: EarthquakeEvent): string {
  const r = result.zones.red;
  const o = result.zones.orange;
  const g = result.zones.green;
  return JSON.stringify(
    {
      quake: {
        id: quake.quake_id,
        magnitude: quake.magnitude,
        depth_km: quake.depth,
      },
      red_zone: {
        open_areas: r.open_areas.map((x) => ({ name: x.name, type: x.type, fallback: x.fallback_from_green })),
      },
      orange_zone: {
        hospitals: o.hospitals.map((x) => ({ name: x.name, type: x.type, fallback: x.fallback_from_green })),
      },
      green_zone: {
        open_areas: g.open_areas.map((x) => x.name),
        camps: g.camps.map((x) => x.name),
        hospitals: g.hospitals.map((x) => x.name),
      },
    },
    null,
    0
  );
}

/**
 * Calls Gemini to generate a short explanation of why locations were selected,
 * why others were excluded, and how risk influenced the decision.
 * Returns null if API key is missing or the request fails.
 */
export async function generateClassificationReasoning(
  result: ClassificationResult,
  quake: EarthquakeEvent,
  apiKey?: string
): Promise<string | null> {
  const key = apiKey ?? process.env.GEMINI_API_KEY ?? process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!key?.trim()) return null;

  const summary = buildSummary(result, quake);
  const prompt = `You are an earthquake emergency response analyst. Based on the following zone classification output for a magnitude ${quake.magnitude} event, write a short reasoning (2-3 paragraphs) that explains:
1. Why certain locations were selected for each zone (red/orange/green) and category.
2. Why other locations may have been excluded (e.g. structural risk, type not allowed in zone).
3. How risk (structural risk score, building density, distance from epicenter) influenced the decisions.

Keep the tone professional and concise. Output only the explanation, no headings or bullet points.

Classification output:
${summary}`;

  try {
    const res = await fetch(GEMINI_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": key,
      },
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          maxOutputTokens: 1024,
          temperature: 0.3,
        },
      }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error("Gemini API error:", res.status, err);
      return null;
    }
    const data = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
    };
    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    return text ?? null;
  } catch (e) {
    console.error("Gemini reasoning request failed:", e);
    return null;
  }
}
