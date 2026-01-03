/**
 * Discord interaction handlers
 */
import {
  InteractionType,
  InteractionResponseType,
  APIInteraction,
  APIChatInputApplicationCommandInteraction,
  APIMessageApplicationCommandInteraction,
  ApplicationCommandType,
} from 'discord-api-types/v10';
import { getProviderManager } from '../llm/provider';
import { bookSearchService } from '../search';

export interface InteractionResponse {
  type: number;
  data?: any;
}

/**
 * Handle Discord interaction
 */
export async function handleInteraction(interaction: APIInteraction): Promise<InteractionResponse> {
  // Handle PING
  if (interaction.type === InteractionType.Ping) {
    return {
      type: InteractionResponseType.Pong,
    };
  }

  // Handle application commands
  if (interaction.type === InteractionType.ApplicationCommand) {
    // Check if it's a message command (context menu)
    if (interaction.data.type === ApplicationCommandType.Message) {
      return handleMessageCommand(interaction as APIMessageApplicationCommandInteraction);
    }

    // Handle slash commands
    const commandInteraction = interaction as APIChatInputApplicationCommandInteraction;
    const { name } = commandInteraction.data;

    switch (name) {
      case 'help':
        return handleHelpCommand();
      case 'ping':
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: '📚 Dewey is here and ready to help with your book club!',
          },
        };
      case 'synopsis':
        return handleSynopsisCommand(commandInteraction);
      case 'synopsis-batch':
        return handleSynopsisBatchCommand(commandInteraction);
      case 'discussion':
        return handleDiscussionCommand(commandInteraction);
      case 'content-warnings':
        return handleContentWarningsCommand(commandInteraction);
      case 'poll':
        return handlePollCommand(commandInteraction);
      case 'recommend':
        return handleRecommendCommand(commandInteraction);
      case 'provider':
        return handleProviderCommand(commandInteraction);
      default:
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `Unknown command: ${name}`,
            flags: 64, // Ephemeral
          },
        };
    }
  }

  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: 'Unknown interaction type',
      flags: 64,
    },
  };
}

/**
 * Handle /help command
 */
function handleHelpCommand(): InteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      embeds: [{
        title: '📚 Dewey - Your Book Club Assistant',
        description: 'Hi! I\'m Dewey, your friendly neighborhood librarian bot. I use AI with real-time web search to help your book club discover and discuss great reads.',
        color: 0x5865F2, // Discord blurple
        fields: [
          {
            name: '/synopsis [title]',
            value: 'Get a **spoiler-free** synopsis of any book. Perfect for deciding what to read next without ruining the story.',
          },
          {
            name: '/discussion [title]',
            value: 'Generate thoughtful discussion questions for your book club meeting. Covers themes, characters, and deeper analysis.',
          },
          {
            name: '/content-warnings [title]',
            value: 'Get content warnings and trigger warnings for a book before reading. Covers violence, mature themes, and more.',
          },
          {
            name: '/recommend [based_on]',
            value: 'Get personalized book recommendations. Try a title like "Project Hail Mary" or a description like "cozy mysteries with cats".',
          },
          {
            name: '/poll [books]',
            value: 'Create a book poll with auto-generated synopses thread. Comma-separated titles, optional instructions (e.g., "Vote for 3!"), duration and multi-vote.',
          },
          {
            name: 'Other Commands',
            value: '`/ping` - Check if I\'m awake\n`/provider status` - See which AI is powering responses\n`/synopsis-batch` - Get multiple synopses at once',
          },
        ],
        footer: {
          text: 'Powered by Gemini & Claude with web search',
        },
      }],
    },
  };
}

/**
 * Handle message command (right-click context menu)
 */
function handleMessageCommand(
  interaction: APIMessageApplicationCommandInteraction
): InteractionResponse {
  const { name } = interaction.data;

  if (name === 'Generate Synopses') {
    // Get the target message content from resolved data
    const targetMessageId = interaction.data.target_id;
    const targetMessage = interaction.data.resolved?.messages?.[targetMessageId];

    if (!targetMessage || !targetMessage.content) {
      return errorResponse('Could not read the message content');
    }

    // Defer response - processing happens async
    return {
      type: InteractionResponseType.DeferredChannelMessageWithSource,
    };
  }

  return errorResponse(`Unknown message command: ${name}`);
}

/**
 * Extract target message content from a message command interaction
 * Handles both regular messages and Discord poll messages
 */
export function getMessageCommandContent(
  interaction: APIMessageApplicationCommandInteraction
): string | null {
  const targetMessageId = interaction.data.target_id;
  const targetMessage = interaction.data.resolved?.messages?.[targetMessageId];

  if (!targetMessage) {
    return null;
  }

  // Check if this is a poll message
  const poll = (targetMessage as any).poll;
  if (poll && poll.answers && Array.isArray(poll.answers)) {
    // Extract titles from poll answers
    const titles = poll.answers
      .map((answer: any) => answer.poll_media?.text)
      .filter((text: string | undefined) => text && text.length > 0);

    if (titles.length > 0) {
      return titles.join(', ');
    }
  }

  // Fall back to regular message content
  return targetMessage?.content || null;
}

