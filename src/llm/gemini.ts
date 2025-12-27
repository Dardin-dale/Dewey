/**
 * Google Gemini LLM Provider with Google Search grounding
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import { LLMProvider, GenerationType } from '../types';

export class GeminiProvider implements LLMProvider {
  public readonly name = 'gemini';
  private genAI: GoogleGenerativeAI;

  constructor(apiKey: string) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  public async generateSynopsis(bookTitle: string, _searchResults?: string): Promise<string> {
    return this.generate(bookTitle, undefined, 'synopsis');
  }

  public async generate(bookTitle: string, _searchResults?: string, type: GenerationType = 'synopsis', basedOn?: string): Promise<string> {
    // Enable Google Search grounding for real-time book information
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-3-flash-preview',
      tools: [{ googleSearch: {} } as any], // Google Search grounding tool
      generationConfig: {
        maxOutputTokens: 1500, // Allow longer responses; splitContent() handles Discord chunking
        thinkingConfig: {
          thinkingBudget: 1024, // Separate budget for internal reasoning
        },
      } as any,
    });

    const { getPrompts, buildPrompt } = require('../prompts');
    const prompts = getPrompts();

    let template: string;
    const variables: Record<string, string> = {
      title: bookTitle,
    };

    if (type === 'recommendations') {
      template = prompts.recommendations;
      variables.basedOn = basedOn || `the book "${bookTitle}"`;
    } else if (type === 'discussion') {
      template = prompts.discussion;
    } else if (type === 'content-warnings') {
      template = prompts.contentWarnings;
    } else {
      template = prompts.synopsis;
    }

    const prompt = buildPrompt(template, variables);

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;

      // Debug: log the full response structure
      console.log('Gemini response candidates:', JSON.stringify(response.candidates, null, 2));

      // Extract text from all parts
      const text = response.text();
      console.log('Gemini text() result length:', text.length);

      return text;
    } catch (error) {
      console.error('Gemini API error:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async extractTitles(text: string): Promise<string[]> {
    // Use a simple model without search for fast title extraction
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-2.0-flash',
      generationConfig: {
        maxOutputTokens: 500,
      },
    });

    const { TITLE_EXTRACTION_PROMPT, buildPrompt } = require('../prompts');
    const prompt = buildPrompt(TITLE_EXTRACTION_PROMPT, { text });

    try {
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const responseText = response.text();

      // Parse JSON array from response
      const jsonMatch = responseText.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Could not find JSON array in response:', responseText);
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Gemini extractTitles error:', error);
      throw new Error(`Gemini API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
