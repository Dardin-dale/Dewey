/**
 * LLM Provider abstraction
 */
import { LLMProvider, LLMProviderConfig } from '../types';
import { GeminiProvider } from './gemini';
import { ClaudeProvider } from './claude';

export class LLMProviderManager {
  private providers: Map<string, LLMProvider> = new Map();
  private currentProvider: string;

  constructor(defaultProvider: 'gemini' | 'claude' = 'gemini') {
    this.currentProvider = defaultProvider;
    this.initializeProviders();
  }

  private initializeProviders(): void {
    // Initialize Gemini if API key is available
    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      this.providers.set('gemini', new GeminiProvider(geminiKey));
    }

    // Initialize Claude if API key is available
    const claudeKey = process.env.ANTHROPIC_API_KEY;
    if (claudeKey) {
      this.providers.set('claude', new ClaudeProvider(claudeKey));
    }
  }

  public getProvider(name?: string): LLMProvider {
    const providerName = name || this.currentProvider;
    const provider = this.providers.get(providerName);

    if (!provider) {
      const available = Array.from(this.providers.keys());
      throw new Error(
        `Provider '${providerName}' not available. Available providers: ${available.join(', ')}`
      );
    }

    return provider;
  }

  public setCurrentProvider(name: 'gemini' | 'claude'): void {
    if (!this.providers.has(name)) {
      throw new Error(`Provider '${name}' is not configured`);
    }
    this.currentProvider = name;
  }

  public getCurrentProvider(): string {
    return this.currentProvider;
  }

  public getAvailableProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  public async generateSynopsis(
    bookTitle: string,
    searchResults?: string,
    providerName?: string
  ): Promise<string> {
    const provider = this.getProvider(providerName);
    return provider.generateSynopsis(bookTitle, searchResults);
  }
}

// Global singleton instance
let providerManager: LLMProviderManager | null = null;

export function getProviderManager(): LLMProviderManager {
  if (!providerManager) {
    const defaultProvider = (process.env.DEFAULT_LLM_PROVIDER as 'gemini' | 'claude') || 'gemini';
    providerManager = new LLMProviderManager(defaultProvider);
  }
  return providerManager;
}
