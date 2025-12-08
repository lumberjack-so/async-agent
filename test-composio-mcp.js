import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

async function testComposioMcpAPIs() {
  const apiKey = process.env.COMPOSIO_API_KEY;

  console.log('Testing Composio MCP Server APIs\n');
  console.log('='.repeat(50));

  // Test 1: Create toolkit-level MCP server
  console.log('\n1. Testing Toolkit-Level MCP Server Creation');
  try {
    const response = await axios.post('https://backend.composio.dev/api/v3/mcp/servers', {
      name: 'test-toolkit-mcp',
      auth_config_ids: ['ac_m3B-zfIIGyVC']  // Using existing Gmail auth config
    }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('✗ Error:', error.response?.data || error.message);
  }

  // Test 2: Create custom step-level MCP server
  console.log('\n2. Testing Custom Step-Level MCP Server Creation');
  try {
    const response = await axios.post('https://backend.composio.dev/api/v3/mcp/servers/custom', {
      tools: ['GMAIL_SEND_EMAIL', 'GMAIL_CREATE_EMAIL_DRAFT'],
      name: 'test-step-mcp',
      auth_config_ids: ['ac_m3B-zfIIGyVC']
    }, {
      headers: {
        'X-API-Key': apiKey,
        'Content-Type': 'application/json'
      }
    });
    console.log('✓ Success!');
    console.log('Response:', JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.log('✗ Error:', error.response?.data || error.message);
  }
}

testComposioMcpAPIs().catch(console.error);
