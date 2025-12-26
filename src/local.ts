/**
 * Local development server for testing Discord interactions
 */
import express from 'express';
import dotenv from 'dotenv';
import { handler } from './index';
import { APIGatewayProxyEvent } from 'aws-lambda';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Parse raw body for signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    (req as any).rawBody = buf.toString();
  }
}));

// Health check endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'dewey-bot',
    message: 'Local development server is running',
  });
});

// Discord interactions endpoint
app.post('/interactions', async (req, res) => {
  console.log('Received interaction:', JSON.stringify(req.body, null, 2));

  // Convert Express request to Lambda event format
  const event: APIGatewayProxyEvent = {
    body: (req as any).rawBody || JSON.stringify(req.body),
    headers: {
      'x-signature-ed25519': req.headers['x-signature-ed25519'] as string || '',
      'x-signature-timestamp': req.headers['x-signature-timestamp'] as string || '',
      'content-type': 'application/json',
    },
    multiValueHeaders: {},
    httpMethod: 'POST',
    isBase64Encoded: false,
    path: '/interactions',
    pathParameters: null,
    queryStringParameters: null,
    multiValueQueryStringParameters: null,
    stageVariables: null,
    requestContext: {} as any,
    resource: '',
  };

  try {
    const result = await handler(event);

    // Handle void result (async deferred processing)
    if (!result) {
      res.status(200).json({ message: 'Async processing started' });
      return;
    }

    res.status(result.statusCode);

    // Set response headers
    if (result.headers) {
      Object.entries(result.headers).forEach(([key, value]) => {
        res.setHeader(key, value as string);
      });
    }

    // Send response body
    if (result.body) {
      const body = typeof result.body === 'string' ? JSON.parse(result.body) : result.body;
      res.json(body);
    } else {
      res.end();
    }
  } catch (error) {
    console.error('Error handling interaction:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`\n🚀 Dewey local server running on http://localhost:${PORT}`);
  console.log(`\n📝 Set Discord Interactions Endpoint URL to:`);
  console.log(`   http://localhost:${PORT}/interactions`);
  console.log(`\n💡 For external access, use ngrok:`);
  console.log(`   ngrok http ${PORT}`);
  console.log(`   Then use: https://YOUR-NGROK-URL/interactions\n`);

  // Display provider status
  const providerManager = require('./llm/provider').getProviderManager();
  console.log(`\n🤖 LLM Provider: ${providerManager.getCurrentProvider().toUpperCase()}`);
  console.log(`   Available: ${providerManager.getAvailableProviders().join(', ')}\n`);
});
