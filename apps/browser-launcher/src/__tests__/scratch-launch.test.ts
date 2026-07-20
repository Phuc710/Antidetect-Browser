import { describe, it } from 'vitest';
import playwright from 'playwright';

describe('Scratch Launch test', () => {
  it('should launch persistent context and connect over CDP', async () => {
    const port = 51234;
    const userDataDir = 'C:\\Users\\Phucx\\Desktop\\fingerprint-suite\\.agents\\scratch\\test-user-data-persistent';
    
    console.log('Launching persistent context...');
    const context = await playwright.chromium.launchPersistentContext(userDataDir, {
      executablePath: 'C:\\Users\\Phucx\\AppData\\Local\\ms-playwright\\chromium-1228\\chrome-win64\\chrome.exe',
      headless: true,
      args: [
        `--remote-debugging-port=${port}`,
        '--remote-debugging-address=127.0.0.1',
        '--disable-blink-features=AutomationControlled',
      ],
    });

    // Recursive search for PID
    const visited = new Set<any>();
    function search(obj: any, path: string, depth: number) {
      if (depth > 6 || !obj || typeof obj !== 'object' || visited.has(obj)) return;
      visited.add(obj);

      for (const key of Object.keys(obj)) {
        let val: any;
        try {
          val = obj[key];
        } catch {
          continue;
        }

        if (key.toLowerCase() === 'pid' && typeof val === 'number') {
          console.log(`FOUND PID at ${path}.${key} = ${val}`);
        } else if (key.toLowerCase() === '_process' && val && typeof val === 'object') {
          console.log(`FOUND _process at ${path}.${key}`);
        } else if (key.toLowerCase() === 'process' && val && typeof val === 'object') {
          console.log(`FOUND process at ${path}.${key}`);
        }

        if (val && typeof val === 'object') {
          search(val, `${path}.${key}`, depth + 1);
        }
      }
    }

    search(context, 'context', 1);

    console.log('Connecting over CDP...');
    const browser = await playwright.chromium.connectOverCDP(`http://127.0.0.1:${port}`);
    console.log('Connected! Contexts count:', browser.contexts().length);

    console.log('Closing browser and context...');
    await browser.close();
    await context.close();
    console.log('Done!');
  }, 30_000);
});
