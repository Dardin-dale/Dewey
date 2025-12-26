/**
 * AWS CDK Stack for Dewey Discord Bot
 */
import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import { Construct } from 'constructs';
import * as path from 'path';

export class DeweyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Lambda function for handling Discord interactions
    // Uses NodejsFunction to automatically bundle dependencies via esbuild
    const discordHandler = new nodejs.NodejsFunction(this, 'DiscordHandler', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'handler',
      entry: path.join(__dirname, '../src/index.ts'),
      timeout: cdk.Duration.seconds(300), // 5 minutes for batch processing
      memorySize: 512,
      environment: {
        DISCORD_BOT_PUBLIC_KEY: process.env.DISCORD_BOT_PUBLIC_KEY || '',
        DISCORD_BOT_SECRET_TOKEN: process.env.DISCORD_BOT_SECRET_TOKEN || '',
        DEFAULT_LLM_PROVIDER: process.env.DEFAULT_LLM_PROVIDER || 'gemini',
        GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
        ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY || '',
      },
      bundling: {
        minify: true,
        sourceMap: true,
      },
    });

    // Allow Lambda to invoke itself for async deferred processing
    // Use a wildcard pattern to avoid circular dependency
    discordHandler.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['lambda:InvokeFunction'],
      resources: [`arn:aws:lambda:${this.region}:${this.account}:function:DeweyStack-*`],
    }));

    // API Gateway for Discord webhook
    const api = new apigateway.RestApi(this, 'DeweyApi', {
      restApiName: 'Dewey Discord Bot API',
      description: 'API for Dewey Discord bot interactions',
      deployOptions: {
        stageName: 'prod',
      },
    });

    // Add /interactions endpoint
    const interactions = api.root.addResource('interactions');
    interactions.addMethod(
      'POST',
      new apigateway.LambdaIntegration(discordHandler, {
        requestTemplates: {
          'application/json': '{ "statusCode": "200" }',
        },
      })
    );

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'DeweyApiEndpoint',
    });

    new cdk.CfnOutput(this, 'DiscordInteractionsUrl', {
      value: `${api.url}interactions`,
      description: 'Discord Interactions Endpoint URL',
      exportName: 'DeweyDiscordInteractionsUrl',
    });
  }
}
