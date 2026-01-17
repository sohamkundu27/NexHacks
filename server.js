import express from 'express';
import multer from 'multer';
import { AccessToken } from 'livekit-server-sdk';
import dotenv from 'dotenv';
import cors from 'cors';
import { getDocumentProxy, extractText } from 'unpdf';

dotenv.config({ path: '.env.local' });

// Temporary in-memory store for parsed PDF (text + extracted drugs)
let storedPdf = { text: null, drugs: [] };

/**
 * Heuristic extraction of likely drug names from medical text.
 * Looks for common drug suffixes and phrases like "X mg", "taking X".
 */
function extractDrugsFromText(text) {
  if (!text || typeof text !== 'string') return [];
  const seen = new Set();
  const drugs = [];

  // Common drug name suffixes (case-insensitive)
  const suffixRegex = /(?:^|[\s,;])([A-Z][a-zA-Z]*(?:olol|pril|cin|dipine|statin|cycline|mycin|prazole|formin|artan|azepam|oxetine|olone|ide|tide|dine|pine|done|tadine))(?=[\s,;.]|$)/gi;
  let m;
  while ((m = suffixRegex.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length > 2 && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      drugs.push(name);
    }
  }

  // Lines with "X mg", "X tablet", "X capsule", "X daily" — capture X
  const doseRegex = /(?:^|[\n])\s*([A-Z][a-zA-Z\-]+)\s+(?:\d+\s*)?(?:mg|mcg|mL|tablet|tablets|capsule|capsules|daily|twice|once)/gim;
  while ((m = doseRegex.exec(text)) !== null) {
    const name = m[1].trim();
    if (name.length > 2 && !seen.has(name.toLowerCase())) {
      seen.add(name.toLowerCase());
      drugs.push(name);
    }
  }

  return drugs;
}

/**
 * Resolve drug name to RxCUI via RxNav (NIH). Returns null if not found.
 */
async function getRxcui(name) {
  const res = await fetch(
    `https://rxnav.nlm.nih.gov/REST/rxcui.json?name=${encodeURIComponent(name)}`
  );
  const json = await res.json();
  const id = json?.idGroup?.rxnormId?.[0] || json?.idGroup?.rxnormId;
  return id ? String(id) : null;
}

/**
 * Check interactions using RxNav API. Returns { hasConflict, details }.
 */
async function checkInteractionsRxNav(newDrug, existingDrugs) {
  const all = [newDrug, ...existingDrugs].filter(Boolean);
  const rxcuis = [];
  for (const d of all) {
    const id = await getRxcui(d);
    if (id) rxcuis.push(id);
  }
  if (rxcuis.length < 2) return { hasConflict: false, details: 'Insufficient drug data to check.', source: 'rxnav' };

  const url = `https://rxnav.nlm.nih.gov/REST/interaction/list.json?rxcui=${rxcuis.join(',')}`;
  const res = await fetch(url);
  const json = await res.json();
  const list = json?.fullInteractionTypeGroup || [];
  const pairs = [];
  for (const g of list) {
    for (const t of g?.fullInteractionType || []) {
      const names = (t?.interactionPair || []).map((p) => p?.interactionConcept?.[0]?.minConceptItem?.name).filter(Boolean);
      if (names.length) pairs.push(names.join(' + '));
    }
  }
  const hasConflict = pairs.length > 0;
  const details = hasConflict
    ? `Possible interaction(s): ${pairs.slice(0, 5).join('; ')}${pairs.length > 5 ? ' ...' : ''}`
    : 'No known interactions found.';
  return { hasConflict, details, source: 'rxnav' };
}

/**
 * Optional: check via Browserbase scraping drugs.com. Use when BROWSERBASE_* are set.
 */
