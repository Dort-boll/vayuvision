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

  const systemInstruction = `You are Vayu Vision, a world-class assistive intelligence. 
Your goal is to provide highly accurate, comprehensive, and helpful descriptions of the user's surroundings.

When describing:
1. OBJECTS: Identify specific objects, their colors, positions, and relative distances.
2. SCENES: Describe the overall environment (e.g., "a busy kitchen", "a quiet park path"). Mention lighting and atmosphere.
3. TEXT: If there is text (signs, labels, documents), read it exactly as it appears.
4. SPATIAL HINTS: Use clock-face positions (e.g., "at 2 o'clock") or relative terms ("to your left", "directly in front") to help the user navigate.
5. SAFETY: Alert the user to potential hazards (e.g., "a step down", "an open door").

Keep descriptions conversational yet precise. Focus on what is most relevant to the user's request.
Respond in the requested language: ${language}.`;

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
