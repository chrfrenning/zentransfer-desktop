const { execSync } = require('child_process');
const path = require('path');

exports.default = async function(configuration) {
  const { path: filePath } = configuration;
  
  console.log(`Signing ${filePath} with Azure SignTool...`);
  
  // Azure SignTool command
  const signCommand = [
    'AzureSignTool',
    'sign',
    '-kvu', process.env.AZURE_KEY_VAULT_URI,
    '-kvi', process.env.AZURE_KEY_VAULT_CLIENT_ID,
    '-kvt', process.env.AZURE_KEY_VAULT_TENANT_ID,
    '-kvs', process.env.AZURE_KEY_VAULT_CLIENT_SECRET,
    '-kvc', process.env.AZURE_KEY_VAULT_CERTIFICATE,
    '-tr', 'http://timestamp.digicert.com',
    '-td', 'sha256',
    `"${filePath}"`
  ].join(' ');
  
  try {
    execSync(signCommand, { stdio: 'inherit' });
    console.log(`Successfully signed ${filePath}`);
  } catch (error) {
    console.error(`Failed to sign ${filePath}:`, error.message);
    throw error;
  }
}; 