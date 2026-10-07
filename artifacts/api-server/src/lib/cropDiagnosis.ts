import { GoogleGenAI, type Part } from "@google/genai";
import { z } from "zod/v4";

const DiagnosisModelOutput = z.object({
  primary_condition: z.string().min(2).max(150),
  condition_category: z.enum([
    "fungal",
    "bacterial",
    "viral",
    "pest",
    "deficiency",
    "water",
    "unknown",
  ]),
  confidence_score: z.number().min(0).max(1),
  severity_level: z.enum(["low", "moderate", "severe", "critical"]),
  visual_evidence: z.array(z.string().min(3).max(220)).max(8),
  differential_diagnoses: z
    .array(
      z.object({
        condition: z.string().min(2).max(150),
        probability: z.number().min(0).max(1),
      }),
    )
    .max(5),
  suggested_observations: z.array(z.string().min(3).max(220)).max(8),
  requires_officer_review: z.boolean(),
});

export type CropDiagnosis = z.infer<typeof DiagnosisModelOutput>;

const SAFETY_INSTRUCTION = `You are a cautious agricultural triage assistant. This is not a substitute for a local agronomist. Return one JSON object only with these keys: primary_condition, condition_category, confidence_score, severity_level, visual_evidence, differential_diagnoses, suggested_observations, requires_officer_review.
Never claim certainty from incomplete evidence. If the evidence is ambiguous, use condition_category "unknown" and a confidence below 0.70. Do not prescribe products, chemicals, dosages, or treatment schedules. Describe only observed evidence and safe observations the farmer can make. Set requires_officer_review when confidence is below 0.70 or severity is severe/critical. Use category values fungal, bacterial, viral, pest, deficiency, water, or unknown and severity values low, moderate, severe, or critical. If image evidence is absent or unusable, explicitly reflect that uncertainty.`;

function extractImage(imageDataUrl?: string): { mimeType: string; data: string } | null {
  if (!imageDataUrl) return null;
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(
    imageDataUrl,
  );
  if (!match) throw new Error("Unsupported or malformed image data.");
  const data = match[2];
  if (!data || Buffer.byteLength(data, "base64") > 7 * 1024 * 1024) {
    throw new Error("Image is too large. Choose an image under 7 MB.");
  }
  return { mimeType: match[1]!, data };
}

export async function diagnoseCrop(input: {
  cropName: string;
  cropStage: string;
  symptoms: string;
  language: string;
  imageDataUrl?: string;
}): Promise<CropDiagnosis> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("DIAGNOSIS_NOT_CONFIGURED");

  const image = extractImage(input.imageDataUrl);
  const ai = new GoogleGenAI({ apiKey });
  const parts: Part[] = [
    {
      text: `Crop: ${input.cropName}\nGrowth stage: ${input.cropStage}\nFarmer observations: ${input.symptoms}\nResponse language: ${input.language}\nReturn the required JSON.`,
    },
  ];
  if (image) {
    parts.push({
      inlineData: { mimeType: image.mimeType, data: image.data },
    });
  }

  const result = await ai.models.generateContent({
    model: "gemini-2.5-flash",
    contents: [{ role: "user", parts }],
    config: {
      systemInstruction: SAFETY_INSTRUCTION,
      responseMimeType: "application/json",
      maxOutputTokens: 8192,
    },
  });

  const raw = result.text;
  if (!raw) throw new Error("Diagnosis service returned an empty response.");
  let decoded: unknown;
  try {
    decoded = JSON.parse(raw);
  } catch {
    throw new Error("Diagnosis service returned an invalid response.");
  }
  const parsed = DiagnosisModelOutput.safeParse(decoded);
  if (!parsed.success) {
    throw new Error("Diagnosis service returned an incomplete response.");
  }
  return {
    ...parsed.data,
    requires_officer_review:
      parsed.data.requires_officer_review ||
      parsed.data.confidence_score < 0.7 ||
      parsed.data.condition_category === "unknown" ||
      ["severe", "critical"].includes(parsed.data.severity_level),
  };
}
