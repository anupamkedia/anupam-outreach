/**
 * parse-lead.ts
 * Turns a pasted email or WhatsApp conversation into draft lead fields.
 *
 * Rules only — no API call, no cost, works offline. Everything it
 * extracts is shown to the rep for confirmation before saving, so a
 * wrong guess costs one correction, never a bad record.
 *
 * The product and segment vocabularies below are Anupam-specific.
 * Add to them as new enquiry language shows up in the field.
 */

export type ParsedLead = {
  company_name: string;
  contact_person: string;
  designation: string;
  email: string;
  phone: string;
  whatsapp: string;
  city: string;
  state: string;
  segment: string;
  products: string[];
  expected_value: number;
  notes: string;
  confidence: Record<string, 'high' | 'medium' | 'low'>;
};

/* ── Vocabularies ────────────────────────────────────────── */

const PRODUCT_TERMS: Record<string, string[]> = {
  'Epoxy': ['epoxy'],
  'Epoxy zinc phosphate primer': ['zinc phosphate', 'znp'],
  'Zinc rich primer': ['zinc rich', 'zinc-rich', 'znrich'],
  'Inorganic zinc silicate': ['zinc silicate', 'iozs', 'inorganic zinc'],
  'Epoxy MIO': ['mio', 'micaceous'],
  'Epoxy mastic': ['mastic'],
  'Glass flake': ['glass flake', 'glassflake'],
  'Coal tar epoxy': ['coal tar', 'coaltar'],
  'Polyurethane (PU)': ['polyurethane', ' pu ', 'pu paint', 'pu top', 'pu coat'],
  'Polyurea': ['polyurea'],
  'Polyaspartic': ['polyaspartic', 'aspartic'],
  'Epoxy flooring': ['epoxy floor', 'floor coating', 'flooring', 'self level'],
  'Heat resistant coating': ['heat resistant', 'heat-resistant', 'high temp', 'ht paint', 'silicone alu'],
  'Heat reflective / roof cool': ['heat reflect', 'roof cool', 'cool roof', 'solar reflect', 'thermal barrier'],
  'Intumescent fire retardant': ['intumescent', 'fire retardant', 'fire proofing', 'fireproofing', 'fire rated'],
  'Waterproofing': ['waterproof', 'water proofing', 'damp proof', 'dampproof', 'leak', 'seepage'],
  'Elastomeric coating': ['elastomeric'],
  'Anti-carbonation': ['anti carbonation', 'anti-carbonation', 'carbonation'],
  'Anti-fouling': ['antifouling', 'anti fouling', 'anti-fouling'],
  'Tank lining': ['tank lining', 'tank linning', 'internal lining'],
  'Potable water / food grade': ['potable', 'food grade', 'drinking water', 'wras'],
  'Chemical / acid resistant': ['acid resist', 'chemical resist', 'novolac', 'vinyl ester'],
  'Pipeline coating': ['pipeline', 'fbe', '3lpe', 'pipe coating'],
  'Chlorinated rubber': ['chlorinated rubber'],
  'Road marking': ['road marking', 'thermoplastic', 'zebra'],
  'Enamel': ['enamel', 'synthetic enamel'],
  'Emulsion': ['emulsion', 'interior paint', 'exterior paint', 'distemper'],
  'Wall putty': ['putty'],
  'Texture coating': ['texture'],
  'Anti-corrosive primer': ['anti corrosive', 'anti-corrosive', 'red oxide', 'corrosion'],
  'DTM': ['dtm', 'direct to metal'],
  'Stoving paint': ['stoving', 'baking paint'],
  'PU clear coat': ['clear coat', 'clearcoat', 'lacquer'],
  'Anti-graffiti': ['graffiti'],
  'Thinner': ['thinner'],
};

