const fs = require('fs');
const jwt = require('jsonwebtoken');

// Read the private key
const privateKey = fs.readFileSync('/Users/stevearmstrong/Downloads/AuthKey_V2P2MXL6TW.p8', 'utf8');

// Generate JWT
const token = jwt.sign(
  {
    iss: 'H29V4CFQP8', // Team ID
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (86400 * 180), // 180 days
    aud: 'https://appleid.apple.com',
    sub: 'com.stevearmstrong.zentask.auth' // Services ID
  },
  privateKey,
  {
    algorithm: 'ES256',
    header: {
      alg: 'ES256',
      kid: 'V2P2MXL6TW' // Key ID
    }
  }
);

console.log('Generated JWT token:');
console.log(token);
console.log('\nCopy this token and paste it into the Supabase "Secret Key" field.');
