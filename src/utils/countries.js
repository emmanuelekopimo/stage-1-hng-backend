// ISO 3166-1 alpha-2 code → full country name
const CODE_TO_NAME = {
  AF: 'Afghanistan', AL: 'Albania', DZ: 'Algeria', AO: 'Angola', AR: 'Argentina',
  AU: 'Australia', AT: 'Austria', AZ: 'Azerbaijan', BD: 'Bangladesh', BE: 'Belgium',
  BJ: 'Benin', BO: 'Bolivia', BR: 'Brazil', BF: 'Burkina Faso', BI: 'Burundi',
  CM: 'Cameroon', CA: 'Canada', CV: 'Cape Verde', CF: 'Central African Republic',
  TD: 'Chad', CL: 'Chile', CN: 'China', CO: 'Colombia', CG: 'Congo', CD: 'DR Congo',
  CI: 'Ivory Coast', HR: 'Croatia', CU: 'Cuba', CZ: 'Czech Republic', DK: 'Denmark',
  DJ: 'Djibouti', DO: 'Dominican Republic', EC: 'Ecuador', EG: 'Egypt',
  SV: 'El Salvador', GQ: 'Equatorial Guinea', ER: 'Eritrea', ET: 'Ethiopia',
  FI: 'Finland', FR: 'France', GA: 'Gabon', GM: 'Gambia', GE: 'Georgia',
  DE: 'Germany', GH: 'Ghana', GR: 'Greece', GT: 'Guatemala', GN: 'Guinea',
  GW: 'Guinea-Bissau', HT: 'Haiti', HN: 'Honduras', HU: 'Hungary', IN: 'India',
  ID: 'Indonesia', IR: 'Iran', IQ: 'Iraq', IE: 'Ireland', IL: 'Israel',
  IT: 'Italy', JM: 'Jamaica', JP: 'Japan', JO: 'Jordan', KZ: 'Kazakhstan',
  KE: 'Kenya', KP: 'North Korea', KR: 'South Korea', KW: 'Kuwait', LB: 'Lebanon',
  LR: 'Liberia', LY: 'Libya', MG: 'Madagascar', MW: 'Malawi', MY: 'Malaysia',
  ML: 'Mali', MR: 'Mauritania', MX: 'Mexico', MA: 'Morocco', MZ: 'Mozambique',
  NA: 'Namibia', NL: 'Netherlands', NZ: 'New Zealand', NI: 'Nicaragua',
  NE: 'Niger', NG: 'Nigeria', NO: 'Norway', OM: 'Oman', PK: 'Pakistan',
  PA: 'Panama', PG: 'Papua New Guinea', PY: 'Paraguay', PE: 'Peru',
  PH: 'Philippines', PL: 'Poland', PT: 'Portugal', QA: 'Qatar', RO: 'Romania',
  RU: 'Russia', RW: 'Rwanda', SA: 'Saudi Arabia', SN: 'Senegal', SL: 'Sierra Leone',
  SO: 'Somalia', ZA: 'South Africa', SS: 'South Sudan', ES: 'Spain', LK: 'Sri Lanka',
  SD: 'Sudan', SE: 'Sweden', CH: 'Switzerland', SY: 'Syria', TW: 'Taiwan',
  TJ: 'Tajikistan', TZ: 'Tanzania', TH: 'Thailand', TL: 'Timor-Leste', TG: 'Togo',
  TT: 'Trinidad and Tobago', TN: 'Tunisia', TR: 'Turkey', UG: 'Uganda',
  UA: 'Ukraine', AE: 'United Arab Emirates', GB: 'United Kingdom',
  US: 'United States', UY: 'Uruguay', UZ: 'Uzbekistan', VE: 'Venezuela',
  VN: 'Vietnam', YE: 'Yemen', ZM: 'Zambia', ZW: 'Zimbabwe',
};