const SEGMENT_TERMS: Record<string, string[]> = {
  railways: ['railway', 'rdso', 'icf', 'clw', 'dmw', 'rcf', 'mcf', 'coach', 'wagon', 'loco', 'irepS', 'ireps'],
  metro: ['metro', 'dmrc', 'cmrl', 'rrts', 'mrts'],
  defence: ['navy', 'defence', 'defense', 'mes', 'dqan', 'ordnance', 'army', 'air force'],
  marine: ['shipyard', 'ship ', 'vessel', 'barge', 'grse', 'mazagon', 'cochin shipyard', 'dry dock', 'hull'],
  oil_gas: ['refinery', 'iocl', 'hpcl', 'bpcl', 'gail', 'ongc', 'petrochemical', 'reliance', 'crude', 'lpg', 'terminal'],
  power: ['power plant', 'thermal', 'bhel', 'ntpc', 'turbine', 'boiler', 'substation'],
  steel: ['steel plant', 'sail', 'tata steel', 'jsw', 'rolling mill', 'blast furnace'],
  cement: ['cement plant', 'clinker', 'silo'],
  infrastructure: ['bridge', 'flyover', 'highway', 'nhai', 'tunnel', 'epc', 'l&t', 'tata projects', 'ncc', 'nbcc'],
  real_estate: ['builder', 'developer', 'apartment', 'housing', 'society', 'tower', 'residential', 'lodha', 'shapoorji'],
  warehousing: ['warehouse', 'godown', 'logistics park', 'indospace'],
  water: ['water tank', 'overhead tank', 'sewage', 'stp', 'etp', 'pumping station', 'reservoir'],
  industrial: ['factory', 'plant', 'fabrication', 'workshop', 'machinery', 'structural'],
  dealer: ['dealer', 'distributor', 'retail', 'shop', 'stockist'],
};

const STATE_BY_CITY: Record<string, string> = {
  kolkata: 'West Bengal', howrah: 'West Bengal', durgapur: 'West Bengal',
  asansol: 'West Bengal', siliguri: 'West Bengal', haldia: 'West Bengal',
  kharagpur: 'West Bengal', barrackpore: 'West Bengal',
  mumbai: 'Maharashtra', pune: 'Maharashtra', nagpur: 'Maharashtra', nashik: 'Maharashtra',
  thane: 'Maharashtra', aurangabad: 'Maharashtra',
  delhi: 'Delhi', 'new delhi': 'Delhi', noida: 'Uttar Pradesh', ghaziabad: 'Uttar Pradesh',
  gurgaon: 'Haryana', gurugram: 'Haryana', faridabad: 'Haryana',
  chennai: 'Tamil Nadu', coimbatore: 'Tamil Nadu', hosur: 'Tamil Nadu', trichy: 'Tamil Nadu',
  bengaluru: 'Karnataka', bangalore: 'Karnataka', mysore: 'Karnataka', hubli: 'Karnataka',
  hyderabad: 'Telangana', secunderabad: 'Telangana',
  ahmedabad: 'Gujarat', vadodara: 'Gujarat', surat: 'Gujarat', rajkot: 'Gujarat',
  jamnagar: 'Gujarat', bharuch: 'Gujarat', ankleshwar: 'Gujarat', hazira: 'Gujarat',
  kochi: 'Kerala', cochin: 'Kerala', trivandrum: 'Kerala',
  visakhapatnam: 'Andhra Pradesh', vizag: 'Andhra Pradesh', vijayawada: 'Andhra Pradesh',
  bhubaneswar: 'Odisha', rourkela: 'Odisha', paradip: 'Odisha', angul: 'Odisha',
  jamshedpur: 'Jharkhand', ranchi: 'Jharkhand', dhanbad: 'Jharkhand', bokaro: 'Jharkhand',
  patna: 'Bihar', muzaffarpur: 'Bihar',
  lucknow: 'Uttar Pradesh', kanpur: 'Uttar Pradesh', varanasi: 'Uttar Pradesh',
  gorakhpur: 'Uttar Pradesh', prayagraj: 'Uttar Pradesh',
  jaipur: 'Rajasthan', jodhpur: 'Rajasthan', udaipur: 'Rajasthan',
  indore: 'Madhya Pradesh', bhopal: 'Madhya Pradesh', jabalpur: 'Madhya Pradesh',
  raipur: 'Chhattisgarh', bhilai: 'Chhattisgarh',
  guwahati: 'Assam', chandigarh: 'Chandigarh', ludhiana: 'Punjab', amritsar: 'Punjab',
  dehradun: 'Uttarakhand', haridwar: 'Uttarakhand', goa: 'Goa', panaji: 'Goa',
};

const FREE_MAIL = new Set([
  'gmail.com', 'yahoo.com', 'yahoo.co.in', 'hotmail.com', 'outlook.com',
  'rediffmail.com', 'live.com', 'icloud.com', 'protonmail.com', 'aol.com',
]);

