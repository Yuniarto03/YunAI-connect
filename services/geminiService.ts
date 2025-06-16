
import { GoogleGenAI, GenerateContentResponse, Chat, Part, Content } from "@google/genai";
import { ChatMessage, GroundingChunk, GroundingSource, AiDocumentResponse, DataRow, AiOutputTypeHint, CombinedAiOutput, AiServiceResponseType, PptxJsonData, PptxLayoutType } from '../types';
import { GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL } from '../constants';
import * as XLSX from 'xlsx';

let ai: GoogleGenAI | null = null;

const getAiClient = (): GoogleGenAI => {
  if (!ai) {
    const apiKey = (window as any).process?.env?.API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key not found. Please set process.env.API_KEY.");
    }
    ai = new GoogleGenAI({ apiKey });
  }
  return ai;
};

export const generateText = async (prompt: string, systemInstruction?: string): Promise<GenerateContentResponse> => {
  const client = getAiClient();
  const config: any = {};
  if (systemInstruction) {
    config.systemInstruction = systemInstruction;
  }
  
  const response = await client.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: systemInstruction ? { systemInstruction } : undefined,
  });
  return response;
};

export const generateTextWithImage = async (prompt: string, imageBase64: string, mimeType: string): Promise<GenerateContentResponse> => {
  const client = getAiClient();
  const imagePart: Part = {
    inlineData: {
      data: imageBase64,
      mimeType: mimeType,
    },
  };
  const textPart: Part = { text: prompt };
  
  const response = await client.models.generateContent({
    model: GEMINI_TEXT_MODEL, // Vision capabilities are typically in general models like Flash or Pro
    contents: { parts: [textPart, imagePart] },
  });
  return response;
};

export const startChat = (systemInstruction?: string): Chat => {
  const client = getAiClient();
  return client.chats.create({
    model: GEMINI_TEXT_MODEL,
    config: systemInstruction ? { systemInstruction } : undefined,
  });
};

export const sendMessageInChat = async (chat: Chat, message: string, history?: Content[]): Promise<GenerateContentResponse> => {
   const fullHistory = history ? history : [];
   // The sendMessage method takes care of managing history internally for the Chat object.
   // However, if you want to pass the full history for some reason, you might need to manage it outside.
   // For simplicity, we rely on the Chat object's internal history.
   const response = await chat.sendMessage({ message });
   return response;
};

export const sendMessageInChatStream = async (chat: Chat, message: string): Promise<AsyncIterable<GenerateContentResponse>> => {
  const responseStream = await chat.sendMessageStream({ message });
  return responseStream;
};