// Natural language tokens → ISO code (sorted longest-first for greedy matching)
const NL_TO_CODE = {
  'south africa': 'ZA', 'south african': 'ZA', 'south africans': 'ZA',
  'ivory coast': 'CI', 'ivorian': 'CI', 'ivorians': 'CI',
  'burkina faso': 'BF', 'burkinabe': 'BF',
  'guinea bissau': 'GW', 'guinea-bissau': 'GW',
  'north korea': 'KP', 'north korean': 'KP',
  'south korea': 'KR', 'south korean': 'KR', 'south koreans': 'KR',
  'united states': 'US', 'united kingdom': 'GB',
  'trinidad and tobago': 'TT', 'trinidad': 'TT',
  'central african republic': 'CF',
  'dr congo': 'CD', 'democratic republic of congo': 'CD',
  'sierra leone': 'SL',
  'saudi arabia': 'SA',
  'united arab emirates': 'AE', 'uae': 'AE',
  'sri lanka': 'LK',
  'timor leste': 'TL',
  'cape verde': 'CV',
  'dominican republic': 'DO',
  'el salvador': 'SV',
  'papua new guinea': 'PG',
  'new zealand': 'NZ',
  'nigeria': 'NG', 'nigerian': 'NG', 'nigerians': 'NG',
  'kenya': 'KE', 'kenyan': 'KE', 'kenyans': 'KE',
  'ghana': 'GH', 'ghanaian': 'GH', 'ghanaians': 'GH',
  'ethiopia': 'ET', 'ethiopian': 'ET', 'ethiopians': 'ET',
  'tanzania': 'TZ', 'tanzanian': 'TZ', 'tanzanians': 'TZ',
  'uganda': 'UG', 'ugandan': 'UG', 'ugandans': 'UG',
  'rwanda': 'RW', 'rwandan': 'RW', 'rwandans': 'RW',
  'benin': 'BJ', 'beninese': 'BJ',
  'angola': 'AO', 'angolan': 'AO', 'angolans': 'AO',
  'cameroon': 'CM', 'cameroonian': 'CM', 'cameroonians': 'CM',
  'senegal': 'SN', 'senegalese': 'SN',
  'mali': 'ML', 'malian': 'ML', 'malians': 'ML',
  'niger': 'NE', 'nigerien': 'NE', 'nigeriens': 'NE',
  'togo': 'TG', 'togolese': 'TG',
  'gabon': 'GA', 'gabonese': 'GA',
  'egypt': 'EG', 'egyptian': 'EG', 'egyptians': 'EG',
  'morocco': 'MA', 'moroccan': 'MA', 'moroccans': 'MA',
  'zimbabwe': 'ZW', 'zimbabwean': 'ZW', 'zimbabweans': 'ZW',
  'zambia': 'ZM', 'zambian': 'ZM', 'zambians': 'ZM',
  'malawi': 'MW', 'malawian': 'MW', 'malawians': 'MW',
  'mozambique': 'MZ', 'mozambican': 'MZ', 'mozambicans': 'MZ',
  'namibia': 'NA', 'namibian': 'NA', 'namibians': 'NA',
  'botswana': 'BW', 'motswana': 'BW', 'batswana': 'BW',
  'madagascar': 'MG', 'malagasy': 'MG',
  'somalia': 'SO', 'somali': 'SO', 'somalian': 'SO',
  'sudan': 'SD', 'sudanese': 'SD',
  'libya': 'LY', 'libyan': 'LY', 'libyans': 'LY',
  'tunisia': 'TN', 'tunisian': 'TN', 'tunisians': 'TN',
  'algeria': 'DZ', 'algerian': 'DZ', 'algerians': 'DZ',
  'liberia': 'LR', 'liberian': 'LR', 'liberians': 'LR',
  'guinea': 'GN', 'guinean': 'GN', 'guineans': 'GN',
  'djibouti': 'DJ', 'djiboutian': 'DJ', 'djiboutians': 'DJ',
  'eritrea': 'ER', 'eritrean': 'ER', 'eritreans': 'ER',
  'usa': 'US', 'america': 'US', 'american': 'US', 'americans': 'US',
  'uk': 'GB', 'britain': 'GB', 'british': 'GB', 'england': 'GB', 'english': 'GB',
  'france': 'FR', 'french': 'FR',
  'germany': 'DE', 'german': 'DE', 'germans': 'DE',
  'canada': 'CA', 'canadian': 'CA', 'canadians': 'CA',
  'australia': 'AU', 'australian': 'AU', 'australians': 'AU',
  'brazil': 'BR', 'brazilian': 'BR', 'brazilians': 'BR',
  'india': 'IN', 'indian': 'IN', 'indians': 'IN',
  'china': 'CN', 'chinese': 'CN',
  'japan': 'JP', 'japanese': 'JP',
  'mexico': 'MX', 'mexican': 'MX', 'mexicans': 'MX',
  'argentina': 'AR', 'argentinian': 'AR', 'argentinians': 'AR', 'argentine': 'AR',
  'colombia': 'CO', 'colombian': 'CO', 'colombians': 'CO',
  'peru': 'PE', 'peruvian': 'PE', 'peruvians': 'PE',
  'chile': 'CL', 'chilean': 'CL', 'chileans': 'CL',
  'venezuela': 'VE', 'venezuelan': 'VE', 'venezuelans': 'VE',
  'spain': 'ES', 'spanish': 'ES',
  'portugal': 'PT', 'portuguese': 'PT',
  'italy': 'IT', 'italian': 'IT', 'italians': 'IT',
  'netherlands': 'NL', 'dutch': 'NL', 'holland': 'NL',
  'belgium': 'BE', 'belgian': 'BE', 'belgians': 'BE',
  'switzerland': 'CH', 'swiss': 'CH',
  'sweden': 'SE', 'swedish': 'SE',
  'norway': 'NO', 'norwegian': 'NO', 'norwegians': 'NO',
  'finland': 'FI', 'finnish': 'FI',
  'denmark': 'DK', 'danish': 'DK',
  'poland': 'PL', 'polish': 'PL',
  'russia': 'RU', 'russian': 'RU', 'russians': 'RU',
  'ukraine': 'UA', 'ukrainian': 'UA', 'ukrainians': 'UA',
  'turkey': 'TR', 'turkish': 'TR',
  'iran': 'IR', 'iranian': 'IR', 'iranians': 'IR',
  'iraq': 'IQ', 'iraqi': 'IQ', 'iraqis': 'IQ',
  'saudi': 'SA',
  'pakistan': 'PK', 'pakistani': 'PK', 'pakistanis': 'PK',
  'bangladesh': 'BD', 'bangladeshi': 'BD', 'bangladeshis': 'BD',
  'indonesia': 'ID', 'indonesian': 'ID', 'indonesians': 'ID',
  'philippines': 'PH', 'philippine': 'PH', 'filipino': 'PH', 'filipinos': 'PH',
  'vietnam': 'VN', 'vietnamese': 'VN',
  'thailand': 'TH', 'thai': 'TH',
  'malaysia': 'MY', 'malaysian': 'MY', 'malaysians': 'MY',
};

// Pre-sorted entries (longest key first) for greedy NL matching
const NL_ENTRIES_SORTED = Object.entries(NL_TO_CODE).sort((a, b) => b[0].length - a[0].length);

/**
 * Return full country name from ISO code, or the code itself if unknown.
 */
function getCountryName(code) {
  return CODE_TO_NAME[code] || code;
}

/**
 * Find a country ISO code from a natural-language query string.
 * Tries multi-word matches first to avoid partial collisions (e.g. "niger" inside "nigeria").
 */
function findCountryInQuery(query) {
  const lower = query.toLowerCase();
  for (const [phrase, code] of NL_ENTRIES_SORTED) {
    if (phrase.includes(' ')) {
      if (lower.includes(phrase)) return code;
    } else {
      if (new RegExp(`\\b${phrase}\\b`).test(lower)) return code;
    }
  }
  return null;
}

module.exports = { CODE_TO_NAME, NL_TO_CODE, getCountryName, findCountryInQuery };
