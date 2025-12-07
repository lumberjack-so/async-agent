#!/usr/bin/env node

import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testInitiateConnection() {
  const apiKey = process.env.COMPOSIO_API_KEY;

  const client = axios.create({
    baseURL: 'https://backend.composio.dev/api',
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  try {
    console.log('Testing POST /v3/connected_accounts...\n');

    const payload = {
      toolkit: 'github',
      user_id: 'test-user',
    };

    console.log('Payload:', JSON.stringify(payload, null, 2));

    const response = await client.post('/v3/connected_accounts', payload);

    console.log('\n✓ Status:', response.status);
    console.log('✓ Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('\n❌ Error:', error.response?.status, error.response?.statusText);
    console.error('Error data:', JSON.stringify(error.response?.data, null, 2));
  }
}

testInitiateConnection();
