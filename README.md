# Dewey

A Discord bot for book clubs. Dewey provides spoiler-free synopses, discussion questions, and book recommendations powered by AI with real-time web search.

## Features

### Slash Commands
- **/synopsis [title]** - Get a spoiler-free book synopsis perfect for deciding what to read next
- **/discussion [title]** - Generate thought-provoking discussion questions for your book club meeting
- **/recommend [based_on]** - Get personalized book recommendations based on a title or description
- **/synopsis-batch [titles] [thread]** - Get synopses for multiple books at once
  - Accepts comma-separated titles or freeform text (AI extracts book titles)
  - Optional `thread:true` to create a thread for the synopses
- **/provider status/set** - View or switch between AI providers (Gemini/Claude)

### Message Commands (Right-Click Menu)
- **Generate Synopses** - Right-click any message → Apps → Generate Synopses
  - Extracts book titles from the message and generates synopses
  - Automatically creates a thread attached to the original message

## Tech Stack

- **Runtime**: AWS Lambda (Node.js 20)
- **Infrastructure**: AWS CDK (TypeScript)
- **AI Providers**:
  - Google Gemini 3 Flash with Google Search grounding
  - Anthropic Claude Haiku with web search
- **Discord**: Slash commands and message commands with deferred responses

## Bot Permissions

When adding Dewey to your server, ensure these permissions are granted:

### Required Permissions
| Permission | Reason |
|------------|--------|
| Send Messages | Reply to commands |
| Send Messages in Threads | Post synopses in threads |
| Create Public Threads | Create threads for batch synopses |
| Read Message History | Read target messages for "Generate Synopses" command |
| Use Application Commands | Enable slash commands |

### OAuth2 Scopes
- `bot` - Required for sending messages and creating threads
- `applications.commands` - Required for slash commands and message commands

### Invite URL
Generate an invite URL in the Discord Developer Portal → OAuth2 → URL Generator with:
- Scopes: `bot`, `applications.commands`
- Permissions: Send Messages, Send Messages in Threads, Create Public Threads, Read Message History

## Setup

### Prerequisites

- Node.js 20+
- AWS CLI configured with credentials
- Discord application with bot token

### Environment Variables

Create a `.env` file:

```env
DISCORD_APP_ID=your_app_id
DISCORD_BOT_PUBLIC_KEY=your_public_key
DISCORD_BOT_SECRET_TOKEN=your_bot_token
DISCORD_SERVER_ID=your_guild_id  # Optional, for instant command registration

GEMINI_API_KEY=your_gemini_key
ANTHROPIC_API_KEY=your_claude_key
```

### Installation

```bash
npm install
```

### Deploy

```bash
npx cdk deploy
```

After deploying, set the **Interactions Endpoint URL** in your Discord application settings to the URL output by the deploy command.

### Register Commands

```bash
npm run build && npm run register-commands
```

## Development

```bash
# Build TypeScript
npm run build

# Deploy changes
npx cdk deploy

# View Lambda logs
aws logs tail /aws/lambda/DeweyStack-DiscordHandler... --follow
```

## Architecture

Dewey uses Discord's deferred response pattern for AI operations:

1. User sends a slash command
2. Lambda immediately returns a "thinking..." response
3. Lambda invokes itself asynchronously to process the request
4. AI generates response with web search for accurate, up-to-date information
5. Lambda sends follow-up message(s) to Discord (auto-splits long responses)
