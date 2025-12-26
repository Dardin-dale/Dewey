#!/usr/bin/env node
/**
 * CDK App entry point
 */
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DeweyStack } from '../lib/dewey-stack';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = new cdk.App();

new DeweyStack(app, 'DeweyStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.AWS_REGION || 'us-west-2',
  },
  description: 'Dewey Discord Bot - AI-powered book club assistant',
});
