const fs = require('fs');
const path = require('path');

let cachedLogoBase64;

const getLogoBase64 = () => {
  if (!cachedLogoBase64) {
    const logoPath = path.join(__dirname, '..', 'assets', 'images', 'apple_scholar_logo.png');
    cachedLogoBase64 = `data:image/png;base64,${fs.readFileSync(logoPath).toString('base64')}`;
  }
  return cachedLogoBase64;
};

module.exports = { getLogoBase64 };