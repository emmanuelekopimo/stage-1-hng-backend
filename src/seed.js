/**
 * Deterministic seeder – inserts exactly 2026 profiles into the database.
 * Re-running is safe: INSERT OR IGNORE skips rows whose name already exists.
 */
const { v7: uuidv7 } = require('uuid');
const db = require('./db');

// ── Name pools ──────────────────────────────────────────────────────────────

const maleFirstNames = [
  // African
  'Emeka', 'Chidi', 'Kwame', 'Kofi', 'Tunde', 'Wole', 'Dele', 'Femi', 'Adebayo', 'Chigozie',
  'Ikenna', 'Obinna', 'Nnamdi', 'Uche', 'Ifeanyi', 'Kelechi', 'Ugochukwu', 'Obi', 'Kayode', 'Lanre',
  'Gbenga', 'Segun', 'Biodun', 'Akin', 'Yemi', 'Tobi', 'Dayo', 'Tayo', 'Sola', 'Lekan',
  'Gbola', 'Bolu', 'Tolu', 'Tunji', 'Kunle', 'Leke', 'Dare', 'Wale', 'Jide', 'Kola',
  'Seun', 'Bode', 'Olu', 'Ade', 'Goke', 'Ekene', 'Chibuzor', 'Musa', 'Ibrahim', 'Aliyu',
  'Kwabena', 'Kweku', 'Fiifi', 'Nana', 'Kofi', 'Yaw', 'Kwesi', 'Abioye', 'Adisa', 'Adewale',
  'Babatunde', 'Bamidele', 'Bolaji', 'Chukwuemeka', 'Emmanuel', 'Enoch', 'Ezekiel', 'Felix', 'Godwin', 'Henry',
  'Julius', 'Kenneth', 'Leonard', 'Maxwell', 'Nathaniel', 'Olumide', 'Prince', 'Raphael', 'Samuel', 'Victor',
  // International
  'James', 'John', 'Robert', 'Michael', 'William', 'David', 'Richard', 'Joseph', 'Thomas', 'Charles',
  'Christopher', 'Daniel', 'Matthew', 'Anthony', 'Mark', 'Steven', 'Paul', 'Andrew', 'Joshua', 'Kevin',
  'Brian', 'George', 'Timothy', 'Edward', 'Jason', 'Ryan', 'Jacob', 'Nicholas', 'Eric', 'Jonathan',
  'Justin', 'Scott', 'Brandon', 'Benjamin', 'Samuel', 'Gregory', 'Frank', 'Alexander', 'Patrick', 'Jack',
  'Tyler', 'Aaron', 'Adam', 'Henry', 'Nathan', 'Peter', 'Zachary', 'Kyle', 'Noah', 'Ethan',
  'Carlos', 'Luis', 'Diego', 'Juan', 'Miguel', 'Andres', 'Roberto', 'Fernando', 'Jorge', 'Pablo',
  'Pierre', 'Jean', 'Marc', 'Hans', 'Klaus', 'Raj', 'Amit', 'Sanjay', 'Wei', 'Hiroshi',
  'Kenji', 'Takashi', 'Omar', 'Ahmed', 'Mohamed', 'Ali', 'Yusuf', 'Hassan', 'Khalid', 'Tariq',
];

