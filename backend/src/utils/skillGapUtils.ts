export const VALID_LEVELS = ['NONE', 'BEGINNER', 'INTERMEDIATE', 'ADVANCED', 'EXPERT'];
const VALID_PRIORITIES = ['CRITICAL', 'RECOMMENDED', 'OPTIONAL'];
const VALID_CATEGORIES = ['TECHNICAL', 'SOFT', 'DOMAIN'];

const LEVEL_VALUES: Record<string, number> = {
  NONE: 0,
  BEGINNER: 25,
  INTERMEDIATE: 50,
  ADVANCED: 75,
  EXPERT: 100,
};

const CANONICAL_SKILLS: Record<string, string> = {
  html: 'HTML', html5: 'HTML', css: 'CSS', css3: 'CSS',
  javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript', ts: 'TypeScript',
  python: 'Python', java: 'Java', react: 'React', reactjs: 'React',
  reactnative: 'React Native', nodejs: 'Node.js', node: 'Node.js',
  express: 'Express.js', expressjs: 'Express.js',
  nextjs: 'Next.js', next: 'Next.js', angular: 'Angular', vue: 'Vue.js', vuejs: 'Vue.js',
  sql: 'SQL', mysql: 'MySQL', postgresql: 'PostgreSQL', postgres: 'PostgreSQL', mongodb: 'MongoDB',
  aws: 'AWS', gcp: 'GCP', azure: 'Azure', docker: 'Docker', kubernetes: 'Kubernetes',
  k8s: 'Kubernetes', terraform: 'Terraform', jenkins: 'Jenkins',
  git: 'Git', github: 'GitHub', linux: 'Linux',
  machinelearning: 'Machine Learning', ml: 'Machine Learning',
  datascience: 'Data Science', deeplearning: 'Deep Learning',
  restapi: 'REST API', apis: 'REST API', api: 'REST API',
  oop: 'OOP', dsa: 'Data Structures', datastructures: 'Data Structures', algorithms: 'Algorithms',
  pandas: 'Pandas', numpy: 'NumPy', statistics: 'Statistics', excel: 'Excel',
  powerbi: 'Power BI', tableau: 'Tableau', dataanalysis: 'Data Analysis',
  dataanalytics: 'Data Analytics', datavisualization: 'Data Visualization',
  datacleaning: 'Data Cleaning', featureengineering: 'Feature Engineering',
  modeldeployment: 'Model Deployment', mlops: 'MLOps',
  pytorch: 'PyTorch', tensorflow: 'TensorFlow', scikitlearn: 'Scikit-learn',
  systemdesign: 'System Design', microservices: 'Microservices',
  cicd: 'CI/CD', devops: 'DevOps', redis: 'Redis', kafka: 'Kafka',
  cybersecurity: 'Cybersecurity', testing: 'Testing', agile: 'Agile',
  productmanagement: 'Product Management', uiux: 'UI/UX', figma: 'Figma',
};

