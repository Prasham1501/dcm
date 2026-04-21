import type { Reading } from '../types';
import { parseTextBlock } from '../parseUsgText';

const HF_API_URL = 'https://api-inference.huggingface.co/models/HuggingFaceTB/SmolVLM-Instruct';

const EXTRACTION_PROMPT = `You are a radiologist assistant. Look at this ultrasound image carefully.
Extract ALL visible measurements, numeric values, and clinical findings you can see.
List each measurement on its own line in the format: "Label: value unit"
For example:
BPD: 5.2 cm
HC: 18.4 cm
Liver: 12.3 cm
Spleen: 9.1 cm
If you see gestational age, write it as: GA: 24 weeks 3 days
If you see dimensions, write as: Organ: L x W x H cm
Only output the measurements list, nothing else.`;

export async function fromVisionModel(
  hfToken: string,
  imageUrls: string[]
): Promise<{ readings: Reading[]; warnings: string[] }> {
  const warnings: string[] = [];

  if (!hfToken?.trim()) {
    return { readings: [], warnings: ['No HuggingFace token configured — vision fallback skipped'] };
  }

  // Get the first rendered canvas as base64
  let imageBase64: string | null = null;
  try {
    const cornerstone = (window as any).__cornerstone ?? (window as any).cornerstone;
    if (!cornerstone) {
      warnings.push('Cornerstone not available for vision model capture');
      return { readings: [], warnings };
    }
    const elements = document.querySelectorAll('[data-viewport-index], [data-cr-viewport-index]');
    for (const el of Array.from(elements)) {
      try {
        const enabled = cornerstone.getEnabledElement(el as HTMLElement);
        if (enabled?.canvas) {
          imageBase64 = enabled.canvas.toDataURL('image/jpeg', 0.85).split(',')[1];
          break;
        }
      } catch { /* skip */ }
    }
  } catch (err: any) {
    warnings.push(`Canvas capture for vision model failed: ${err?.message}`);
    return { readings: [], warnings };
  }

  if (!imageBase64) {
    warnings.push('No rendered image found for vision model');
    return { readings: [], warnings };
  }

  try {
    const response = await fetch(HF_API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${hfToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inputs: {
          text: EXTRACTION_PROMPT,
          image: imageBase64,
        },
        parameters: { max_new_tokens: 300 },
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      if (response.status === 503) {
        warnings.push('HF model is loading, try again in ~20s');
      } else if (response.status === 429) {
        warnings.push('HuggingFace rate limit reached — vision fallback skipped');
      } else {
        warnings.push(`HF API error ${response.status}: ${errText.slice(0, 120)}`);
      }
      return { readings: [], warnings };
    }

    const json = await response.json();
    const text: string =
      json?.[0]?.generated_text ?? json?.generated_text ?? JSON.stringify(json);

    const { readings, warnings: parseWarnings } = parseTextBlock(text);
    return { readings, warnings: [...warnings, ...parseWarnings] };
  } catch (err: any) {
    if (err?.name === 'TimeoutError') {
      warnings.push('HF vision model timed out after 30s');
    } else {
      warnings.push(`HF vision model error: ${err?.message}`);
    }
    return { readings: [], warnings };
  }
}
