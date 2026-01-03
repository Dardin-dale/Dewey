/**
 * AWS Lambda handler for Discord interactions
 */
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { LambdaClient, InvokeCommand } from '@aws-sdk/client-lambda';
import { verifyKey } from 'discord-interactions';
import { APIInteraction, InteractionType, APIChatInputApplicationCommandInteraction, APIMessageApplicationCommandInteraction, ApplicationCommandType } from 'discord-api-types/v10';
import {
  handleInteraction,
  generateSynopsis,
  generateBatchSynopses,
  generateDiscussionQuestions,
  generateContentWarnings,
  generateRecommendations,
  parseTitles,
  SynopsisResult,
  getMessageCommandContent,
} from './discord/handler';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config();

const lambdaClient = new LambdaClient({});

/**
 * Event type for async deferred processing
 */
interface DeferredProcessingEvent {
  type: 'deferred_processing';
  interaction: APIChatInputApplicationCommandInteraction | APIMessageApplicationCommandInteraction;
}

/**
 * Main Lambda handler - handles both API Gateway and async invocations
 */
export async function handler(
  event: APIGatewayProxyEvent | DeferredProcessingEvent
): Promise<APIGatewayProxyResult | void> {
  // Check if this is an async deferred processing invocation
  if ('type' in event && event.type === 'deferred_processing') {
    console.log('Processing deferred interaction async');
    await processDeferred(event.interaction);
    return;
  }

  // Otherwise, this is an API Gateway event
  const apiEvent = event as APIGatewayProxyEvent;
  console.log('Received API Gateway event:', JSON.stringify(apiEvent, null, 2));

  // Verify Discord signature
  const signature = apiEvent.headers['x-signature-ed25519'];
  const timestamp = apiEvent.headers['x-signature-timestamp'];
  const rawBody = apiEvent.body || '';

  const publicKey = process.env.DISCORD_BOT_PUBLIC_KEY;
  if (!publicKey) {
    console.error('DISCORD_BOT_PUBLIC_KEY not set');
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Server configuration error' }),
    };
  }

  if (!signature || !timestamp) {
    console.error('Missing signature or timestamp');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Missing signature or timestamp' }),
    };
  }

  const isValidRequest = await verifyKey(rawBody, signature, timestamp, publicKey);

  if (!isValidRequest) {
    console.error('Invalid request signature');
    return {
      statusCode: 401,
      body: JSON.stringify({ error: 'Invalid request signature' }),
    };
  }

  // Parse interaction
  const interaction: APIInteraction = JSON.parse(rawBody);

  // Handle the interaction
  try {
    const response = await handleInteraction(interaction);

    // If it's a deferred response, invoke self asynchronously for processing
    if (response.type === 5) { // DeferredChannelMessageWithSource
      const functionName = process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (functionName) {
        console.log('Invoking self async for deferred processing');
        const payload: DeferredProcessingEvent = {
          type: 'deferred_processing',
          interaction: interaction as APIChatInputApplicationCommandInteraction,
        };

        await lambdaClient.send(new InvokeCommand({
          FunctionName: functionName,
          InvocationType: 'Event', // Async invocation
          Payload: JSON.stringify(payload),
        }));
      } else {
        console.error('AWS_LAMBDA_FUNCTION_NAME not set, cannot process deferred');
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error handling interaction:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
}

/**
 * Process deferred interactions asynchronously
 */
async function processDeferred(interaction: APIChatInputApplicationCommandInteraction | APIMessageApplicationCommandInteraction): Promise<void> {
  const { name } = interaction.data;
  const interactionType = (interaction.data as any).type;
  console.log(`processDeferred: command="${name}", type=${interactionType}, isMessageCommand=${interactionType === ApplicationCommandType.Message}`);

  try {
    // Handle message commands (context menu)
    if (interaction.data.type === ApplicationCommandType.Message) {
      console.log('Taking message command path');
      const messageInteraction = interaction as APIMessageApplicationCommandInteraction;

      if (name === 'Generate Synopses') {
        const messageContent = getMessageCommandContent(messageInteraction);

        if (!messageContent) {
          await sendFollowUp(messageInteraction, '❌ Could not read the message content');
          return;
        }

        // Parse titles from the message
        const titles = await parseTitles(messageContent);

        if (titles.length === 0) {
          await sendFollowUp(messageInteraction, '❌ Could not find any book titles in that message');
          return;
        }

        if (titles.length > 10) {
          await sendFollowUp(messageInteraction, `❌ Too many books (${titles.length}). Maximum 10 per batch.`);
          return;
        }

        // Create a thread from the target message
        const targetMessageId = messageInteraction.data.target_id;
        const channelId = messageInteraction.channel?.id || messageInteraction.channel_id;

        const threadId = await createThreadFromMessage(
          channelId!,
          targetMessageId,
          `📚 Book Synopses (${titles.length} books)`
        );

        if (!threadId) {
          // Fall back to regular follow-up if thread creation fails
          console.log('Thread creation failed for message command, falling back to channel');
          await sendFollowUp(messageInteraction, `📚 Processing ${titles.length} book(s): ${titles.join(', ')}\n\n_Synopses will appear below as they complete..._`);
          const results = await generateBatchSynopses(titles);
          await sendBatchResults(messageInteraction, results);
          return;
        }

        console.log(`Message command: Created thread ${threadId}, sending synopses there`);

        // Post initial list to the thread
        console.log(`Sending initial list to thread ${threadId}`);
        await sendToThread(threadId, `Processing synopses for:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);

        // Generate synopses in parallel
        console.log('Generating synopses...');
        const results = await generateBatchSynopses(titles);
        console.log(`Generated ${results.length} synopses, sending to thread ${threadId}`);

        // Send each synopsis to the thread in order
        await sendBatchToThread(threadId, results);
        console.log('All synopses sent to thread');

        // Send ephemeral acknowledgment (required to complete the deferred interaction)
        await sendFollowUp(messageInteraction, `✅ Synopses generated for ${titles.length} book(s) in thread.`, true);
        return;
      }

      await sendFollowUp(messageInteraction, '❌ Unknown message command');
      return;
    }

    // Handle slash commands
    const slashInteraction = interaction as APIChatInputApplicationCommandInteraction;

    if (name === 'synopsis-batch') {
      // Handle batch processing separately - sends multiple messages in order
      const titlesOption = slashInteraction.data.options?.find(opt => opt.name === 'titles');
      const titlesString = titlesOption && titlesOption.type === 3 ? titlesOption.value : '';
      const threadOption = slashInteraction.data.options?.find(opt => opt.name === 'thread');
      const useThread = threadOption && threadOption.type === 5 ? threadOption.value : false;

      // Parse titles (smart parsing with LLM fallback)
      const titles = await parseTitles(titlesString);

      if (titles.length === 0) {
        await sendFollowUp(slashInteraction, '❌ Could not find any book titles in your input');
        return;
      }

      if (titles.length > 10) {
        await sendFollowUp(slashInteraction, `❌ Too many books (${titles.length}). Maximum 10 per batch.`);
        return;
      }

      // Create thread if requested
      if (useThread) {
        const channelId = slashInteraction.channel?.id || slashInteraction.channel_id;
        const threadId = await createStandaloneThread(
          channelId!,
          `📚 Book Synopses (${titles.length} books)`
        );

        if (threadId) {
          // Post initial list to thread
          console.log(`Sending to thread ${threadId}`);
          await sendToThread(threadId, `Processing synopses for:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);

          const results = await generateBatchSynopses(titles);
          console.log(`Sending ${results.length} results to thread ${threadId}`);
          await sendBatchToThread(threadId, results);
          console.log('Batch to thread complete');

          // Send ephemeral acknowledgment
          await sendFollowUp(slashInteraction, `✅ Synopses generated for ${titles.length} book(s) in thread.`, true);
          return;
        }
        // Fall through to regular behavior if thread creation fails
        console.log('Thread creation failed, falling back to channel');
      }

      // Send initial message with parsed titles
      await sendFollowUp(slashInteraction, `📚 Processing ${titles.length} book(s): ${titles.join(', ')}\n\n_Synopses will appear below as they complete..._`);

      // Generate synopses in parallel
      const results = await generateBatchSynopses(titles);

      // Send each synopsis in order
      await sendBatchResults(slashInteraction, results);
      return;
    }

    let content: string;

    if (name === 'synopsis') {
      const titleOption = slashInteraction.data.options?.find(opt => opt.name === 'title');
      const bookTitle = titleOption && titleOption.type === 3 ? titleOption.value : '';
      content = await generateSynopsis(bookTitle);
    } else if (name === 'discussion') {
      const titleOption = slashInteraction.data.options?.find(opt => opt.name === 'title');
      const bookTitle = titleOption && titleOption.type === 3 ? titleOption.value : '';
      content = await generateDiscussionQuestions(bookTitle);
    } else if (name === 'content-warnings') {
      const titleOption = slashInteraction.data.options?.find(opt => opt.name === 'title');
      const bookTitle = titleOption && titleOption.type === 3 ? titleOption.value : '';
      content = await generateContentWarnings(bookTitle);
    } else if (name === 'poll') {
      await processPollCommand(slashInteraction);
      return; // Poll handles its own responses
    } else if (name === 'recommend') {
      const basedOnOption = slashInteraction.data.options?.find(opt => opt.name === 'based_on');
      const basedOn = basedOnOption && basedOnOption.type === 3 ? basedOnOption.value : '';
      content = await generateRecommendations(basedOn);
    } else {
      content = 'Unknown command';
    }

    // Send follow-up message
    await sendFollowUp(slashInteraction, content);
  } catch (error) {
    console.error('Error processing deferred interaction:', error);
    await sendFollowUp(
      interaction as APIChatInputApplicationCommandInteraction,
      `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`
    );
  }
}

/**
 * Create a standalone thread (not attached to a message)
 */
async function createStandaloneThread(
  channelId: string,
  threadName: string
): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_SECRET_TOKEN;
  if (!botToken) {
    console.error('DISCORD_BOT_SECRET_TOKEN not set, cannot create thread');
    return null;
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/threads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({
          name: threadName.substring(0, 100),
          type: 11, // Public thread
          auto_archive_duration: 1440,
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create standalone thread:', response.status, errorText);
      return null;
    }

    const thread = await response.json() as { id: string; name: string };
    console.log('Created standalone thread:', thread.id, thread.name);
    return thread.id;
  } catch (error) {
    console.error('Error creating standalone thread:', error);
    return null;
  }
}

/**
 * Create a thread from a message
 */
async function createThreadFromMessage(
  channelId: string,
  messageId: string,
  threadName: string
): Promise<string | null> {
  const botToken = process.env.DISCORD_BOT_SECRET_TOKEN;
  if (!botToken) {
    console.error('DISCORD_BOT_SECRET_TOKEN not set, cannot create thread');
    return null;
  }

  try {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}/threads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({
          name: threadName.substring(0, 100), // Thread names max 100 chars
          auto_archive_duration: 1440, // Archive after 24 hours of inactivity
        }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to create thread:', response.status, errorText);
      return null;
    }

    const thread = await response.json() as { id: string; name: string };
    console.log('Created thread:', thread.id, thread.name);
    return thread.id;
  } catch (error) {
    console.error('Error creating thread:', error);
    return null;
  }
}