/**
 * Handle /synopsis command
 */
async function handleSynopsisCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<InteractionResponse> {
  const titleOption = interaction.data.options?.find(opt => opt.name === 'title');

  if (!titleOption || titleOption.type !== 3) {
    return errorResponse('Please provide a book title');
  }

  const bookTitle = titleOption.value;

  // Send deferred response since this might take a while
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  };
}

/**
 * Generate synopsis for a single book
 * This should be called after sending a deferred response
 */
export async function generateSynopsis(bookTitle: string): Promise<string> {
  try {
    const providerManager = getProviderManager();

    // Generate synopsis using current LLM provider (provider handles its own web search)
    console.log(`Generating synopsis for: ${bookTitle}`);
    console.log(`Using provider: ${providerManager.getCurrentProvider()}`);
    const synopsis = await providerManager.generateSynopsis(bookTitle);

    return synopsis;
  } catch (error) {
    console.error('Error generating synopsis:', error);
    throw error;
  }
}

/**
 * Handle /synopsis-batch command
 */
async function handleSynopsisBatchCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<InteractionResponse> {
  const titlesOption = interaction.data.options?.find(opt => opt.name === 'titles');

  if (!titlesOption || titlesOption.type !== 3) {
    return errorResponse('Please provide book titles (comma-separated or freeform text)');
  }

  const titlesString = titlesOption.value.trim();
  if (titlesString.length === 0) {
    return errorResponse('Please provide at least one book title');
  }

  // Send deferred response - parsing happens in processDeferred
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  };
}

/**
 * Parse book titles from input text
 * Tries simple parsing first, falls back to LLM extraction
 */
export async function parseTitles(input: string): Promise<string[]> {
  // Try simple comma/newline split first
  const simpleTitles = simpleParseTitle(input);

  // If simple parsing looks reasonable, use it
  if (isValidSimpleParse(simpleTitles)) {
    console.log('Using simple parse:', simpleTitles);
    return simpleTitles;
  }

  // Fall back to LLM extraction
  console.log('Simple parse failed, using LLM extraction');
  const providerManager = getProviderManager();
  const provider = providerManager.getProvider();
  const extractedTitles = await provider.extractTitles(input);
  console.log('LLM extracted titles:', extractedTitles);
  return extractedTitles;
}

/**
 * Simple title parsing - split by comma or newline
 */
function simpleParseTitle(input: string): string[] {
  // Try comma first
  if (input.includes(',')) {
    return input.split(',').map(t => t.trim()).filter(t => t.length > 0);
  }
  // Try newline
  if (input.includes('\n')) {
    return input.split('\n').map(t => t.trim()).filter(t => t.length > 0);
  }
  // Single title
  return [input.trim()];
}

/**
 * Check if simple parse produced valid-looking titles
 */
function isValidSimpleParse(titles: string[]): boolean {
  if (titles.length === 0) return false;

  // Check each title for issues
  for (const title of titles) {
    // Title too long (probably has extra text)
    if (title.length > 100) return false;
    // Contains "or" suggesting alternatives (e.g., "Book A or Book B")
    if (/\bor\b/i.test(title)) return false;
    // Contains conversational patterns
    if (/\b(we|you|should|talked|about|add|any|others|thinking)\b/i.test(title)) return false;
    // Ends with ellipsis or similar
    if (/[….]$/.test(title)) return false;
  }

  return true;
}

/**
 * Result of a single synopsis generation
 */
export interface SynopsisResult {
  title: string;
  content: string;
  error?: boolean;
}

/**
 * Generate synopses for multiple books in parallel
 * Returns results in the same order as input titles
 */
