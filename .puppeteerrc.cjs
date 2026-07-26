const { join } = require('path');
module.exports = {
  skipDownload: true,
  executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || '/usr/bin/chromium',
};