/**
 * Send a message to a thread
 */
async function sendToThread(threadId: string, content: string): Promise<void> {
  const botToken = process.env.DISCORD_BOT_SECRET_TOKEN;
  if (!botToken) {
    console.error('DISCORD_BOT_SECRET_TOKEN not set');
    return;
  }

  const chunks = splitContent(content);

  for (let i = 0; i < chunks.length; i++) {
    const response = await fetch(
      `https://discord.com/api/v10/channels/${threadId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({ content: chunks[i] }),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Failed to send to thread:', response.status, errorText);
      break;
    }

    if (i < chunks.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 250));
    }
  }
}

/**
 * Send batch results to a thread in order
 */
async function sendBatchToThread(threadId: string, results: SynopsisResult[]): Promise<void> {
  console.log(`Sending ${results.length} batch results to thread ${threadId}`);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    console.log(`Sending synopsis ${i + 1}/${results.length}: ${result.title}`);

    await sendToThread(threadId, result.content);

    // Delay between synopses
    if (i < results.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('All batch results sent to thread');
}

/**
 * Split content into chunks that fit Discord's 2000 char limit
 * Tries to split at paragraph boundaries for cleaner messages
 */
function splitContent(content: string, maxLength: number = 1900): string[] {
  if (content.length <= maxLength) {
    return [content];
  }

  const chunks: string[] = [];
  let remaining = content;

  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }

    // Try to find a good split point (paragraph, then newline, then space)
    let splitIndex = remaining.lastIndexOf('\n\n', maxLength);
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf('\n', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = remaining.lastIndexOf(' ', maxLength);
    }
    if (splitIndex === -1 || splitIndex < maxLength / 2) {
      splitIndex = maxLength; // Hard cut as last resort
    }

    chunks.push(remaining.substring(0, splitIndex).trim());
    remaining = remaining.substring(splitIndex).trim();
  }

  return chunks;
}

/**
 * Send follow-up message to Discord
 * Splits long content into multiple messages if needed
 * @param ephemeral - If true, message is only visible to the user who triggered the interaction
 */
async function sendFollowUp(
  interaction: APIChatInputApplicationCommandInteraction | APIMessageApplicationCommandInteraction,
  content: string,
  ephemeral: boolean = false
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`;

  try {
    console.log('Sending follow-up to Discord');
    console.log(`Content length: ${content.length} chars, ephemeral: ${ephemeral}`);

    const chunks = splitContent(content);
    console.log(`Splitting into ${chunks.length} message(s)`);

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      console.log(`Sending chunk ${i + 1}/${chunks.length} (${chunk.length} chars)`);

      const body: { content: string; flags?: number } = { content: chunk };
      if (ephemeral) {
        body.flags = 64; // Ephemeral flag
      }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Discord API error:', response.status, errorText);
        break; // Stop sending if we hit an error
      }

      // Small delay between messages to avoid rate limiting
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    console.log('Follow-up(s) sent successfully');
  } catch (error) {
    console.error('Error sending follow-up:', error);
  }
}

/**
 * Send batch synopsis results to Discord in order
 * Each synopsis is sent as a separate message (or multiple if too long)
 */
async function sendBatchResults(
  interaction: APIChatInputApplicationCommandInteraction | APIMessageApplicationCommandInteraction,
  results: SynopsisResult[]
): Promise<void> {
  const url = `https://discord.com/api/v10/webhooks/${interaction.application_id}/${interaction.token}`;

  console.log(`Sending ${results.length} batch results to Discord`);

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    console.log(`Sending synopsis ${i + 1}/${results.length}: ${result.title}`);

    // Split this synopsis if needed
    const chunks = splitContent(result.content);

    for (let j = 0; j < chunks.length; j++) {
      const chunk = chunks[j];

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: chunk,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Discord API error:', response.status, errorText);
        // Continue with next synopsis even if one fails
        break;
      }

      // Delay between chunks
      if (j < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 250));
      }
    }

    // Delay between synopses
    if (i < results.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }

  console.log('All batch results sent');
}

