const puppeteer = require('puppeteer');
const fs = require('fs');

const findChromeExecutable = () => {
  if (process.env.PUPPETEER_EXECUTABLE_PATH) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }

  const candidates = process.platform === 'win32'
    ? [
        process.env.PROGRAMFILES && `${process.env.PROGRAMFILES}\\Google\\Chrome\\Application\\chrome.exe`,
        process.env['PROGRAMFILES(X86)'] && `${process.env['PROGRAMFILES(X86)']}\\Google\\Chrome\\Application\\chrome.exe`,
        process.env.LOCALAPPDATA && `${process.env.LOCALAPPDATA}\\Google\\Chrome\\Application\\chrome.exe`,
      ]
    : [];

  return candidates.find((candidate) => candidate && fs.existsSync(candidate));
};

const generateReportPdf = async (htmlString) => {
  const launchOptions = { headless: 'new' };
  const executablePath = findChromeExecutable();
  if (executablePath) launchOptions.executablePath = executablePath;
  const browser = await puppeteer.launch(launchOptions);

  try {
    const page = await browser.newPage();
    await page.setContent(htmlString, { waitUntil: 'domcontentloaded' });
    await page.evaluate(async () => {
      if (document.fonts) {
        await Promise.race([
          document.fonts.ready,
          new Promise(resolve => setTimeout(resolve, 3000)),
        ]);
      }
    });

    return await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
  } finally {
    await browser.close();
  }
};

module.exports = { generateReportPdf };