const femaleFirstNames = [
  // African
  'Amara', 'Ngozi', 'Adaeze', 'Chioma', 'Chiamaka', 'Adaora', 'Nkechi', 'Nneka', 'Chinwe', 'Ifeoma',
  'Ugochi', 'Adanna', 'Amaka', 'Ebele', 'Kemi', 'Funmi', 'Bisi', 'Lola', 'Yetunde', 'Shade',
  'Nike', 'Titi', 'Lara', 'Layo', 'Toyin', 'Bolanle', 'Remi', 'Wunmi', 'Folake', 'Bola',
  'Abeni', 'Buki', 'Bunmi', 'Ayo', 'Tinuke', 'Dupe', 'Yinka', 'Peju', 'Obiageli', 'Chinyere',
  'Nwanneka', 'Aisha', 'Fatima', 'Zainab', 'Hauwa', 'Mariama', 'Kadiatou', 'Awa', 'Fatou', 'Aminata',
  'Akua', 'Efua', 'Esi', 'Araba', 'Adwoa', 'Abena', 'Maame', 'Adjoa', 'Akosua', 'Yaa',
  'Blessing', 'Charity', 'Comfort', 'Doris', 'Esther', 'Florence', 'Grace', 'Helen', 'Irene', 'Joyce',
  'Lydia', 'Margaret', 'Nadia', 'Patience', 'Queenie', 'Rachel', 'Stella', 'Theodora', 'Ursula', 'Vera',
  // International
  'Mary', 'Patricia', 'Linda', 'Barbara', 'Elizabeth', 'Jennifer', 'Maria', 'Susan', 'Dorothy', 'Lisa',
  'Nancy', 'Karen', 'Betty', 'Helen', 'Sandra', 'Donna', 'Carol', 'Ruth', 'Sharon', 'Michelle',
  'Laura', 'Sarah', 'Kimberly', 'Jessica', 'Angela', 'Melissa', 'Brenda', 'Amy', 'Anna', 'Rebecca',
  'Kathleen', 'Pamela', 'Martha', 'Amanda', 'Stephanie', 'Carolyn', 'Christine', 'Marie', 'Janet', 'Catherine',
  'Frances', 'Joyce', 'Diane', 'Alice', 'Emma', 'Olivia', 'Sophia', 'Isabella', 'Mia', 'Charlotte',
  'Sofia', 'Camila', 'Valentina', 'Ana', 'Rosa', 'Carmen', 'Elena', 'Sophie', 'Claire', 'Isabelle',
  'Priya', 'Ananya', 'Deepa', 'Rani', 'Yui', 'Sakura', 'Mei', 'Xiu', 'Layla', 'Hana',
  'Fatimah', 'Mariam', 'Nour', 'Salma', 'Yasmine', 'Zara', 'Leila', 'Dina', 'Rania', 'Sana',
];

const lastNames = [
  'Smith', 'Johnson', 'Williams', 'Brown', 'Jones', 'Miller', 'Davis', 'Garcia', 'Rodriguez', 'Wilson',
  'Martinez', 'Anderson', 'Taylor', 'Thomas', 'Hernandez', 'Moore', 'Martin', 'Jackson', 'Thompson', 'White',
  'Lopez', 'Lee', 'Gonzalez', 'Harris', 'Clark', 'Lewis', 'Robinson', 'Walker', 'Perez', 'Hall',
  'Young', 'Allen', 'Sanchez', 'Wright', 'King', 'Scott', 'Green', 'Baker', 'Adams', 'Nelson',
  'Okafor', 'Adeyemi', 'Nwosu', 'Okonkwo', 'Adesanya', 'Bakare', 'Adeleke', 'Mensah', 'Asante', 'Owusu',
  'Boateng', 'Adjei', 'Osei', 'Antwi', 'Diallo', 'Traore', 'Coulibaly', 'Camara', 'Keita', 'Bah',
  'Eze', 'Chukwu', 'Nwobi', 'Abubakar', 'Musa', 'Nguyen', 'Pham', 'Tran', 'Kumar', 'Sharma',
  'Patel', 'Singh', 'Gupta', 'Nakamura', 'Yamamoto', 'Suzuki', 'Tanaka', 'Dupont', 'Laurent', 'Bernard',
  'Muller', 'Schulz', 'Weber', 'Schmidt', 'Carter', 'Mitchell', 'Turner', 'Phillips', 'Evans', 'Edwards',
  'Collins', 'Stewart', 'Morris', 'Rogers', 'Reed', 'Cook', 'Morgan', 'Bell', 'Murphy', 'Bailey',
];