/** Words that mark a company as a company. The name is built from
 *  capitalised words followed by one or more of these. */
const ENTITY_WORDS =
  "(?:Pvt\\.?|Private|Ltd\\.?|Limited|LLP|Inc\\.?|Industries|Infrastructures?|Infra|" +
  "Engineering|Engineers?|Constructions?|Enterprises?|Projects?|Corporation|Corp\\.?|" +
  "Associates|Builders?|Contractors?|Shipyard|Shipping|Refinery|Steel|Cement|Works|" +
  "Udyog|Traders?|Trading|Agencies|Agency|Group|Solutions?|Systems?|Technologies|Logistics)";

const LEGAL_ENTITY = new RegExp(
  "\\b([A-Z][A-Za-z&.'\u2019-]*(?:\\s+[A-Z][A-Za-z&.'\u2019-]*){0,4}?" +
  "(?:\\s+" + ENTITY_WORDS + "\\b)+)"
);

/** Belt and braces: strip lead-ins that survive the capitalisation rule. */
const LEAD_FILLER = /^(?:we are|this is|i am|our (?:company|firm) is|from|regarding|for|m\/s\.?)\s+/i;

const NOISE_LINES = /^(sent from|get outlook|this email|disclaimer|confidential|please consider|regards|thanks|thank you|best regards|warm regards|yours faithfully|yours sincerely)/i;

/* ── Helpers ─────────────────────────────────────────────── */

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

const titleCase = (s: string) =>
  clean(s).toLowerCase().replace(/\b[a-z]/g, (c) => c.toUpperCase());

function normalisePhone(raw: string): string {
  const d = raw.replace(/\D/g, '');
  if (d.length === 10 && /^[6-9]/.test(d)) return `+91${d}`;
  if (d.length === 12 && d.startsWith('91')) return `+${d}`;
  if (d.length === 11 && d.startsWith('0')) return `+91${d.slice(1)}`;
  if (d.length >= 10 && d.length <= 15) return `+${d}`;
  return '';
}

