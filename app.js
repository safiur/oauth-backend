// backend/app.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const CLIENT_ID = process.env.GITHUB_CLIENT_ID;
const CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET;
const REDIRECT_URI = 'http://localhost:3000/callback';

// Store used codes to prevent reuse
const usedCodes = new Set();

app.get('/api/auth/github', (req, res) => {
  console.log('Initiating GitHub OAuth flow...');
  const state = Math.random().toString(36).substring(7);
  res.redirect(
    `https://github.com/login/oauth/authorize?client_id=${CLIENT_ID}&redirect_uri=${REDIRECT_URI}&scope=user&state=${state}`
  );
});

app.post('/api/auth/callback', async (req, res) => {
  const { code } = req.body;
  
  if (!code) {
    return res.status(400).json({ error: 'No code provided' });
  }

  // Check if code has been used
  if (usedCodes.has(code)) {
    return res.status(400).json({ error: 'Code has already been used' });
  }

  try {
    usedCodes.add(code); // Mark code as used

    const tokenResponse = await axios.post(
      'https://github.com/login/oauth/access_token',
      {
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI
      },
      {
        headers: {
          Accept: 'application/json'
        }
      }
    );

    if (tokenResponse.data.error) {
      throw new Error(tokenResponse.data.error_description || tokenResponse.data.error);
    }

    const accessToken = tokenResponse.data.access_token;

    const userResponse = await axios.get('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${accessToken}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'node.js'
      }
    });

    return res.json({
      user: userResponse.data,
      accessToken
    });

  } catch (error) {
    console.error('Authentication error:', {
      message: error.message,
      response: error.response?.data
    });
    
    return res.status(500).json({ 
      error: 'Authentication failed',
      details: error.message
    });
  }
});

const PORT = 5001;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});