const countries = [
  { id: 'NG', name: 'Nigeria' },
  { id: 'KE', name: 'Kenya' },
  { id: 'GH', name: 'Ghana' },
  { id: 'ZA', name: 'South Africa' },
  { id: 'ET', name: 'Ethiopia' },
  { id: 'TZ', name: 'Tanzania' },
  { id: 'UG', name: 'Uganda' },
  { id: 'RW', name: 'Rwanda' },
  { id: 'BJ', name: 'Benin' },
  { id: 'AO', name: 'Angola' },
  { id: 'CM', name: 'Cameroon' },
  { id: 'SN', name: 'Senegal' },
  { id: 'CI', name: 'Ivory Coast' },
  { id: 'ML', name: 'Mali' },
  { id: 'EG', name: 'Egypt' },
  { id: 'MA', name: 'Morocco' },
  { id: 'ZW', name: 'Zimbabwe' },
  { id: 'ZM', name: 'Zambia' },
  { id: 'US', name: 'United States' },
  { id: 'GB', name: 'United Kingdom' },
  { id: 'FR', name: 'France' },
  { id: 'DE', name: 'Germany' },
  { id: 'CA', name: 'Canada' },
  { id: 'AU', name: 'Australia' },
  { id: 'BR', name: 'Brazil' },
  { id: 'IN', name: 'India' },
  { id: 'CN', name: 'China' },
  { id: 'JP', name: 'Japan' },
  { id: 'MX', name: 'Mexico' },
  { id: 'AR', name: 'Argentina' },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function classifyAgeGroup(age) {
  if (age <= 12) return 'child';
  if (age <= 19) return 'teenager';
  if (age <= 59) return 'adult';
  return 'senior';
}

function getAge(i) {
  const phase = i % 20;
  if (phase < 2) return 3 + ((i * 7) % 10);          // children:   3–12  (~10 %)
  if (phase < 5) return 13 + ((i * 3) % 7);           // teenagers: 13–19  (~15 %)
  if (phase < 17) return 20 + ((i * 11) % 40);        // adults:    20–59  (~60 %)
  return 60 + ((i * 5) % 25);                         // seniors:   60–84  (~15 %)
}

function getGenderProbability(i) {
  return parseFloat((0.70 + (i % 30) * 0.01).toFixed(2));
}

function getCountryProbability(i) {
  return parseFloat((0.15 + (i % 50) * 0.01).toFixed(2));
}

function getCreatedAt(i) {
  const base = new Date('2026-01-01T00:00:00Z');
  base.setDate(base.getDate() + (i % 120));
  base.setHours(i % 24);
  base.setMinutes(i % 60);
  return base.toISOString().split('.')[0] + 'Z';
}

// ── Profile generation ───────────────────────────────────────────────────────

function generateProfiles() {
  const males = [];
  const females = [];

  for (const last of lastNames) {
    for (const first of maleFirstNames) {
      males.push(`${first} ${last}`);
    }
    for (const first of femaleFirstNames) {
      females.push(`${first} ${last}`);
    }
  }

  // Deduplicate while interleaving male / female for balanced distribution
  const usedNames = new Set();
  const nameEntries = [];
  let mi = 0;
  let fi = 0;

  while (nameEntries.length < 2026) {
    // Advance to the next unique male name
    while (mi < males.length && usedNames.has(males[mi])) mi++;
    if (mi < males.length && nameEntries.length < 2026) {
      usedNames.add(males[mi]);
      nameEntries.push({ name: males[mi], gender: 'male' });
      mi++;
    }

    // Advance to the next unique female name
    while (fi < females.length && usedNames.has(females[fi])) fi++;
    if (fi < females.length && nameEntries.length < 2026) {
      usedNames.add(females[fi]);
      nameEntries.push({ name: females[fi], gender: 'female' });
      fi++;
    }

    // Safety: if both pools are exhausted before 2026, stop
    if (mi >= males.length && fi >= females.length) break;
  }

  return nameEntries.slice(0, 2026).map((entry, i) => {
    const age = getAge(i);
    const country = countries[Math.floor(i / 2) % countries.length]; // each country gets both genders
    return {
      id: uuidv7(),
      name: entry.name,
      gender: entry.gender,
      gender_probability: getGenderProbability(i),
      age,
      age_group: classifyAgeGroup(age),
      country_id: country.id,
      country_name: country.name,
      country_probability: getCountryProbability(i),
      created_at: getCreatedAt(i),
    };
  });
}

// ── Public seed function ─────────────────────────────────────────────────────

function seed() {
  const current = db.prepare('SELECT COUNT(*) AS cnt FROM profiles').get();
  if (current.cnt >= 2026) {
    console.log(`Seed skipped: database already has ${current.cnt} profiles.`);
    return;
  }

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO profiles
      (id, name, gender, gender_probability, age, age_group,
       country_id, country_name, country_probability, created_at)
    VALUES
      (@id, @name, @gender, @gender_probability, @age, @age_group,
       @country_id, @country_name, @country_probability, @created_at)
  `);

  const insertAll = db.transaction((profiles) => {
    let inserted = 0;
    for (const profile of profiles) {
      const result = stmt.run(profile);
      if (result.changes > 0) inserted++;
    }
    return inserted;
  });

  const profiles = generateProfiles();
  const inserted = insertAll(profiles);
  console.log(`Seed complete: ${inserted} new profiles inserted (${profiles.length - inserted} already existed).`);
}

module.exports = { seed };
