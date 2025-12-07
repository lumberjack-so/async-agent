#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testComposioAPI() {
  const apiKey = process.env.COMPOSIO_API_KEY;

  if (!apiKey) {
    console.error('❌ COMPOSIO_API_KEY not set');
    process.exit(1);
  }

  console.log('✓ COMPOSIO_API_KEY found (length:', apiKey.length, ')');
  console.log('Testing Composio API...\n');

  const client = axios.create({
    baseURL: 'https://backend.composio.dev/api',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 10000,
  });

  try {
    // Test 1: List toolkits
    console.log('1. Testing GET /v3/toolkits...');
    const toolkitsResponse = await client.get('/v3/toolkits');
    console.log('✓ Status:', toolkitsResponse.status);
    console.log('✓ Toolkits found:', toolkitsResponse.data.items?.length || 0);
    if (toolkitsResponse.data.items?.length > 0) {
      console.log('✓ First 3 toolkits:', toolkitsResponse.data.items.slice(0, 3).map(t => t.name).join(', '));
    }

    // Test 2: Get specific toolkit (GitHub)
    console.log('\n2. Testing GET /v3/toolkits/github...');
    const githubResponse = await client.get('/v3/toolkits/github');
    console.log('✓ Status:', githubResponse.status);
    console.log('✓ GitHub toolkit:', githubResponse.data.name);
    console.log('✓ Display name:', githubResponse.data.displayName);

    console.log('\n🎉 All tests passed!');
  } catch (error) {
    console.error('\n❌ Error:', error.response?.status, error.response?.statusText);
    console.error('Response data:', JSON.stringify(error.response?.data, null, 2));
    console.error('Full error:', error.message);
  }
}

testComposioAPI();
