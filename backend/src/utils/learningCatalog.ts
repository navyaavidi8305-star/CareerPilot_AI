import { SKILL_SUBTOPICS, getRoleSkillSet } from './careerCatalog';
import { canonicalSkillName, isDuplicateKey, skillKey } from './skillGapUtils';

export type LearningLanguage = 'English' | 'Telugu' | 'Hindi';
export type LearningLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface CuratedVideo {
  videoId: string;
  title: string;
  channel: string;
}

export interface LearningSubject {
  key: string;
  title: string;
  description: string;
  skills: string[];
  level: LearningLevel;
  category: string;
  topics: string[];
  curatedVideos: CuratedVideo[];
}

const subject = (
  key: string,
  title: string,
  skills: string[],
  level: LearningLevel,
  category: string,
  description: string,
  curatedVideos: CuratedVideo[] = [],
  topics?: string[]
): LearningSubject => ({
  key,
  title,
  description,
  skills,
  level,
  category,
  topics: topics || skills.flatMap(name => SKILL_SUBTOPICS[name] || []).slice(0, 8),
  curatedVideos,
});

const video = (videoId: string, title: string, channel: string): CuratedVideo => ({ videoId, title, channel });

export const LEARNING_SUBJECTS: LearningSubject[] = [
  subject('dsa', 'Data Structures & Algorithms', ['Data Structures', 'Algorithms', 'Problem Solving'], 'Intermediate', 'Computer Science', 'Build the problem-solving foundation required for technical interviews and strong engineering work.', [
    video('RBSGKlAvoiM', 'Data Structures Easy to Advanced - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('system-design', 'System Design', ['System Design'], 'Advanced', 'Software Engineering', 'Learn how to design reliable, scalable systems and explain trade-offs in interviews.', [
    video('C842vFY5kRo', 'System Design Interview - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('python', 'Python Programming', ['Python'], 'Beginner', 'Programming', 'Learn Python from the basics through functions, modules and practical automation.', [
    video('rfscVS0vtbw', 'Learn Python - Full Course for Beginners', 'freeCodeCamp.org'),
  ]),
  subject('python-data', 'Python for Data Analysis', ['Pandas & NumPy', 'Data Cleaning', 'Data Visualization'], 'Intermediate', 'Data & Analytics', 'Analyze real datasets with pandas, NumPy and visualization libraries.', [
    video('r-uOLxNrNk8', 'Python for Data Science - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('javascript', 'JavaScript', ['JavaScript'], 'Beginner', 'Web Development', 'Master modern JavaScript: types, functions, DOM, async code and modules.', [
    video('PkZNo7MFNFg', 'JavaScript Programming - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('typescript', 'TypeScript', ['TypeScript'], 'Intermediate', 'Web Development', 'Add type safety to JavaScript applications with interfaces, generics and narrowing.', [
    video('BwuLxPH8IDs', 'TypeScript Course for Beginners', 'freeCodeCamp.org'),
  ]),
  subject('react', 'React', ['React', 'State Management'], 'Intermediate', 'Web Development', 'Build component-driven interfaces with React hooks, routing and state management.', [
    video('bMknfKXIFA8', 'React Course - Beginner to Advanced', 'freeCodeCamp.org'),
  ]),
  subject('nextjs', 'Next.js', ['Next.js'], 'Advanced', 'Web Development', 'Build production full-stack apps with the Next.js app router, server components and deployment.', [
    video('wm5gMKuwSYk', 'Next.js Full Course', 'freeCodeCamp.org'),
  ]),
  subject('nodejs', 'Node.js & Express', ['Node.js', 'Express'], 'Intermediate', 'Web Development', 'Build REST APIs and backend services with Node.js, Express and authentication.', [
    video('fBNz5xF-Kx4', 'Node.js & Express Full Course', 'freeCodeCamp.org'),
  ]),
  subject('html-css', 'HTML & CSS', ['HTML & CSS', 'Responsive Design'], 'Beginner', 'Web Development', 'Learn semantic HTML, modern CSS layout, responsive design and accessibility fundamentals.', [
    video('lCxcTsOHrjo', 'Tailwind CSS Full Course', 'freeCodeCamp.org'),
  ]),
  subject('sql', 'SQL & Databases', ['SQL', 'PostgreSQL'], 'Beginner', 'Data & Analytics', 'Write SQL confidently, model schemas and optimize queries for real applications.', [
    video('HXV3zeQKqGY', 'SQL Tutorial - Full Database Course', 'freeCodeCamp.org'),
  ]),
  subject('mongodb', 'MongoDB & NoSQL', ['MongoDB'], 'Intermediate', 'Data & Analytics', 'Work with documents, aggregation pipelines and indexes in MongoDB.', [
    video('ofme2o29ngU', 'MongoDB Full Course', 'freeCodeCamp.org'),
  ]),
  subject('git', 'Git & GitHub', ['Git & GitHub'], 'Beginner', 'Engineering Practices', 'Use Git confidently for branching, pull requests and collaborative development.', [
    video('RGOj5yH7evk', 'Git & GitHub Crash Course', 'freeCodeCamp.org'),
  ]),
  subject('docker', 'Docker', ['Docker'], 'Intermediate', 'DevOps & Cloud', 'Containerize applications with Dockerfiles, Compose and multi-stage builds.', [
    video('pg19Z8LL06w', 'Docker Tutorial for Beginners', 'freeCodeCamp.org'),
  ]),
  subject('kubernetes', 'Kubernetes', ['Kubernetes'], 'Advanced', 'DevOps & Cloud', 'Deploy and operate containerized workloads on Kubernetes.', [
    video('X48VuDVv0do', 'Kubernetes Course - Full Beginner Tutorial', 'freeCodeCamp.org'),
  ]),
  subject('aws', 'AWS Cloud', ['Cloud (AWS)'], 'Intermediate', 'DevOps & Cloud', 'Learn core AWS services, IAM, networking and architectural best practices.', [
    video('Ia-UEYYR44s', 'AWS Certified Solutions Architect - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('devops', 'CI/CD & DevOps', ['CI/CD', 'Linux & Networking', 'Monitoring'], 'Intermediate', 'DevOps & Cloud', 'Build reliable delivery pipelines and operate production systems.', [
    video('pg19Z8LL06w', 'Docker & DevOps Tutorial for Beginners', 'freeCodeCamp.org'),
  ]),
  subject('machine-learning', 'Machine Learning', ['Machine Learning', 'Feature Engineering'], 'Intermediate', 'AI & Machine Learning', 'Understand supervised learning, model evaluation and feature engineering.', [
    video('i_LwzRVP7bg', 'Machine Learning Full Course', 'freeCodeCamp.org'),
  ]),
  subject('deep-learning', 'Deep Learning', ['Deep Learning', 'PyTorch/TensorFlow', 'Math for ML'], 'Advanced', 'AI & Machine Learning', 'Build and train neural networks with PyTorch or TensorFlow.', []),
  subject('llm-engineering', 'LLMs & Prompt Engineering', ['LLMs & Prompt Engineering', 'Model Deployment', 'MLOps'], 'Advanced', 'AI & Machine Learning', 'Build RAG systems, agents and evaluations with production guardrails.', []),
  subject('data-analysis', 'Data Analysis & Visualization', ['Excel', 'Statistics', 'Data Visualization', 'Power BI / Tableau', 'Dashboard Design'], 'Beginner', 'Data & Analytics', 'Turn raw data into clear business insights and dashboards.', [
    video('r-uOLxNrNk8', 'Python for Data Science - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('data-engineering', 'Data Engineering', ['Data Pipelines', 'Big Data (Spark)'], 'Advanced', 'Data & Analytics', 'Build batch and streaming pipelines with orchestration and data quality checks.', [
    video('PHsC_t0j1dU', 'Data Engineering Full Course', 'freeCodeCamp.org'),
  ]),
  subject('cybersecurity', 'Cybersecurity', ['Web Security', 'Cryptography', 'Penetration Testing', 'SIEM', 'Secure Coding', 'Incident Response', 'Threat Modeling'], 'Intermediate', 'Security', 'Learn defensive and offensive security fundamentals with hands-on labs.', [
    video('9HOpanT0GRs', 'CS50 Cybersecurity - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('react-native', 'React Native', ['React Native', 'Mobile UI/UX'], 'Intermediate', 'Mobile Development', 'Build cross-platform mobile apps with React Native.', [
    video('0-S5a0eXPoc', 'React Native Full Course', 'freeCodeCamp.org'),
  ]),
  subject('flutter', 'Flutter', ['Flutter', 'Dart'], 'Intermediate', 'Mobile Development', 'Build cross-platform mobile apps with Flutter and Dart.', [
    video('VPvVD8t02U8', 'Flutter Full Course', 'freeCodeCamp.org'),
  ]),
  subject('spring-boot', 'Spring Boot', ['Authentication & Security'], 'Intermediate', 'Backend Development', 'Build enterprise Java APIs with Spring Boot and Spring Security.', [
    video('9SGDpanrc8U', 'Spring Boot Full Course', 'freeCodeCamp.org'),
  ]),
  subject('graphql', 'GraphQL', ['REST APIs'], 'Intermediate', 'Backend Development', 'Design schemas, resolvers and clients for efficient APIs.', [
    video('ed8SzALpx1Q', 'GraphQL Full Course', 'freeCodeCamp.org'),
  ]),
  subject('golang', 'Go Programming', ['Algorithms'], 'Intermediate', 'Programming', 'Learn Go syntax, concurrency and HTTP services.', [
    video('YS4e4q9oBaU', 'Learn Go Programming - Full Course', 'freeCodeCamp.org'),
  ]),
  subject('python-automation', 'Python Automation', ['Python'], 'Beginner', 'Programming', 'Automate repetitive work with scripts, APIs and scheduled jobs.', [
    video('PXMJ6FS7llk', 'Python Automation Full Course', 'freeCodeCamp.org'),
  ]),
  subject('ux-design', 'UI/UX Design', ['User Research', 'Figma', 'Wireframing & Prototyping', 'Usability Testing', 'Design Systems', 'Interaction Design', 'Design Portfolio'], 'Beginner', 'Design', 'Research users, design flows and build a portfolio-ready case study.', []),
  subject('product-management', 'Product Management', ['Product Strategy', 'Roadmapping', 'Agile/Scrum', 'Product Analytics', 'Stakeholder Management'], 'Intermediate', 'Product', 'Learn discovery, prioritization, roadmapping and product analytics.', []),
  subject('qa-testing', 'QA & Test Automation', ['Manual Testing', 'Test Automation (Playwright)', 'API Testing'], 'Beginner', 'Quality Engineering', 'Write test plans, automate UI/API flows and report defects clearly.', []),
  subject('blockchain', 'Blockchain & Web3', ['Blockchain Fundamentals', 'Solidity', 'Ethereum & Web3', 'Smart Contract Security', 'dApp Development'], 'Advanced', 'Blockchain', 'Build and audit smart contracts and decentralized applications.', []),
  subject('ui-mobile', 'Mobile UI/UX', ['Mobile UI/UX', 'App Store Deployment'], 'Intermediate', 'Design', 'Design and ship polished mobile experiences.', []),
];

const aliasMap: Record<string, string> = {
  js: 'javascript', ts: 'typescript', nodejs: 'nodejs', node: 'nodejs',
  reactjs: 'react', nextjs: 'nextjs', postgres: 'sql', postgresql: 'sql',
  k8s: 'kubernetes', aws: 'aws', ml: 'machine-learning',
  'machine learning': 'machine-learning', 'deep learning': 'deep-learning',
  pandas: 'python-data', numpy: 'python-data', 'power bi': 'data-analysis',
  tableau: 'data-analysis', figma: 'ux-design', 'node.js': 'nodejs',
  express: 'nodejs', 'html': 'html-css', css: 'html-css',
  'ci/cd': 'devops', cicd: 'devops', devops: 'devops',
  'react native': 'react-native', flutter: 'flutter', dart: 'flutter',
  solidity: 'blockchain', 'web security': 'cybersecurity',
  'penetration testing': 'cybersecurity', 'llms & prompt engineering': 'llm-engineering',
  'prompt engineering': 'llm-engineering', 'model deployment': 'deep-learning',
};

function subjectKeyForSkill(skillName: string): string | null {
  const canonical = canonicalSkillName(skillName);
  const key = skillKey(canonical);
  const alias = aliasMap[canonical.toLowerCase()];
  if (alias) return alias;
  for (const item of LEARNING_SUBJECTS) {
    for (const skill of item.skills) {
      const candidate = skillKey(canonicalSkillName(skill));
      if (isDuplicateKey(candidate, key)) return item.key;
    }
  }
  return null;
}

export function getSubjectByKey(key: string): LearningSubject | null {
  const normalized = skillKey(key);
  return LEARNING_SUBJECTS.find(item => skillKey(item.key) === normalized) || null;
}

export function subjectsForSkills(skills: string[]): LearningSubject[] {
  const keys = new Set<string>();
  for (const skill of skills) {
    const key = subjectKeyForSkill(skill);
    if (key) keys.add(key);
  }
  return LEARNING_SUBJECTS.filter(item => keys.has(item.key));
}

export function subjectsForRole(role: string): LearningSubject[] {
  const roleSkills = getRoleSkillSet(role);
  return subjectsForSkills([...roleSkills.core, ...roleSkills.advanced]);
}

export function nextTopicsForSubject(
  item: LearningSubject,
  completedTopics: string[],
  limit = 5
): string[] {
  const completedKeys = completedTopics.map(skillKey);
  return item.topics
    .filter(topic => !completedKeys.some(key => isDuplicateKey(key, skillKey(topic))))
    .slice(0, limit);
}

export function languageSearchSuffix(language: LearningLanguage): string {
  if (language === 'Telugu') return 'తెలుగులో full course';
  if (language === 'Hindi') return 'हिंदी में full course';
  return 'full course';
}

export function levelSearchSuffix(level: LearningLevel): string {
  if (level === 'Beginner') return 'for beginners';
  if (level === 'Advanced') return 'advanced tutorial';
  return 'intermediate tutorial';
}