async function checkInteractionsBrowserbase(newDrug, existingDrugs) {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  try {
    const Browserbase = (await import('@browserbasehq/sdk')).default;
    const { Builder } = await import('selenium-webdriver');
    const http = await import('http');

    const bb = new Browserbase({ apiKey });
    const session = await bb.sessions.create({ projectId });

    const customHttpAgent = new http.Agent({});
    customHttpAgent.addRequest = function (req, options) {
      req.setHeader('x-bb-signing-key', session.signingKey);
      http.Agent.prototype.addRequest.call(this, req, options);
    };

    const driver = new Builder()
      .forBrowser('chrome')
      .usingHttpAgent(customHttpAgent)
      .usingServer(session.seleniumRemoteUrl)
      .build();

    const toCheck = [newDrug, ...existingDrugs].filter(Boolean).slice(0, 5);
    const results = [];

    for (let i = 0; i < toCheck.length; i++) {
      for (let j = i + 1; j < toCheck.length; j++) {
        const a = toCheck[i].toLowerCase().replace(/\s+/g, '-');
        const b = toCheck[j].toLowerCase().replace(/\s+/g, '-');
        const url = `https://www.drugs.com/drug_interactions/${a}-with-${b}.html`;
        await driver.get(url);
        await new Promise((r) => setTimeout(r, 1500));
        const body = await driver.executeScript('return document.body.innerText;');
        if (/interaction|interact|contraindicated|moderate|major/i.test(body)) {
          const snippet = body.slice(0, 400).replace(/\s+/g, ' ').trim();
          results.push(`${toCheck[i]} + ${toCheck[j]}: ${snippet}`);
        }
      }
    }

    await driver.quit();

    const hasConflict = results.length > 0;
    const details = hasConflict
      ? results.slice(0, 3).join(' | ')
      : 'No interactions found (drugs.com).';
    return { hasConflict, details, source: 'browserbase' };
  } catch (e) {
    console.warn('Browserbase check failed:', e.message);
    return null;
  }
}

const createToken = async () => {
  const roomName = 'quick-chat-room';
  const participantName = 'user-' + Math.floor(Math.random() * 10000);

  const at = new AccessToken(process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET, {
    identity: participantName,
    ttl: '24h',
  });
  at.addGrant({ roomJoin: true, room: roomName });

  return await at.toJwt();
};

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });
const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json());

// API routes first so they are not handled by static
app.get('/health', (req, res) => res.json({ ok: true, service: 'nexhacks-backend' }));

// Detect PDF parse errors (bad XRef, FormatError, encrypted, etc.) for a clearer 500 message.
function isPdfReadError(err) {
  const s = [err?.message, err?.details, String(err)].filter(Boolean).join(' ').toLowerCase();
  return /xref|formaterror|bad\s|password|encrypted|invalid|corrupt|malformed/.test(s);
}

app.post('/upload-pdf', upload.single('pdf'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'No PDF file provided' });
    }
    const buf = req.file.buffer;
    if (buf.length < 5 || !buf.subarray(0, 5).toString('ascii').startsWith('%PDF-')) {
      return res.status(400).json({ error: 'File does not look like a valid PDF' });
    }
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await extractText(pdf, { mergePages: true });
    const drugs = extractDrugsFromText(text || '');
    storedPdf = { text: (text || '').slice(0, 50000), drugs };
    res.json({ ok: true, drugCount: drugs.length, drugs });
  } catch (err) {
    console.error('PDF upload error:', err);
    const msg = isPdfReadError(err)
      ? "This PDF could not be read. It may be corrupted, password-protected, or in a format we don't support. Try a different file or re-save the PDF."
      : 'Failed to parse PDF';
    res.status(500).json({ error: msg });
  }
});

app.get('/api/pdf-status', (req, res) => {
  res.json({
    loaded: !!storedPdf.text,
    drugCount: storedPdf.drugs?.length || 0,
    drugs: storedPdf.drugs || [],
  });
});

app.post('/check-interactions', async (req, res) => {
  try {
    const { newDrug } = req.body || {};
    if (!newDrug || typeof newDrug !== 'string') {
      return res.status(400).json({ error: 'Missing newDrug' });
    }
    const existingDrugs = storedPdf.drugs || [];

    let result = await checkInteractionsBrowserbase(newDrug, existingDrugs);
    if (!result) result = await checkInteractionsRxNav(newDrug, existingDrugs);

    res.json(result);
  } catch (err) {
    console.error('check-interactions error:', err);
    res.status(500).json({
      hasConflict: false,
      details: 'Conflict check failed. Please verify manually.',
      source: 'error',
    });
  }
});

app.get('/getToken', async (req, res) => {
  try {
    const token = await createToken();
    res.send(token);
  } catch (err) {
    console.error(err);
    res.status(500).send('Could not generate token');
  }
});

// SPA and static files last
app.use(express.static('dist'));

app.listen(port, () => {
  console.log(`Server listening on port ${port} (backend for PDF/LiveKit/conflict-check)`);
});
