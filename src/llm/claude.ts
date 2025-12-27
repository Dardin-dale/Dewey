/**
 * Anthropic Claude LLM Provider with web search
 */
import Anthropic from '@anthropic-ai/sdk';
import { LLMProvider, GenerationType } from '../types';

export class ClaudeProvider implements LLMProvider {
  public readonly name = 'claude';
  private client: Anthropic;

  constructor(apiKey: string) {
    this.client = new Anthropic({ apiKey });
  }

  public async generateSynopsis(bookTitle: string, _searchResults?: string): Promise<string> {
    return this.generate(bookTitle, undefined, 'synopsis');
  }

  public async generate(bookTitle: string, _searchResults?: string, type: GenerationType = 'synopsis', basedOn?: string): Promise<string> {
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
      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500, // Allow longer responses; splitContent() handles Discord chunking
        tools: [
          {
            type: 'web_search_20250305',
            name: 'web_search',
            max_uses: 3,
          } as any, // Web search tool for real-time book information
        ],
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ]
      });

      // Find text content in the response (may include tool use blocks)
      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      return textContent.text;
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  public async extractTitles(text: string): Promise<string[]> {
    const { TITLE_EXTRACTION_PROMPT, buildPrompt } = require('../prompts');
    const prompt = buildPrompt(TITLE_EXTRACTION_PROMPT, { text });

    try {
      const message = await this.client.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        messages: [{ role: 'user', content: prompt }]
      });

      const textContent = message.content.find(block => block.type === 'text');
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text content in Claude response');
      }

      // Parse JSON array from response
      const jsonMatch = textContent.text.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error('Could not find JSON array in response:', textContent.text);
        return [];
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Claude extractTitles error:', error);
      throw new Error(`Claude API error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
