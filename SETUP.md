# Dewey Setup Guide

Complete guide to set up and deploy Dewey Discord bot.

## Prerequisites

1. **Node.js 16+** - [Download](https://nodejs.org/)
2. **Discord Application** - [Discord Developer Portal](https://discord.com/developers/applications)
3. **Gemini API Key** (free) - [Get key](https://aistudio.google.com/apikey)
4. **AWS Account** - [Sign up](https://aws.amazon.com/) (for deployment)
5. **Optional: Anthropic API Key** - [Sign up](https://console.anthropic.com/) (for Claude)

## Step 1: Install Dependencies

```bash
cd dewey
npm install
```

## Step 2: Set Up Discord Application

### Create Discord App

1. Go to [Discord Developer Portal](https://discord.com/developers/applications)
2. Click "New Application"
3. Name it "Dewey" (or your preferred name)
4. Click "Create"

### Get Credentials

1. Go to "General Information"
   - Copy **Application ID**
   - Copy **Public Key**

2. Go to "Bot" section
   - Click "Reset Token" and copy the **Bot Token**
   - Enable these privileged gateway intents:
     - ✅ Server Members Intent
     - ✅ Message Content Intent

3. Go to "OAuth2" → "URL Generator"
   - Select scopes: `bot`, `applications.commands`
   - Select bot permissions: `Send Messages`, `Use Slash Commands`
   - Copy the generated URL and open it to add bot to your server

### Get Server ID

1. In Discord, enable Developer Mode:
   - User Settings → Advanced → Developer Mode
2. Right-click your server → Copy Server ID

## Step 3: Get LLM API Keys

### Gemini (Recommended to start - Free)

1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Click "Get API Key"
3. Create or select a project
4. Copy the API key

### Claude (Optional - Premium)

1. Go to [Anthropic Console](https://console.anthropic.com/)
2. Sign up or log in
3. Go to "API Keys"
4. Create a key and copy it

## Step 4: Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```bash
# Discord Configuration
DISCORD_APP_ID=your_discord_app_id_here
DISCORD_BOT_PUBLIC_KEY=your_discord_public_key_here
DISCORD_BOT_SECRET_TOKEN=your_discord_bot_token_here
DISCORD_SERVER_ID=your_discord_server_id_here

# LLM Provider
DEFAULT_LLM_PROVIDER=gemini

# Gemini (Free tier)
GEMINI_API_KEY=your_gemini_api_key_here

# Claude (Optional)
ANTHROPIC_API_KEY=your_anthropic_api_key_here

# AWS (for deployment)
AWS_REGION=us-west-2
AWS_PROFILE=default
```

## Step 5: Build the Project

```bash
npm run build
```

## Step 6: Test Locally

### Option A: Test with CLI

```bash
npm run cli status

# Test synopsis generation
npm run cli test-synopsis "1984"

# Test with specific provider
npm run cli test-synopsis "Dune" --provider claude
```

### Option B: Test with Local Server

```bash
npm run dev
```

This starts a local server at `http://localhost:3000`.

To test with Discord:
1. Install [ngrok](https://ngrok.com/): `npm install -g ngrok`
2. In another terminal: `ngrok http 3000`
3. Copy the ngrok HTTPS URL (e.g., `https://abc123.ngrok.io`)
4. Go to Discord Developer Portal → Your App → General Information
5. Set Interactions Endpoint URL to: `https://abc123.ngrok.io/interactions`
6. Discord will verify the endpoint

Now you can test commands in Discord while running locally!

## Step 7: Register Commands

```bash
npm run register-commands
```

This registers the slash commands with Discord. If you set `DISCORD_SERVER_ID`, commands appear instantly in your server. Without it, they're registered globally (takes up to 1 hour).

## Step 8: Deploy to AWS

### Configure AWS Credentials

```bash
# Install AWS CLI if not already installed
# macOS: brew install awscli
# Other: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html

# Configure credentials
aws configure
# Enter your AWS Access Key ID
# Enter your Secret Access Key
# Default region: us-west-2 (or your preference)
# Default output format: json
```

### Deploy

```bash
# Make sure environment variables are loaded
source .env  # or: . .env

# Deploy to AWS
npm run deploy
```

This will:
- Create Lambda function
- Create API Gateway
- Output the Discord Interactions URL

### Configure Discord with Production URL

1. After deployment, copy the "DiscordInteractionsUrl" from the output
2. Go to Discord Developer Portal → Your App → General Information
3. Set Interactions Endpoint URL to the deployed URL
4. Click "Save Changes"

## Step 9: Test in Discord

In your Discord server, try these commands:

```
/synopsis title:1984
/synopsis-batch titles:1984, Dune, Foundation
/provider status
/provider set name:claude
```

## Troubleshooting

### Commands not appearing
- Wait a few minutes if you registered globally
- Try kicking and re-adding the bot
- Check bot permissions

### "Application did not respond" error
- Check CloudWatch Logs in AWS Console
- Verify environment variables are set
- Check API Gateway endpoint is correct

### LLM errors
- Verify API keys are valid
- Check you have available quota/credits
- Try switching providers: `/provider set name:gemini`

### Local testing not working
- Make sure ngrok is running
- Check Discord public key is correct
- Verify ngrok URL is HTTPS

## Cost Monitoring

### AWS Costs
- Lambda: ~$0-1/month (generous free tier)
- API Gateway: ~$0 for light usage (1M requests free)
- CloudWatch Logs: Minimal

### LLM Costs
- Gemini: Free tier (15 requests/min)
- Claude Haiku: ~$0.003 per synopsis

Expected total: **$0-5/month** for typical book club usage

## Next Steps

- Add more books to your reading list
- Try batch synopsis for poll preparation
- Experiment with different providers
- Monitor costs in AWS Console and LLM dashboards

## Support

- Check CloudWatch Logs: AWS Console → CloudWatch → Logs
- Review huginbot for reference patterns
- Test commands locally with `npm run dev`
