import { AI_MODELS } from "../constants";

declare global {
  interface Window {
    puter: any;
  }
}

/**
 * Analyzes an image using Puter.js AI capabilities with robust retry logic.
 * Optimized for frontend-only deployment (e.g., Cloudflare Pages).
 */
export async function analyzeScene(
  base64Image: string,
  prompt: string,
  preferredModelId: string = "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  language: string = "en-US",
): Promise<string> {
  if (!window.puter) {
    throw new Error("Vayu Vision engine is initializing. Please wait...");
  }

  const systemInstruction = `You are Vayu Vision, a world-class High-Fidelity Sensory Companion. 
Your primary objective is to empower the visually and hearing impaired with precise, real-time spatial awareness and information.

OPERATIONAL PARAMETERS:
1. SPATIAL MAPPING: Describe objects with relative distances and clock-face directions (e.g., "At 10 o'clock, there is a silver chair approximately 2 meters away").
2. NAVIGATION & SAFETY: Prioritize hazards (stairs, obstructions, vehicles, wet surfaces). Use urgent tone only for immediate danger.
3. TEXT RECOGNITION: Extract and transcribe all visible text. Categorize it (e.g., "Signage:", "Label:", "Document Text:").
4. OBJECT RECOGNITION: Describe color, shape, and state (e.g., "The door is partially open").
5. PERSON DETECTION: Describe number of people, their general activity, and distance.

REPLY PROTOCOL:
- Stay under 80 words.
- Use professional, supportive, and objective language.
- Respond in the requested language: ${language}.
`;

  const fullPrompt = `${systemInstruction}\n\nUser Request: ${prompt}`;
  const dataUrl = `data:image/jpeg;base64,${base64Image}`;

  // Create a list of models to try, starting with the preferred one
  const modelsToTry = [
    preferredModelId,
    ...AI_MODELS.map(m => m.id).filter(id => id !== preferredModelId)
  ];

  let lastError: any = null;

  for (const modelId of modelsToTry) {
    try {
      console.log(`Attempting analysis with model: ${modelId}`);
      
      const response = await window.puter.ai.chat(fullPrompt, dataUrl, {
        model: modelId,
      });

      const content = response?.message?.content || response?.text || (typeof response === 'string' ? response : null);

      if (content) {
        return content;
      }
      
      throw new Error(`Empty response from model: ${modelId}`);
    } catch (error: any) {
      console.warn(`Analysis failed with model ${modelId}:`, error.message || error);
      lastError = error;
      // Continue to next model
    }
  }

  // If we reach here, all models failed
  console.error("All AI models failed to analyze the scene.");
  throw new Error(
    lastError?.message || "Sorry, I'm having trouble analyzing the scene right now. All available AI modules failed."
  );
}