export async function generateBatchSynopses(titles: string[]): Promise<SynopsisResult[]> {
  const providerManager = getProviderManager();

  // Process all titles in parallel
  const promises = titles.map(async (title): Promise<SynopsisResult> => {
    try {
      console.log(`Starting synopsis for: ${title}`);
      const synopsis = await providerManager.generateSynopsis(title);
      console.log(`Completed synopsis for: ${title}`);
      return {
        title,
        content: `## ${title}\n\n${synopsis}`,
      };
    } catch (error) {
      console.error(`Error generating synopsis for ${title}:`, error);
      return {
        title,
        content: `## ${title}\n\n❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        error: true,
      };
    }
  });

  // Wait for all to complete - results maintain order
  const results = await Promise.all(promises);
  console.log(`Completed ${results.length} synopses`);
  return results;
}

/**
 * Handle /provider command
 */
async function handleProviderCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<InteractionResponse> {
  const subcommand = interaction.data.options?.[0];

  if (!subcommand) {
    return errorResponse('Invalid provider command');
  }

  const providerManager = getProviderManager();

  switch (subcommand.name) {
    case 'status':
      const current = providerManager.getCurrentProvider();
      const available = providerManager.getAvailableProviders();
      return {
        type: InteractionResponseType.ChannelMessageWithSource,
        data: {
          embeds: [{
            title: 'LLM Provider Status',
            fields: [
              {
                name: 'Current Provider',
                value: current.toUpperCase(),
                inline: true,
              },
              {
                name: 'Available Providers',
                value: available.join(', ').toUpperCase(),
                inline: true,
              },
            ],
            color: 0x00ff00,
          }],
          flags: 64, // Ephemeral
        },
      };

    case 'set':
      const nameOption = (subcommand as any).options?.find((opt: any) => opt.name === 'name');
      if (!nameOption || nameOption.type !== 3) {
        return errorResponse('Invalid provider name');
      }

      const providerName = nameOption.value as 'gemini' | 'claude';

      try {
        providerManager.setCurrentProvider(providerName);
        return {
          type: InteractionResponseType.ChannelMessageWithSource,
          data: {
            content: `✅ Provider switched to **${providerName.toUpperCase()}**`,
            flags: 64, // Ephemeral
          },
        };
      } catch (error) {
        return errorResponse(error instanceof Error ? error.message : 'Failed to set provider');
      }

    default:
      return errorResponse('Unknown provider subcommand');
  }
}

/**
 * Handle /discussion command
 */
async function handleDiscussionCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<InteractionResponse> {
  const titleOption = interaction.data.options?.find(opt => opt.name === 'title');

  if (!titleOption || titleOption.type !== 3) {
    return errorResponse('Please provide a book title');
  }

  // Send deferred response
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  };
}

/**
 * Handle /content-warnings command
 */
async function handleContentWarningsCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<InteractionResponse> {
  const titleOption = interaction.data.options?.find(opt => opt.name === 'title');

  if (!titleOption || titleOption.type !== 3) {
    return errorResponse('Please provide a book title');
  }

  // Send deferred response
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  };
}

/**
 * Handle /poll command
 */
async function handlePollCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<InteractionResponse> {
  const booksOption = interaction.data.options?.find(opt => opt.name === 'books');

  if (!booksOption || booksOption.type !== 3) {
    return errorResponse('Please provide book titles');
  }

  const booksString = booksOption.value.trim();
  if (booksString.length === 0) {
    return errorResponse('Please provide at least one book title');
  }

  // Parse titles (simple comma split for polls)
  const titles = booksString.split(',').map(t => t.trim()).filter(t => t.length > 0);

  if (titles.length < 2) {
    return errorResponse('Please provide at least 2 book titles for a poll');
  }

  if (titles.length > 10) {
    return errorResponse('Discord polls support a maximum of 10 options');
  }

  // Send deferred response (ephemeral while we create the poll)
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: {
      flags: 64, // Ephemeral
    },
  };
}

/**
 * Generate discussion questions for a book
 */
export async function generateDiscussionQuestions(bookTitle: string): Promise<string> {
  try {
    const providerManager = getProviderManager();

    // Search for book information
    console.log(`Searching for: ${bookTitle}`);
    const searchResults = await bookSearchService.searchBook(bookTitle);

    // Generate discussion questions using current LLM provider
    console.log(`Generating discussion questions with ${providerManager.getCurrentProvider()}`);
    const provider = providerManager.getProvider();
    const questions = await provider.generate(bookTitle, searchResults, 'discussion');

    return `# Discussion Questions: ${bookTitle}\n\n${questions}`;
  } catch (error) {
    console.error('Error generating discussion questions:', error);
    throw error;
  }
}

/**
 * Generate content warnings for a book
 */
export async function generateContentWarnings(bookTitle: string): Promise<string> {
  try {
    const providerManager = getProviderManager();

    // Generate content warnings using current LLM provider (with web search)
    console.log(`Generating content warnings for: ${bookTitle}`);
    console.log(`Using provider: ${providerManager.getCurrentProvider()}`);
    const provider = providerManager.getProvider();
    const warnings = await provider.generate(bookTitle, undefined, 'content-warnings');

    return warnings;
  } catch (error) {
    console.error('Error generating content warnings:', error);
    throw error;
  }
}

/**
 * Handle /recommend command
 */
async function handleRecommendCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<InteractionResponse> {
  const basedOnOption = interaction.data.options?.find(opt => opt.name === 'based_on');

  if (!basedOnOption || basedOnOption.type !== 3) {
    return errorResponse('Please provide a book title or description');
  }

  // Send deferred response
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
  };
}

/**
 * Generate book recommendations
 */
export async function generateRecommendations(basedOn: string): Promise<string> {
  try {
    const providerManager = getProviderManager();

    console.log(`Generating recommendations based on: ${basedOn}`);
    const provider = providerManager.getProvider();

    // Use the basedOn text as both title and context
    const recommendations = await provider.generate(basedOn, undefined, 'recommendations', basedOn);

    return `# Book Recommendations\n\nBased on: **${basedOn}**\n\n${recommendations}\n\n_💡 Tip: Recommendations are AI-generated and may vary. Always check reviews!_`;
  } catch (error) {
    console.error('Error generating recommendations:', error);
    throw error;
  }
}

/**
 * Helper to create error response
 */
function errorResponse(message: string): InteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content: `❌ ${message}`,
      flags: 64, // Ephemeral
    },
  };
}
