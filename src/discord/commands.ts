/**
 * Discord slash command definitions
 */
import { SlashCommandBuilder } from '@discordjs/builders';
import { REST } from '@discordjs/rest';
import { Routes, RESTPostAPIChatInputApplicationCommandsJSONBody, ApplicationCommandType } from 'discord-api-types/v10';

// Message command for context menu (right-click on message)
const messageCommands = [
  {
    name: 'Generate Synopses',
    type: ApplicationCommandType.Message, // Type 3 = Message Command
  },
];

export const commands: (RESTPostAPIChatInputApplicationCommandsJSONBody | typeof messageCommands[0])[] = [
  new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn about Dewey and available commands')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Check if Dewey is awake')
    .toJSON(),

  new SlashCommandBuilder()
    .setName('synopsis')
    .setDescription('Get a spoiler-free book synopsis')
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('The book title')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('synopsis-batch')
    .setDescription('Get synopses for multiple books')
    .addStringOption(option =>
      option
        .setName('titles')
        .setDescription('Book titles (comma-separated or freeform text)')
        .setRequired(true)
    )
    .addBooleanOption(option =>
      option
        .setName('thread')
        .setDescription('Create a thread for the synopses')
        .setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('discussion')
    .setDescription('Generate discussion questions for a book')
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('The book title')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('content-warnings')
    .setDescription('Get content warnings and trigger warnings for a book')
    .addStringOption(option =>
      option
        .setName('title')
        .setDescription('The book title')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create a book poll with synopses thread')
    .addStringOption(option =>
      option
        .setName('books')
        .setDescription('Book titles (comma-separated, max 10)')
        .setRequired(true)
    )
    .addIntegerOption(option =>
      option
        .setName('duration')
        .setDescription('Poll duration in hours (default: 24, max: 168)')
        .setRequired(false)
        .setMinValue(1)
        .setMaxValue(168)
    )
    .addBooleanOption(option =>
      option
        .setName('multiple')
        .setDescription('Allow voting for multiple books (default: false)')
        .setRequired(false)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('recommend')
    .setDescription('Get book recommendations based on your favorites')
    .addStringOption(option =>
      option
        .setName('based_on')
        .setDescription('Book title(s) or description (e.g., "1984" or "dystopian sci-fi")')
        .setRequired(true)
    )
    .toJSON(),

  new SlashCommandBuilder()
    .setName('provider')
    .setDescription('Manage LLM provider settings')
    .addSubcommand(subcommand =>
      subcommand
        .setName('status')
        .setDescription('Check current provider and available options')
    )
    .addSubcommand(subcommand =>
      subcommand
        .setName('set')
        .setDescription('Set the LLM provider')
        .addStringOption(option =>
          option
            .setName('name')
            .setDescription('Provider name')
            .setRequired(true)
            .addChoices(
              { name: 'Gemini (Free)', value: 'gemini' },
              { name: 'Claude (Premium)', value: 'claude' }
            )
        )
    )
    .toJSON(),

  // Message command (right-click context menu)
  ...messageCommands,
];

/**
 * Register commands with Discord
 */
export async function registerCommands(
  appId: string,
  token: string,
  guildId?: string
): Promise<void> {
  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log('Started refreshing application (/) commands.');

    if (guildId) {
      // Register guild-specific commands (instant update, good for testing)
      await rest.put(
        Routes.applicationGuildCommands(appId, guildId),
        { body: commands }
      );
      console.log(`Successfully registered commands for guild ${guildId}`);
    } else {
      // Register global commands (takes up to 1 hour to propagate)
      await rest.put(
        Routes.applicationCommands(appId),
        { body: commands }
      );
      console.log('Successfully registered global commands');
    }
  } catch (error) {
    console.error('Error registering commands:', error);
    throw error;
  }
}