export function skillKey(name: unknown): string {
  return String(name ?? '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

export function isDuplicateKey(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const shorter = a.length <= b.length ? a : b;
  const longer = shorter === a ? b : a;
  if (shorter.length < 4 || !longer.includes(shorter)) return false;
  const index = longer.indexOf(shorter);
  const before = index > 0 ? longer[index - 1] : '';
  const after = longer[index + shorter.length] || '';
  const isWordChar = (ch: string) => /[a-z0-9]/.test(ch);
  return !isWordChar(before) && !isWordChar(after);
}

export function canonicalSkillName(rawName: unknown): string {
  const cleaned = String(rawName ?? '').trim().replace(/\s+/g, ' ');
  const key = skillKey(cleaned);
  if (!key) return '';
  return CANONICAL_SKILLS[key] || cleaned;
}

export function pickValid(value: unknown, allowed: string[], fallback: string): string {
  const upper = String(value ?? '').trim().toUpperCase();
  return allowed.includes(upper) ? upper : fallback;
}

function validLevel(value: unknown, fallback: string): string {
  return pickValid(value, VALID_LEVELS, fallback);
}

export function computeGapFromLevels(currentLevel: string, requiredLevel: string): number {
  const current = LEVEL_VALUES[currentLevel] ?? 0;
  const required = LEVEL_VALUES[requiredLevel] ?? 50;
  return Math.max(0, Math.min(100, required - current));
}

// A skill explicitly listed on the user's resume/profile implies at least working knowledge.
// Without an explicit level we assume INTERMEDIATE rather than NONE.
export function normalizeUserSkillLevel(level: unknown): string {
  const raw = String(level ?? '').trim();
  if (!raw) return 'INTERMEDIATE';
  const upper = raw.toUpperCase();
  if (VALID_LEVELS.includes(upper)) return upper;

  const num = parseFloat(raw);
  if (Number.isFinite(num)) {
    if (num <= 5) {
      if (num >= 4.5) return 'EXPERT';
      if (num >= 3.5) return 'ADVANCED';
      if (num >= 2.5) return 'INTERMEDIATE';
      if (num >= 1) return 'BEGINNER';
      return 'NONE';
    }
    if (num <= 100) {
      if (num >= 85) return 'EXPERT';
      if (num >= 65) return 'ADVANCED';
      if (num >= 40) return 'INTERMEDIATE';
      if (num > 0) return 'BEGINNER';
      return 'NONE';
    }
  }

  if (/expert|master/i.test(upper)) return 'EXPERT';
  if (/advanc|fluent|strong|proficien/i.test(upper)) return 'ADVANCED';
  if (/intermediat|medium|moderate/i.test(upper)) return 'INTERMEDIATE';
  if (/beginner|basic|novice|familiar/i.test(upper)) return 'BEGINNER';
  return 'BEGINNER';
}

export interface UserSkillRef {
  name: string;
  level?: unknown;
}

export function buildUserSkillIndex(userSkills: UserSkillRef[]): Map<string, string> {
  const index = new Map<string, string>();
  for (const skill of userSkills || []) {
    const name = canonicalSkillName((skill as any)?.name);
    const key = skillKey(name);
    if (!key || key.length < 2) continue;
    const level = normalizeUserSkillLevel((skill as any)?.level);

    let matchedKey: string | null = null;
    for (const existingKey of index.keys()) {
      if (isDuplicateKey(existingKey, key)) { matchedKey = existingKey; break; }
    }

    if (matchedKey) {
      // keep the highest level among duplicates of the same skill
      const existing = index.get(matchedKey)!;
      if (LEVEL_VALUES[level] > LEVEL_VALUES[existing]) {
        index.delete(matchedKey);
        index.set(key, level);
      }
      continue;
    }
    index.set(key, level);
  }
  return index;
}

function findUserLevel(index: Map<string, string>, skillName: string): string | null {
  const key = skillKey(skillName);
  for (const [existingKey, level] of index.entries()) {
    if (isDuplicateKey(existingKey, key)) return level;
  }

  // composite skills like "HTML & CSS" or "PyTorch/TensorFlow" require every part
  const parts = skillName.split(/\s*(?:&|\/|,|\band\b)\s*/i).filter(p => p.trim().length > 0);
  if (parts.length > 1) {
    let lowest: string | null = null;
    for (const part of parts) {
      const level = findUserLevel(index, part);
      if (level === null) return null;
      if (lowest === null || (LEVEL_VALUES[level] ?? 0) < (LEVEL_VALUES[lowest] ?? 0)) {
        lowest = level;
      }
    }
    return lowest;
  }

  return null;
}

/**
 * Sanitizes AI/local skill-gap output:
 * - canonicalizes + de-duplicates skill names (HTML5 -> HTML etc.)
 * - overrides currentLevel with the USER'S ACTUAL resume/profile skill level when matched
 * - recomputes the gap deterministically from levels (no more arbitrary 100%)
 * - validates priority/category fields
 */
export function sanitizeGaps(
  aiGaps: unknown,
  userSkills: UserSkillRef[]
): Array<{
  skillName: string;
  currentLevel: string;
  requiredLevel: string;
  gap: number;
  priority: string;
  category: string;
}> {
  const userIndex = buildUserSkillIndex(userSkills);
  const seenGaps = new Map<string, any>();

  for (const raw of Array.isArray(aiGaps) ? aiGaps : []) {
    if (!raw || typeof raw !== 'object') continue;

    const skillName = canonicalSkillName(
      (raw as any).skillName ?? (raw as any).skill ?? (raw as any).name
    );
    const key = skillKey(skillName);
    if (key.length < 2) continue;

    let matchedKey: string | null = null;
    for (const existingKey of seenGaps.keys()) {
      if (isDuplicateKey(existingKey, key)) { matchedKey = existingKey; break; }
    }

    // user's real level wins over whatever the AI guessed
    const userLevel = findUserLevel(userIndex, skillName);
    const currentLevel = userLevel ?? validLevel((raw as any).currentLevel, 'NONE');
    const requiredLevel = validLevel((raw as any).requiredLevel, 'INTERMEDIATE');

    const sanitized = {
      skillName,
      currentLevel,
      requiredLevel,
      gap: computeGapFromLevels(currentLevel, requiredLevel),
      priority: pickValid((raw as any).priority, VALID_PRIORITIES, 'RECOMMENDED'),
      category: pickValid((raw as any).category, VALID_CATEGORIES, 'TECHNICAL'),
    };

    if (matchedKey) continue;
    seenGaps.set(key, sanitized);
  }

  // skills already at/above the required level are not gaps — drop them
  return [...seenGaps.values()].filter(g => g.gap > 0);
}