/**
 * Process /poll command - creates a Discord poll with a synopses thread
 */
async function processPollCommand(
  interaction: APIChatInputApplicationCommandInteraction
): Promise<void> {
  const botToken = process.env.DISCORD_BOT_SECRET_TOKEN;
  if (!botToken) {
    await sendFollowUp(interaction, '❌ Bot token not configured');
    return;
  }

  // Parse options
  const booksOption = interaction.data.options?.find(opt => opt.name === 'books');
  const instructionsOption = interaction.data.options?.find(opt => opt.name === 'instructions');
  const durationOption = interaction.data.options?.find(opt => opt.name === 'duration');
  const multipleOption = interaction.data.options?.find(opt => opt.name === 'multiple');

  const booksString = booksOption && booksOption.type === 3 ? booksOption.value : '';
  const instructions = instructionsOption && instructionsOption.type === 3 ? instructionsOption.value : '';
  const duration = durationOption && durationOption.type === 4 ? durationOption.value : 24;
  const allowMultiple = multipleOption && multipleOption.type === 5 ? multipleOption.value : false;

  // Parse titles
  const titles = booksString.split(',').map(t => t.trim()).filter(t => t.length > 0);

  if (titles.length < 2 || titles.length > 10) {
    await sendFollowUp(interaction, '❌ Please provide 2-10 book titles');
    return;
  }

  const channelId = interaction.channel?.id || interaction.channel_id;
  if (!channelId) {
    await sendFollowUp(interaction, '❌ Could not determine channel');
    return;
  }

  try {
    // Build poll question (max 300 chars per Discord API)
    let pollQuestion = '📚 Which book should we read next?';
    if (instructions) {
      pollQuestion = `📚 Which book should we read next? ${instructions}`.substring(0, 300);
    }

    // Create poll message via Discord API
    const pollResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({
          poll: {
            question: { text: pollQuestion },
            answers: titles.map(title => ({
              poll_media: { text: title.substring(0, 55) } // Discord limit
            })),
            duration: duration,
            allow_multiselect: allowMultiple,
          },
        }),
      }
    );

    if (!pollResponse.ok) {
      const errorText = await pollResponse.text();
      console.error('Failed to create poll:', pollResponse.status, errorText);
      await sendFollowUp(interaction, '❌ Failed to create poll. Check bot permissions.');
      return;
    }

    const pollMessage = await pollResponse.json() as { id: string };
    console.log('Created poll message:', pollMessage.id);

    // Create thread from poll message
    const threadResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages/${pollMessage.id}/threads`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bot ${botToken}`,
        },
        body: JSON.stringify({
          name: `📖 Book Synopses (${titles.length} options)`.substring(0, 100),
          auto_archive_duration: 1440,
        }),
      }
    );

    if (!threadResponse.ok) {
      const errorText = await threadResponse.text();
      console.error('Failed to create thread:', threadResponse.status, errorText);
      await sendFollowUp(interaction, '✅ Poll created! (Could not create synopses thread)', true);
      return;
    }

    const thread = await threadResponse.json() as { id: string };
    console.log('Created thread:', thread.id);

    // Send ephemeral confirmation
    await sendFollowUp(interaction, `✅ Poll created with ${titles.length} books! Generating synopses in thread...`, true);

    // Post initial message to thread
    await sendToThread(thread.id, `Generating synopses for:\n${titles.map((t, i) => `${i + 1}. ${t}`).join('\n')}`);

    // Generate synopses in parallel
    const results = await generateBatchSynopses(titles);

    // Send each synopsis to the thread
    await sendBatchToThread(thread.id, results);

    console.log('Poll and synopses complete');
  } catch (error) {
    console.error('Error processing poll:', error);
    await sendFollowUp(interaction, `❌ Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
