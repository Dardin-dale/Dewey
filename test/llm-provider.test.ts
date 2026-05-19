import { LLMProviderManager } from '../src/llm/provider';

describe('LLMProviderManager', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.GEMINI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test('reports no providers available when neither API key is set', () => {
    const manager = new LLMProviderManager();
    expect(manager.getAvailableProviders()).toEqual([]);
  });

  test('initializes gemini when GEMINI_API_KEY is set', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const manager = new LLMProviderManager('gemini');
    expect(manager.getAvailableProviders()).toContain('gemini');
    expect(manager.getAvailableProviders()).not.toContain('claude');
  });

  test('initializes both providers when both keys are set', () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.ANTHROPIC_API_KEY = 'claude-key';
    const manager = new LLMProviderManager();
    expect(manager.getAvailableProviders().sort()).toEqual(['claude', 'gemini']);
  });

  test('getProvider throws with a useful message when provider is not configured', () => {
    const manager = new LLMProviderManager('gemini');
    expect(() => manager.getProvider('gemini')).toThrow(
      /Provider 'gemini' not available/,
    );
  });

  test('setCurrentProvider rejects switching to an unconfigured provider', () => {
    process.env.GEMINI_API_KEY = 'test-key';
    const manager = new LLMProviderManager('gemini');
    expect(() => manager.setCurrentProvider('claude')).toThrow(
      /Provider 'claude' is not configured/,
    );
  });

  test('setCurrentProvider switches between configured providers', () => {
    process.env.GEMINI_API_KEY = 'gemini-key';
    process.env.ANTHROPIC_API_KEY = 'claude-key';
    const manager = new LLMProviderManager('gemini');
    expect(manager.getCurrentProvider()).toBe('gemini');
    manager.setCurrentProvider('claude');
    expect(manager.getCurrentProvider()).toBe('claude');
  });
});
