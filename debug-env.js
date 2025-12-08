#!/usr/bin/env node
/**
 * Debug Environment Loading
 * Check what env vars are loaded and from where
 */

console.log('Current working directory:', process.cwd());
console.log('Script location:', import.meta.url);
console.log('\n--- Before dotenv ---');
console.log('COMPOSIO_API_KEY:', process.env.COMPOSIO_API_KEY ? 'SET' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

import dotenv from 'dotenv';
const result = dotenv.config();

console.log('\n--- After dotenv ---');
console.log('dotenv result:', result.error ? `Error: ${result.error.message}` : 'Success');
console.log('COMPOSIO_API_KEY:', process.env.COMPOSIO_API_KEY ? 'SET' : 'NOT SET');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? 'SET' : 'NOT SET');

// Now import config and check
console.log('\n--- Config module ---');
const { config } = await import('./dist/config/index.js');
console.log('config.composio.apiKey:', config.composio.apiKey ? 'SET (' + config.composio.apiKey.substring(0, 10) + '...)' : 'NOT SET');
console.log('config.composio.enabled:', config.composio.enabled);
