#!/usr/bin/env node
/**
 * Register Discord slash commands
 */
import dotenv from 'dotenv';
import { registerCommands } from './discord/commands';

dotenv.config();

const appId = process.env.DISCORD_APP_ID;
const token = process.env.DISCORD_BOT_SECRET_TOKEN;
const guildId = process.env.DISCORD_SERVER_ID; // Optional - for guild-specific commands

if (!appId || !token) {
  console.error('Error: DISCORD_APP_ID and DISCORD_BOT_SECRET_TOKEN must be set in .env');
  process.exit(1);
}

console.log('Registering Discord commands...');
console.log(`App ID: ${appId}`);
console.log(`Guild ID: ${guildId || 'Global (no guild specified)'}\n`);

registerCommands(appId, token, guildId)
  .then(() => {
    console.log('\n✅ Commands registered successfully!');
    if (guildId) {
      console.log('Commands should be available immediately in your Discord server.');
    } else {
      console.log('Global commands may take up to 1 hour to appear in Discord.');
      console.log('For instant registration during development, set DISCORD_SERVER_ID in .env');
    }
  })
  .catch((error) => {
    console.error('\n❌ Error registering commands:', error);
    process.exit(1);
  });
