// Resolve Playwright from a local install or a global one (NODE_PATH).
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
let pw;
try { pw = await import('playwright'); } catch { pw = require('playwright'); }
export const chromium = pw.chromium || pw.default?.chromium;