/** "12 lakh", "₹4.5 Cr", "Rs 250000" → rupees */
function extractValue(text: string): number {
  const t = text.toLowerCase();
  const crore = t.match(/(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*\b(?:crores?|cr)\b/);
  if (crore) return Math.round(parseFloat(crore[1].replace(/,/g, '')) * 1e7);
  const lakh = t.match(/(?:₹|rs\.?|inr)?\s*([\d,]+(?:\.\d+)?)\s*\b(?:lakhs?|lacs?|lk)\b/);
  if (lakh) return Math.round(parseFloat(lakh[1].replace(/,/g, '')) * 1e5);
  const plain = t.match(/(?:₹|rs\.?|inr)\s*([\d,]{4,})/);
  if (plain) return Math.round(parseFloat(plain[1].replace(/,/g, '')));
  return 0;
}

function companyFromDomain(email: string): string {
  const domain = email.split('@')[1]?.toLowerCase() ?? '';
  if (!domain || FREE_MAIL.has(domain)) return '';
  const core = domain
    .replace(/\.(com|net|org|in|co\.in|co|biz|info|io)$/i, '')
    .split('.')[0]
    .replace(/[-_]/g, ' ');
  return core.length < 3 ? '' : titleCase(core);
}

/* ── Main ────────────────────────────────────────────────── */

export function parseLead(
  raw: string,
  mode: 'email' | 'whatsapp' | 'manual' = 'email'
): ParsedLead {
  const text = raw.replace(/\r/g, '');
  const lower = text.toLowerCase();
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const confidence: ParsedLead['confidence'] = {};

  /* email — prefer a business address over a free one */
  const emails = [...text.matchAll(/[\w.+-]+@[\w-]+\.[\w.-]+/g)]
    .map((m) => m[0].toLowerCase())
    .filter((e) => !e.includes('anupampaints') && !e.includes('azurapaints'));
  const business = emails.find((e) => !FREE_MAIL.has(e.split('@')[1]));
  const email = business ?? emails[0] ?? '';
  if (email) confidence.email = business ? 'high' : 'medium';

  /* phone */
  const phoneHits = [...text.matchAll(/(?:\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g)]
    .map((m) => normalisePhone(m[0]))
    .filter(Boolean);
  const phone = phoneHits[0] ?? '';
  if (phone) confidence.phone = 'high';

  /* contact person */
  let contact = '';
  const whatsappName = text.match(/^\[?[\d/.: ,apmAPM-]+\]?\s*-?\s*([A-Z][A-Za-z. ]{2,30}):/m);
  const fromLine = text.match(/^\s*from\s*:\s*"?([^"<\n@]{3,40})"?\s*</im);
  const signoff = text.match(
    /(?:regards|thanks|thank you|sincerely|yours faithfully)[,\s]*\n+\s*([A-Z][A-Za-z. ]{2,35})\s*$/im
  );
  if (mode === 'whatsapp' && whatsappName) { contact = whatsappName[1]; confidence.contact_person = 'medium'; }
  else if (fromLine)  { contact = fromLine[1];  confidence.contact_person = 'high'; }
  else if (signoff)   { contact = signoff[1];   confidence.contact_person = 'medium'; }
  contact = clean(contact).replace(/\s*\(.*\)$/, '');
  if (/^(info|sales|purchase|enquiry|admin|accounts)$/i.test(contact)) contact = '';

  /* designation */
  const desig = text.match(
    /\b((?:sr\.?|senior|asst\.?|assistant|dy\.?|deputy|chief|general|managing)?\s*(?:manager|engineer|director|proprietor|partner|head|executive|officer|in[- ]charge|incharge|supervisor|consultant|architect|contractor)(?:\s*[-–—]?\s*(?:purchase|projects?|procurement|maintenance|civil|mechanical|technical|works|stores|operations?))?)\b/i
  );
  const designation = desig ? titleCase(desig[1]) : '';
  if (designation) confidence.designation = 'medium';

  /* company */
  let company = '';
  const labelled = text.match(
    /(?:company|firm|organisation|organization|company name|concern)\s*(?:name)?\s*[:\-]\s*(.{3,80})/i
  );
  const legal = text.match(LEGAL_ENTITY);
  if (labelled) { company = labelled[1]; confidence.company_name = 'high'; }
  else if (legal) { company = legal[1]; confidence.company_name = 'high'; }
  else if (email) {
    const fromDomain = companyFromDomain(email);
    if (fromDomain) { company = fromDomain; confidence.company_name = 'medium'; }
  }
  company = clean(company).replace(LEAD_FILLER, '').replace(/[,.\s]+$/, '');

  /* city and state */
  let city = '', state = '';
  for (const key of Object.keys(STATE_BY_CITY)) {
    if (new RegExp(`\\b${key}\\b`, 'i').test(lower)) {
      city = titleCase(key);
      state = STATE_BY_CITY[key];
      confidence.city = 'medium';
      break;
    }
  }

  /* products */
  const products: string[] = [];
  for (const [label, terms] of Object.entries(PRODUCT_TERMS)) {
    if (terms.some((t) => lower.includes(t))) products.push(label);
  }
  if (products.length) confidence.products = 'medium';

  /* segment — highest keyword count wins */
  let segment = '', best = 0;
  for (const [seg, terms] of Object.entries(SEGMENT_TERMS)) {
    const hits = terms.filter((t) => lower.includes(t.toLowerCase())).length;
    if (hits > best) { best = hits; segment = seg; }
  }
  if (segment) confidence.segment = best > 1 ? 'high' : 'low';

  /* value */
  const expected_value = extractValue(text);
  if (expected_value) confidence.expected_value = 'medium';

  /* notes — the substance, minus signatures and disclaimers */
  const notes = lines
    .filter((l) => !NOISE_LINES.test(l))
    .filter((l) => !/^(from|to|cc|bcc|sent|date|subject)\s*:/i.test(l))
    .filter((l) => !/^[>|-]{2,}/.test(l))
    .filter((l) => l.length > 12)
    .slice(0, 8)
    .join('\n');

  return {
    company_name: company,
    contact_person: contact,
    designation,
    email,
    phone,
    whatsapp: mode === 'whatsapp' ? phone : '',
    city,
    state,
    segment,
    products,
    expected_value,
    notes,
    confidence,
  };
}

export const SEGMENT_OPTIONS = Object.keys(SEGMENT_TERMS);
export const PRODUCT_OPTIONS = Object.keys(PRODUCT_TERMS);