export const generateTextWithSearch = async (prompt: string): Promise<GenerateContentResponse> => {
  const client = getAiClient();
  const response = await client.models.generateContent({
    model: GEMINI_TEXT_MODEL,
    contents: prompt,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  return response;
};

export const extractSources = (geminiResponse: GenerateContentResponse): GroundingSource[] => {
  const sources: GroundingSource[] = [];
  const chunks = geminiResponse.candidates?.[0]?.groundingMetadata?.groundingChunks;
  if (chunks) {
    chunks.forEach((chunk: GroundingChunk) => {
      if (chunk.web && chunk.web.uri) {
        sources.push({ uri: chunk.web.uri, title: chunk.web.title || chunk.web.uri });
      } else if (chunk.retrievedContext && chunk.retrievedContext.uri) {
        // Handle other types of grounding if necessary
         sources.push({ uri: chunk.retrievedContext.uri, title: chunk.retrievedContext.title || chunk.retrievedContext.uri });
      }
    });
  }
  return sources;
};

// Helper function to strip JavaScript-style comments from a string
const stripJsComments = (str: string): string => {
  if (!str) return "";
  // This regex attempts to remove block comments (/* ... */) and line comments (// ...)
  // It's a simplified version and might not handle all edge cases like comments in strings.
  let processedStr = str.replace(/\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*$/gm, '$1');
  return processedStr;
};

// Define a list of MIME types likely supported by Gemini for inlineData content processing
const SUPPORTED_MIME_TYPES_FOR_INLINEDATA: string[] = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'application/pdf',
  // Excel (.xls, .xlsx), Word (.doc, .docx), PowerPoint (.ppt, .pptx)
  // are typically processed client-side if their content needs to be text for the AI.
  // Direct upload of these for Gemini's multimodal capabilities might be limited or evolve.
  // For now, we focus on image/pdf for direct inlineData.
  // Text files (.txt, .md) are read as text client-side.
];

// Function to parse JSON robustly, including stripping markdown fences and comments
const parseJsonResponseRobustly = (jsonString: string): any => {
    let processedString = jsonString.trim();
    const fenceRegex = /^```(\w*)?\s*\n?(.*?)\n?\s*```$/s;
    const matchFence = processedString.match(fenceRegex);
    if (matchFence && matchFence[2]) {
      processedString = matchFence[2].trim();
    }
    processedString = stripJsComments(processedString);
    try {
        return JSON.parse(processedString);
    } catch (error) {
        // Log the original and processed string for easier debugging if robust parsing fails
        console.error("Robust JSON parsing failed. Error:", (error as Error).message, "Original string for robust parse:", jsonString, "Processed string before parse attempt:", processedString);
        // Re-throw with a more specific message, including the original error if possible
        throw new Error(`Invalid JSON response from AI. Original Error: ${(error as Error).message}. Processed string was: '${processedString.substring(0, 200)}...'`);
    }
};


export const analyzeDocumentWithGemini = async (
  instruction: string, 
  file?: File,
  outputTypeHint: AiOutputTypeHint = 'text' // User's desired final output type
): Promise<AiDocumentResponse> => {
  try {
    const client = getAiClient();
    let fullPrompt = instruction;
    let serviceResponseType: AiServiceResponseType = 'text'; // Internal type for what the AI should return

    // Handle direct image generation
    if (outputTypeHint === 'png') {
      const imagenResponse = await client.models.generateImages({
        model: GEMINI_IMAGE_MODEL,
        prompt: instruction, // Assuming instruction is the image prompt
        config: { numberOfImages: 1, outputMimeType: 'image/png' },
      });
      if (imagenResponse.generatedImages && imagenResponse.generatedImages.length > 0) {
        return {
          type: 'image',
          content: imagenResponse.generatedImages[0].image.imageBytes,
          fileName: `generated_image_${Date.now()}.png`,
          originalUserHint: outputTypeHint,
        };
      } else {
        return { type: 'error', content: 'Image generation failed or returned no images.', originalUserHint: outputTypeHint };
      }
    }

    const requestParts: Part[] = [];
    let textPromptForRequest = fullPrompt;
    let geminiResponseMimeType: string | undefined = undefined;

    // Determine internal serviceResponseType and Gemini's expected response MIME type
    switch (outputTypeHint) {
      case 'json':
      case 'xlsx':
        serviceResponseType = 'table';
        geminiResponseMimeType = "application/json";
        textPromptForRequest = `${fullPrompt}\n\nPlease return data in a JSON array of objects format. Each object should represent a row in a table.`;
        break;
      case 'combined_text_table_image':
        serviceResponseType = 'combined';
        geminiResponseMimeType = "application/json";
        textPromptForRequest = `${fullPrompt}\n\nPlease provide your response as a JSON object with the following structure:
{
  "textAnalysis": "Your textual analysis or summary here.",
  "jsonDataTable": [/* An array of JSON objects representing a table, or null if no table is relevant */],
  "imagePrompt": "A descriptive prompt for an image that would complement your analysis, or null if no image is needed."
}`;
        break;
      case 'msword':
        serviceResponseType = 'text'; // Expect Markdown from AI
        geminiResponseMimeType = undefined; 
        textPromptForRequest = `Primary instruction: ${fullPrompt}.\n\nPlease format your response as well-structured Markdown content suitable for direct conversion into a Microsoft Word document. Use appropriate Markdown for headings, paragraphs, lists, and simple tables if applicable.`;
        break;
      case 'pdf':
        serviceResponseType = 'text'; // Expect Markdown from AI
        geminiResponseMimeType = undefined;
        textPromptForRequest = `Primary instruction: ${fullPrompt}.\n\nPlease format your response as well-structured Markdown content suitable for direct conversion into a PDF document. Use appropriate Markdown for headings, paragraphs, lists, and simple tables if applicable.`;
        break;
      case 'pptx':
        serviceResponseType = 'text'; // Expect JSON string from AI (to be parsed client-side)
        geminiResponseMimeType = "application/json"; // Tell Gemini to return JSON
        textPromptForRequest = `Primary instruction: ${fullPrompt}.
Please generate content for a PowerPoint presentation. Structure your response STRICTLY as a JSON object.
The JSON object should have a top-level optional "theme" object and a "slides" array.

Available slide layouts (for the "layout" property in each slide object) are:
'TITLE_SLIDE', 'TITLE_AND_CONTENT', 'SECTION_HEADER', 'TWO_CONTENT', 'COMPARISON', 'TITLE_ONLY', 'BLANK', 'CONTENT_WITH_CAPTION', 'PICTURE_WITH_CAPTION'.

The "theme" object can optionally include:
  "primaryColor": "#RRGGBB" (hex for titles, accents),
  "secondaryColor": "#RRGGBB" (hex for other accents),
  "bodyTextColor": "#RRGGBB" (hex for main text),
  "fontFamily": "Arial" (suggested font),
  "author": "Author Name",
  "company": "Company Name",
  "title": "Presentation Title"

Each object in the "slides" array represents a slide and can have:
  "layout": (string, one of the PptxLayoutType values listed above, e.g., "TITLE_SLIDE"). Default to "TITLE_AND_CONTENT" if omitted.
  "title": (string, optional) Top-level title for the slide. Can also be provided via an element.
  "subtitle": (string, optional) Top-level subtitle for the slide. Can also be provided via an element.
  "elements": (array of PptxSlideElement objects, optional). An element object has:
    "type": (string) one of 'title', 'subtitle', 'paragraph', 'bulletList', 'imagePlaceholder'.
    "text": (string) content for 'title', 'subtitle', 'paragraph'. For 'imagePlaceholder', this is an image generation prompt.
    "items": (array of strings) for 'bulletList'.
    "x", "y", "w", "h": (optional number or string like '50%') for explicit positioning and sizing if needed for custom layouts.
    "options": (optional object) for PptxGenJS specific text options like fontSize, color (hex string without #), bold.
  "notes": (string, optional) speaker notes.
  "backgroundColor": (string, optional hex color like "FF0000" for slide background).

Example of a "slides" array item:
{
  "layout": "TITLE_AND_CONTENT",
  "title": "Main Title for Slide",
  "elements": [
    { "type": "paragraph", "text": "This is an introductory paragraph.", "options": { "fontSize": 18 } },
    { "type": "bulletList", "items": ["Point one.", "Point two with details."] },
    { "type": "imagePlaceholder", "text": "A serene landscape with mountains." }
  ],
  "notes": "Remember to elaborate on point two."
}
Ensure the output is ONLY the JSON object and nothing else. Do not wrap it in markdown.
`;
        break;
      case 'text':
      default:
        serviceResponseType = 'text';
        geminiResponseMimeType = undefined; // Expect plain text
        break;
    }
    
    if (file) {
      const originalMimeType = file.type;
      // Check if file type is directly processable by Gemini as inlineData
      const isSupportedForInlineData = SUPPORTED_MIME_TYPES_FOR_INLINEDATA.includes(originalMimeType);

      if (isSupportedForInlineData) {
        const arrayBuffer = await file.arrayBuffer();
        let binary = '';
        const bytes = new Uint8Array(arrayBuffer);
        const len = bytes.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(bytes[i]);
        }
        const base64Data = btoa(binary);
        
        requestParts.push({
          inlineData: {
            data: base64Data,
            mimeType: originalMimeType 
          }
        });
        textPromptForRequest = `The user also attached a file named "${file.name}" (MIME type: ${originalMimeType}). Please process its content along with the primary instruction that follows.\n\nPrimary instruction: ${textPromptForRequest}`;
      } else if (file.type === 'text/plain' || file.type === 'text/markdown') {
        const fileTextContent = await file.text();
        textPromptForRequest = `The user attached a text file named "${file.name}". Its content is:\n\`\`\`\n${fileTextContent}\n\`\`\`\n\nPlease consider this content for the primary instruction: ${textPromptForRequest}`;
      }
       else {
        // For other file types not directly supported by Gemini's inlineData or not processed as text here (like docx, pptx client-side)
        // we are relying on the Excel pre-processing logic in AiDocument.tsx for .xls/.xlsx.
        // For other unhandled types, we just mention the file.
        textPromptForRequest = `A file named "${file.name}" of type "${originalMimeType}" was provided. If its content wasn't pre-processed and included above, please respond based on the filename, type, and the following instruction: ${textPromptForRequest}`;
      }
    }
    requestParts.unshift({ text: textPromptForRequest });
    
    const geminiTextResponse = await client.models.generateContent({
        model: GEMINI_TEXT_MODEL, 
        contents: { parts: requestParts },
        config: geminiResponseMimeType ? { responseMimeType: geminiResponseMimeType } : undefined,
    });

    let responseText = geminiTextResponse.text;

    if (serviceResponseType === 'combined') {
        let parsedCombined;
        try {
            parsedCombined = parseJsonResponseRobustly(responseText);
        } catch (parseError: any) {
            console.error("Failed to parse 'combined' JSON response from AI:", parseError.message, "\nRaw AI response for combined output was:\n", responseText);
            return { 
                type: 'error', // Or 'text' with an error message prepended
                content: `AI tried to return a combined output, but JSON parsing failed: ${parseError.message}. Raw AI response (see console for full text): '${responseText.substring(0,500)}...'`, 
                originalUserHint: outputTypeHint 
            };
        }

        const combinedOutput: CombinedAiOutput = {
            textPart: parsedCombined.textAnalysis || null,
            tablePart: (Array.isArray(parsedCombined.jsonDataTable) && parsedCombined.jsonDataTable.every((item:any) => typeof item === 'object' && item !== null)) ? parsedCombined.jsonDataTable as DataRow[] : null,
            imagePart: null, // Initialize as null
            imageDescription: parsedCombined.imagePrompt || null,
        };

        if (combinedOutput.imageDescription) {
            try {
                const imagenResponse = await client.models.generateImages({
                    model: GEMINI_IMAGE_MODEL,
                    prompt: combinedOutput.imageDescription,
                    config: { numberOfImages: 1, outputMimeType: 'image/png' },
                });
                if (imagenResponse.generatedImages && imagenResponse.generatedImages.length > 0) {
                    combinedOutput.imagePart = imagenResponse.generatedImages[0].image.imageBytes;
                } else {
                    console.warn("Image generation returned no images for prompt:", combinedOutput.imageDescription);
                    combinedOutput.textPart = (combinedOutput.textPart || "") + "\n\n(Note: Image generation for the provided description did not produce an image.)";
                }
            } catch (imageGenError: any) {
                console.error("Image generation failed for combined output:", imageGenError.message, "Prompt:", combinedOutput.imageDescription);
                let imageErrorText = `\n\n(Note: Image generation failed. Error: ${imageGenError.message})`;
                // Attempt to extract a more specific message if available from the error structure
                if (imageGenError.message && imageGenError.message.includes("INVALID_ARGUMENT") && imageGenError.message.includes("message")) {
                     try {
                        const errorDetails = JSON.parse(imageGenError.message.substring(imageGenError.message.indexOf('{')));
                        if (errorDetails.error && errorDetails.error.message) {
                           imageErrorText = `\n\n(Note: Image generation failed. Detail: ${errorDetails.error.message})`;
                        }
                     } catch (e) { /* Ignore if parsing fails, stick to original message */ }
                }
                combinedOutput.textPart = (combinedOutput.textPart || "") + imageErrorText;
                // imagePart remains null
            }
        }
        return { type: 'combined', content: combinedOutput, fileName: `ai_combined_output_${Date.now()}`, originalUserHint: outputTypeHint };
    }


    if (serviceResponseType === 'table') {
      try {
        const parsedData = parseJsonResponseRobustly(responseText);
        if (Array.isArray(parsedData) && parsedData.every(item => typeof item === 'object' && item !== null)) {
          return { type: 'table', content: parsedData as DataRow[], fileName: `ai_generated_table_${Date.now()}`, originalUserHint: outputTypeHint };
        } else {
          // If AI was asked for table but returned something else (e.g. plain text explanation)
          console.warn("AI was asked for a table (JSON array) but returned a non-array structure. Raw response:", responseText);
          return { type: 'text', content: `AI did not return a valid table structure (JSON array) as requested. Raw AI response: ${responseText}`, originalUserHint: outputTypeHint };
        }
      } catch (e: any) {
        console.error("Failed to parse JSON response from AI for table/xlsx:", e.message, "\nRaw AI response for table/xlsx was:\n", responseText);
        return { type: 'text', content: `AI tried to return JSON for table/XLSX but it was malformed or not an array: ${e.message}. Raw AI response (see console for full text): '${responseText.substring(0,500)}...'`, originalUserHint: outputTypeHint };
      }
    }
    
    // For 'pptx' hint, Gemini is asked for JSON. The 'responseText' should be a JSON string.
    // The client-side parsing of this JSON string into PptxJsonData will happen in AiDocument.tsx.
    // Here, we just return it as 'text' type, but the client knows it's special based on originalUserHint.
    if (outputTypeHint === 'pptx') {
        // We expect responseText to be a JSON string.
        // We could try to parse it here to validate, but AiDocument.tsx will handle the actual parsing for PptxGenJS.
        return { type: 'text', content: responseText, originalUserHint: outputTypeHint, fileName: `ai_presentation_data_${Date.now()}` };
    }


    // Default to text response (this includes Markdown for 'msword', 'pdf')
    return { type: 'text', content: responseText, originalUserHint: outputTypeHint };

  } catch (error: any) {
    console.error("Error in AI document analysis:", error);
    let errorMessage = "An unknown error occurred during AI document analysis.";

    // Attempt to extract more specific error messages from Gemini API responses
    if (error.message && typeof error.message === 'string') {
        errorMessage = error.message;
        // Check if the error message itself contains a JSON-like structure with more details
        // This is common for Gemini API errors.
        // A more robust regex would be needed if the JSON can be deeply nested or complex.
        const errorRegex = new RegExp('\\{.*\\}', 's');
        const errorJsonMatch = error.message.match(errorRegex);
        if (errorJsonMatch && errorJsonMatch[0]) {
            try {
                const errorDetails = JSON.parse(errorJsonMatch[0]);
                if (errorDetails.error && errorDetails.error.message) {
                    errorMessage = `Gemini API Error: ${errorDetails.error.message}`;
                    if(errorDetails.error.status) errorMessage += ` (Status: ${errorDetails.error.status})`;
                    if(errorDetails.error.code) errorMessage += ` (Code: ${errorDetails.error.code})`;
                }
            } catch (jsonParseError) {
                // If parsing the error message fails, stick with the original message.
            }
        }
    } else if (typeof error === 'string') {
        errorMessage = error;
    }
    
    return { type: 'error', content: errorMessage, originalUserHint: outputTypeHint };
  }
};

// Function to parse JSON robustly (re-declared for standalone use if needed, though usually it's better to keep it as a helper within the service)
export const parseJsonResponse = (jsonString: string): any => {
    return parseJsonResponseRobustly(jsonString); // Delegate to the robust version
};
