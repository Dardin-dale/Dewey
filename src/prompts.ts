/**
 * Prompt templates and configuration
 */

export interface PromptConfig {
  synopsis: string;
  discussion: string;
  recommendations: string;
}

/**
 * Default prompts - can be overridden via environment or admin commands
 */
/**
 * Prompt for extracting book titles from freeform text
 */
export const TITLE_EXTRACTION_PROMPT = `Extract book titles from the following text. The text may contain:
- Casual conversation mixed with book titles
- "or" between alternative suggestions
- Partial series names
- Typos or informal references

Return ONLY a JSON array of book titles, nothing else. Be generous - if something looks like it could be a book title, include it.
Example output: ["The Great Gatsby", "1984", "Dune"]

Text to parse:
{text}`;

export const DEFAULT_PROMPTS: PromptConfig = {
  synopsis: `Provide a SPOILER-FREE synopsis for "{title}" suitable for someone deciding whether to read the book.

IMPORTANT RULES:
- NO SPOILERS: Do not reveal plot twists, character deaths, endings, or major revelations
- Focus on: premise, setting, main character's initial situation, themes, and tone
- This is for a book club - help them decide if they want to read it, don't summarize the whole plot
- Search for current information about this book

Format:
**{title}** by [Author]

[2-3 paragraph synopsis covering the premise, setting, and themes - NO plot spoilers]`,

  discussion: `Generate 5-6 thought-provoking discussion questions for the book "{title}".

These questions are for a book club meeting. Make them:
- Open-ended (no yes/no questions)
- Thought-provoking and encourage debate
- Cover themes, characters, plot, and author's craft
- Range from accessible to deeper analysis
- Relevant to the book's key themes and moments
- Search for information about this book to ensure accuracy

Format as a numbered list with brief context for each question when helpful.`,

  recommendations: `Based on {basedOn}, recommend 5 books that readers might enjoy.

For each recommendation, provide:
- Title and author
- Brief (1-2 sentence) description
- Why it's similar or would appeal to fans

Focus on quality recommendations that match the tone, themes, or style.
Format as a numbered list.`
};

/**
 * Load prompts from environment or use defaults
 */
export function getPrompts(): PromptConfig {
  return {
    synopsis: process.env.PROMPT_SYNOPSIS || DEFAULT_PROMPTS.synopsis,
    discussion: process.env.PROMPT_DISCUSSION || DEFAULT_PROMPTS.discussion,
    recommendations: process.env.PROMPT_RECOMMENDATIONS || DEFAULT_PROMPTS.recommendations,
  };
}

/**
 * Build a prompt from template
 */
export function buildPrompt(
  template: string,
  variables: Record<string, string>
): string {
  let prompt = template;

  for (const [key, value] of Object.entries(variables)) {
    prompt = prompt.replace(new RegExp(`{${key}}`, 'g'), value);
  }

  return prompt;
}

/**
 * Helper to build search context string
 */
export function buildSearchContext(searchResults?: string): string {
  if (!searchResults || searchResults.trim().length === 0) {
    return 'Include the author\'s name if known, main themes, and what makes this book notable.';
  }

  return `Here is some information I found about the book:\n${searchResults}\n\nBased on this information, please provide an accurate response.`;
}
