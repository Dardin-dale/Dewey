/**
 * Core types for Dewey bot
 */

export interface BookSynopsis {
  title: string;
  author?: string;
  synopsis: string;
  source?: string;
  error?: string;
}

export interface LLMProviderConfig {
  name: 'gemini' | 'claude';
  apiKey: string;
}

export interface LLMProvider {
  name: string;
  generateSynopsis(bookTitle: string, searchResults?: string): Promise<string>;
  generate(bookTitle: string, searchResults?: string, type?: 'synopsis' | 'discussion' | 'recommendations', basedOn?: string): Promise<string>;
  extractTitles(text: string): Promise<string[]>;
}

export interface WebSearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface ProviderStatus {
  current: 'gemini' | 'claude';
  available: string[];
}
