import { canonicalSkillName, isDuplicateKey, skillKey } from './skillGapUtils';

export type SkillLevel = 'NONE' | 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type SkillCategory = 'TECHNICAL' | 'SOFT' | 'DOMAIN';

export interface RoleSkill {
  name: string;
  level: Exclude<SkillLevel, 'NONE'>;
  category: SkillCategory;
}

export interface RoleProject {
  title: string;
  description: string;
  subtopics: string[];
}

export interface RoleDefinition {
  id: string;
  title: string;
  aliases: string[];
  description: string;
  category: string;
  salaryRange: string;
  demand: string;
  growth: string;
  core: RoleSkill[];
  advanced: RoleSkill[];
  projects: RoleProject[];
  certifications: string[];
  interviewTopics: string[];
}

const skill = (
  name: string,
  level: Exclude<SkillLevel, 'NONE'> = 'INTERMEDIATE',
  category: SkillCategory = 'TECHNICAL'
): RoleSkill => ({ name, level, category });

export const SKILL_SUBTOPICS: Record<string, string[]> = {
  'HTML & CSS': ['Semantic HTML', 'Flexbox & CSS Grid', 'Responsive units & media queries', 'Forms & accessibility', 'CSS architecture'],
  JavaScript: ['Variables, types & functions', 'Arrays & objects', 'DOM & events', 'Async/await & promises', 'Modules & error handling'],
  TypeScript: ['Types & interfaces', 'Generics', 'Utility types', 'Type narrowing', 'Configuring tsconfig'],
  React: ['Components & props', 'State & hooks', 'Effects & lifecycle', 'Context & state management', 'Routing & forms'],
  'Next.js': ['App router & layouts', 'Server vs client components', 'Data fetching & caching', 'API routes', 'Deployment'],
  'Responsive Design': ['Mobile-first layouts', 'Breakpoints & fluid grids', 'Images & media', 'Testing on devices', 'Accessibility'],
  'State Management': ['Local vs global state', 'Context API', 'Redux Toolkit / Zustand', 'Server state & caching', 'Avoiding prop drilling'],
  'Git & GitHub': ['Branching & merging', 'Pull requests & reviews', 'Rebasing & conflict resolution', 'Conventional commits', 'GitHub Actions basics'],
  'REST APIs': ['HTTP methods & status codes', 'Request/response design', 'Pagination & filtering', 'Error handling', 'Consuming APIs with fetch/axios'],
  Testing: ['Unit vs integration tests', 'Test structure & assertions', 'Mocking dependencies', 'Coverage & CI', 'End-to-end basics'],
  'Performance Optimization': ['Profiling & measuring', 'Caching strategies', 'Code splitting & lazy loading', 'Bundle analysis', 'Core Web Vitals'],
  Accessibility: ['ARIA roles & labels', 'Keyboard navigation', 'Color contrast & focus', 'Screen reader testing', 'Semantic HTML'],
  'Node.js': ['Event loop & async I/O', 'Modules & npm', 'File system & streams', 'Environment config', 'Error handling'],
  Express: ['Routing & middleware', 'Request validation', 'Error middleware', 'Auth middleware', 'Project structure'],
  SQL: ['SELECT, JOIN & GROUP BY', 'Subqueries & CTEs', 'Window functions', 'Indexes & query plans', 'Schema design'],
  PostgreSQL: ['Data types & constraints', 'Transactions & isolation', 'Indexes & performance', 'JSONB & full-text search', 'Backups & migrations'],
  MongoDB: ['Documents & collections', 'CRUD & queries', 'Aggregation pipeline', 'Indexes', 'Schema design patterns'],
  'Authentication & Security': ['Password hashing', 'JWT & sessions', 'OAuth basics', 'Input validation & rate limiting', 'OWASP top risks'],
  'System Design': ['Requirements & trade-offs', 'Load balancing & caching', 'Database scaling', 'Queues & async processing', 'Reliability & monitoring'],
  Docker: ['Images & containers', 'Dockerfiles & layers', 'Volumes & networks', 'Docker Compose', 'Multi-stage builds'],
  Kubernetes: ['Pods, deployments & services', 'ConfigMaps & secrets', 'Ingress & networking', 'Scaling & probes', 'Helm basics'],
  'CI/CD': ['Pipeline stages', 'Automated tests & linting', 'Build & artifacts', 'Deployments & rollbacks', 'GitHub Actions / Jenkins'],
  'Cloud (AWS)': ['Core services (EC2, S3, RDS)', 'IAM & networking', 'Serverless (Lambda)', 'Monitoring & cost', 'Well-Architected basics'],
  'Redis & Caching': ['Cache patterns', 'TTL & eviction', 'Data structures', 'Pub/sub', 'Cache invalidation'],
  'Message Queues': ['Producer/consumer model', 'Delivery guarantees', 'Retries & dead letters', 'Kafka vs RabbitMQ', 'Ordering & partitioning'],
  'Linux & Networking': ['Shell & permissions', 'Processes & systemd', 'DNS, HTTP & TLS', 'Firewalls & ports', 'Troubleshooting tools'],
  Python: ['Syntax & data types', 'Functions & modules', 'OOP', 'File & API handling', 'Virtual envs & testing'],
  'Pandas & NumPy': ['DataFrames & Series', 'Cleaning & missing data', 'Grouping & joins', 'Vectorized operations', 'Time series basics'],
  Statistics: ['Descriptive statistics', 'Probability & distributions', 'Hypothesis testing', 'Regression basics', 'Interpreting p-values'],
  'Data Visualization': ['Chart selection', 'Matplotlib/Seaborn', 'Interactive dashboards', 'Design principles', 'Storytelling with data'],
  'Data Cleaning': ['Missing values', 'Outliers & duplicates', 'Type conversion', 'Feature scaling', 'Data validation'],
  'Machine Learning': ['Supervised vs unsupervised', 'Train/test splits & CV', 'Regression & classification', 'Evaluation metrics', 'Avoiding overfitting'],
  'Feature Engineering': ['Encoding categoricals', 'Scaling & normalization', 'Feature selection', 'Leakage prevention', 'Domain features'],
  'Deep Learning': ['Neural network basics', 'Activations & loss', 'Optimizers & regularization', 'CNNs & RNNs', 'Transfer learning'],
  'PyTorch/TensorFlow': ['Tensors & autograd', 'Model definition', 'Training loops', 'Datasets & dataloaders', 'Saving & serving models'],
  'Model Deployment': ['Serving via API', 'Batching & latency', 'Model versioning', 'Monitoring drift', 'Containerized deployment'],
  MLOps: ['Experiment tracking', 'CI/CD for models', 'Feature stores', 'Model registry', 'Monitoring & retraining'],
  'Math for ML': ['Linear algebra', 'Calculus & gradients', 'Probability', 'Optimization', 'Numerical stability'],
  'LLMs & Prompt Engineering': ['Transformer basics', 'Prompt patterns', 'RAG & embeddings', 'Evaluation', 'Safety & cost'],
  'Data Pipelines': ['ETL vs ELT', 'Orchestration (Airflow)', 'Idempotency', 'Data quality checks', 'Warehouse loading'],
  'Big Data (Spark)': ['RDDs & DataFrames', 'Transformations & actions', 'Partitioning', 'Joins & shuffles', 'Performance tuning'],
  Excel: ['Formulas & lookups', 'Pivot tables', 'Data cleaning', 'Charts & dashboards', 'What-if analysis'],
  'Power BI / Tableau': ['Data connections', 'Data modeling', 'Calculated fields', 'Interactive dashboards', 'Publishing & sharing'],
  'A/B Testing': ['Hypothesis & metrics', 'Sample size & power', 'Randomization', 'Significance & pitfalls', 'Reporting results'],
  'Data Storytelling': ['Audience & narrative', 'Choosing metrics', 'Visual hierarchy', 'Executive summaries', 'Stakeholder presentation'],
  'Dashboard Design': ['Metric selection', 'Layout & hierarchy', 'Filters & drilldowns', 'Performance', 'Accessibility'],
  Terraform: ['Providers & resources', 'State & workspaces', 'Modules', 'Variables & outputs', 'Plan/apply workflow'],
  Monitoring: ['Metrics & logs', 'Dashboards & alerts', 'SLOs & error budgets', 'Tracing', 'Incident response'],
  'Web Security': ['OWASP top 10', 'XSS & CSRF', 'SQL injection', 'Auth & session flaws', 'Secure headers'],
  Cryptography: ['Hashing vs encryption', 'Symmetric & asymmetric', 'TLS & certificates', 'Key management', 'Common pitfalls'],
  'Penetration Testing': ['Reconnaissance', 'Scanning & enumeration', 'Exploitation basics', 'Privilege escalation', 'Reporting'],
  SIEM: ['Log ingestion', 'Correlation rules', 'Alert triage', 'Incident timelines', 'Threat hunting'],
  'Secure Coding': ['Input validation', 'Secrets management', 'Dependency scanning', 'Least privilege', 'Secure design reviews'],
  'Incident Response': ['Detection & triage', 'Containment', 'Forensics', 'Communication', 'Post-incident review'],
  'Threat Modeling': ['Assets & trust boundaries', 'STRIDE', 'Attack surfaces', 'Mitigations', 'Review cadence'],
  'React Native': ['Components & styling', 'Navigation', 'State & storage', 'Native modules', 'Build & release'],
  Flutter: ['Widgets & layout', 'State management', 'Navigation', 'Networking & storage', 'Build & release'],
  'Mobile UI/UX': ['Mobile patterns', 'Touch targets', 'Responsive layouts', 'Offline states', 'Platform guidelines'],
  'App Store Deployment': ['Signing & certificates', 'Build variants', 'Store listings', 'Review guidelines', 'Release monitoring'],
  Dart: ['Types & null safety', 'Classes & mixins', 'Async & streams', 'Collections', 'Testing'],
  'User Research': ['Interview guides', 'Usability sessions', 'Surveys', 'Personas & journeys', 'Synthesizing insights'],
  Figma: ['Frames & components', 'Auto layout', 'Variants & properties', 'Prototyping', 'Design handoff'],
  'Wireframing & Prototyping': ['Low-fidelity wireframes', 'User flows', 'Interactive prototypes', 'Feedback loops', 'Iteration'],
  'Usability Testing': ['Test plans & tasks', 'Moderated vs unmoderated', 'Observation & notes', 'Severity ranking', 'Reporting'],
  'Design Systems': ['Tokens & foundations', 'Component libraries', 'Documentation', 'Governance', 'Adoption'],
  'Interaction Design': ['Micro-interactions', 'Motion & feedback', 'States & edge cases', 'Prototyping', 'Usability'],
  'Design Portfolio': ['Case study structure', 'Problem & process', 'Visual presentation', 'Storytelling', 'Feedback & iteration'],
  'Product Strategy': ['Vision & positioning', 'Market & competitors', 'Prioritization frameworks', 'OKRs', 'Roadmap alignment'],
  Roadmapping: ['Now/next/later planning', 'Milestones & dependencies', 'Stakeholder alignment', 'Scope trade-offs', 'Communication'],
  'Agile/Scrum': ['Roles & ceremonies', 'Backlog refinement', 'Sprint planning', 'Estimation', 'Retrospectives'],
  'Product Analytics': ['Event tracking', 'Funnels & retention', 'Cohorts', 'Experimentation', 'North-star metrics'],
  'Stakeholder Management': ['Expectation setting', 'Communication plans', 'Trade-off negotiation', 'Status reporting', 'Conflict resolution'],
  'Manual Testing': ['Test cases & plans', 'Boundary & equivalence', 'Regression testing', 'Bug reporting', 'Exploratory testing'],
  'Test Automation (Playwright)': ['Selectors & actions', 'Assertions', 'Page objects', 'Fixtures & parallel runs', 'CI integration'],
  'API Testing': ['Status & schema checks', 'Auth flows', 'Contract testing', 'Postman/Newman', 'Mocking services'],
  'Blockchain Fundamentals': ['Consensus & blocks', 'Wallets & keys', 'Transactions & gas', 'L2 & scaling', 'Security risks'],
  Solidity: ['Contracts & state', 'Functions & modifiers', 'Events & errors', 'Inheritance & libraries', 'Gas optimization'],
  'Ethereum & Web3': ['Accounts & networks', 'Smart contract calls', 'ethers.js/web3.js', 'ERC standards', 'IPFS & oracles'],
  'Smart Contract Security': ['Reentrancy', 'Access control', 'Integer issues', 'Audit checklist', 'Testing & fuzzing'],
  'dApp Development': ['Contract integration', 'Wallet connection', 'Frontend state', 'Indexing events', 'Deployment'],
  'C++': ['Pointers & memory', 'STL containers', 'OOP & templates', 'Move semantics', 'Multithreading'],
  'C#': ['Types & OOP', 'LINQ & collections', 'Async/await', 'Interfaces & generics', 'Testing'],
  Unity: ['GameObjects & components', 'Scripts & physics', 'UI & input', 'Animation', 'Build & publish'],
  'Game Design': ['Core loops', 'Level design', 'Balancing & progression', 'Playtesting', 'Monetization'],
  '3D Math': ['Vectors & matrices', 'Transforms', 'Quaternions', 'Collision math', 'Camera math'],
  'Technical Writing': ['Audience & structure', 'Style guides', 'API documentation', 'Diagrams & examples', 'Docs tooling'],
  'API Documentation': ['OpenAPI/Swagger', 'Endpoint examples', 'Auth documentation', 'Error references', 'Versioning'],
  'Information Architecture': ['Content hierarchy', 'Navigation design', 'Taxonomy', 'Searchability', 'Content audits'],
  'Database Administration': ['Backups & recovery', 'User roles & permissions', 'Performance tuning', 'Replication', 'Monitoring'],
  'Performance Tuning': ['Query plans', 'Index strategy', 'Partitioning', 'Caching', 'Capacity planning'],
  'Network Security': ['Firewalls', 'VPN & TLS', 'IDS/IPS', 'Segmentation', 'Zero trust'],
  'TCP/IP': ['OSI model', 'IP addressing & subnets', 'TCP vs UDP', 'DNS & DHCP', 'Routing basics'],
  'Cloud Networking': ['VPC design', 'Load balancers', 'DNS & CDN', 'Hybrid connectivity', 'Network security'],
  'Scrum Facilitation': ['Daily standups', 'Sprint planning', 'Retrospectives', 'Backlog refinement', 'Impediment removal'],
  'Team Coaching': ['Coaching questions', 'Conflict resolution', 'Team health', 'Feedback culture', 'Continuous improvement'],
  'JIRA & Metrics': ['JIRA configuration', 'Burndown & velocity', 'Cycle time', 'Dashboards', 'Reporting'],
  'Software Engineering': ['Requirements & design', 'Clean code', 'Testing', 'Code review', 'Deployment'],
  'Data Structures': ['Arrays & strings', 'Linked lists & stacks', 'Trees & graphs', 'Hashing', 'Complexity analysis'],
  Algorithms: ['Sorting & searching', 'Recursion & backtracking', 'Dynamic programming', 'Greedy algorithms', 'Graph algorithms'],
  'Problem Solving': ['Clarifying requirements', 'Breaking problems down', 'Trade-off analysis', 'Edge cases', 'Communicating solutions'],
  Communication: ['Structured answers', 'Active listening', 'Concise explanations', 'Stakeholder updates', 'Written clarity'],
  Leadership: ['Delegation', 'Decision making', 'Motivation', 'Feedback', 'Conflict resolution'],
  'Time Management': ['Prioritization', 'Planning', 'Focus blocks', 'Estimating effort', 'Managing interruptions'],
  'Project Management': ['Scope & milestones', 'Risk management', 'Stakeholder communication', 'Tracking progress', 'Retrospectives'],
  'Business Analysis': ['Requirements elicitation', 'Process mapping', 'User stories', 'Gap analysis', 'Stakeholder alignment'],
  'Process Modeling': ['As-is vs to-be', 'BPMN basics', 'Swimlanes', 'Bottleneck analysis', 'Documentation'],
  'Domain Knowledge': ['Industry terminology', 'Regulations & compliance', 'Customer workflows', 'Competitive landscape', 'Business metrics'],
};

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  {
    id: 'frontend-developer',
    title: 'Frontend Developer',
    aliases: ['frontend developer', 'front-end developer', 'front end developer', 'react developer', 'angular developer', 'vue developer', 'ui developer', 'web developer'],
    description: 'Builds accessible, responsive user interfaces and turns product designs into fast web experiences.',
    category: 'Software Development',
    salaryRange: '₹4–18 LPA depending on experience',
    demand: 'High',
    growth: 'Strong demand for React/TypeScript and design-system skills',
    core: [skill('HTML & CSS'), skill('JavaScript'), skill('TypeScript'), skill('React'), skill('Responsive Design'), skill('Git & GitHub'), skill('REST APIs'), skill('State Management')],
    advanced: [skill('Next.js', 'ADVANCED'), skill('Testing', 'ADVANCED'), skill('Performance Optimization', 'ADVANCED'), skill('Accessibility', 'ADVANCED'), skill('CI/CD', 'ADVANCED')],
    projects: [
      { title: 'Interactive Analytics Dashboard', description: 'Build a dashboard that fetches a public API with filters, charts, loading/error states and responsive layout.', subtopics: ['Component planning', 'API integration', 'State & filters', 'Responsive layout', 'Deploy to Vercel'] },
      { title: 'Full-Featured React Application', description: 'Build a production-style app with authentication, CRUD, routing, tests and accessibility checks.', subtopics: ['App architecture', 'Auth flow', 'CRUD screens', 'Automated tests', 'Performance review'] },
    ],
    certifications: ['Meta Front-End Developer Certificate'],
    interviewTopics: ['JavaScript fundamentals and the event loop', 'React hooks, rendering and state', 'CSS layout and responsive design', 'Browser APIs, accessibility and debugging'],
  },
  {
    id: 'backend-developer',
    title: 'Backend Developer',
    aliases: ['backend developer', 'back-end developer', 'back end developer', 'node developer', 'node.js developer', 'java developer', 'python developer', 'api developer', 'server side developer'],
    description: 'Designs APIs, data models and server-side systems that are secure, reliable and scalable.',
    category: 'Software Development',
    salaryRange: '₹5–22 LPA depending on experience',
    demand: 'High',
    growth: 'Strong demand for API, database and cloud-native backend skills',
    core: [skill('JavaScript'), skill('TypeScript'), skill('Node.js'), skill('Express'), skill('SQL'), skill('PostgreSQL'), skill('REST APIs'), skill('Authentication & Security'), skill('Git & GitHub')],
    advanced: [skill('System Design', 'ADVANCED'), skill('Docker', 'ADVANCED'), skill('Redis & Caching', 'ADVANCED'), skill('Message Queues', 'ADVANCED'), skill('Testing', 'ADVANCED'), skill('CI/CD', 'ADVANCED')],
    projects: [
      { title: 'Production-Ready REST API', description: 'Build an authenticated REST API with validation, pagination, error handling, tests and API documentation.', subtopics: ['API design', 'Auth & roles', 'Validation', 'Database schema', 'Integration tests'] },
      { title: 'Scalable Backend Service', description: 'Build a service with caching, background jobs, Docker deployment and monitoring.', subtopics: ['Service architecture', 'Caching layer', 'Queue workers', 'Docker Compose', 'Load testing'] },
    ],
    certifications: ['AWS Certified Developer – Associate'],
    interviewTopics: ['Data structures and algorithms', 'API design and error handling', 'Database design and SQL', 'System design and scalability', 'Concurrency and reliability'],
  },
  {
    id: 'full-stack-developer',
    title: 'Full Stack Developer',
    aliases: ['full stack developer', 'full-stack developer', 'fullstack developer', 'full stack web developer', 'mern developer', 'mean developer', 'full stack engineer'],
    description: 'Builds end-to-end web products across the frontend, backend, database and deployment pipeline.',
    category: 'Software Development',
    salaryRange: '₹5–24 LPA depending on experience',
    demand: 'High',
    growth: 'High demand for developers who can ship complete products',
    core: [skill('HTML & CSS'), skill('JavaScript'), skill('TypeScript'), skill('React'), skill('Node.js'), skill('Express'), skill('SQL'), skill('MongoDB'), skill('REST APIs'), skill('Git & GitHub')],
    advanced: [skill('Next.js', 'ADVANCED'), skill('Authentication & Security', 'ADVANCED'), skill('System Design', 'ADVANCED'), skill('Docker', 'ADVANCED'), skill('Testing', 'ADVANCED'), skill('CI/CD', 'ADVANCED')],
    projects: [
      { title: 'Full-Stack CRUD Application', description: 'Build an end-to-end app with a React frontend, Node API, database and authentication.', subtopics: ['Frontend routes', 'API integration', 'Database models', 'Auth & sessions', 'Deployment'] },
      { title: 'Production Full-Stack Capstone', description: 'Build and deploy a complete product with payments or real-time features, tests and CI/CD.', subtopics: ['Feature planning', 'Backend services', 'Frontend polish', 'Testing & CI', 'Monitoring'] },
    ],
    certifications: ['Meta Full-Stack Developer Certificate'],
    interviewTopics: ['JavaScript and TypeScript', 'React and frontend architecture', 'API and database design', 'System design basics and deployment'],
  },
  {
    id: 'data-analyst',
    title: 'Data Analyst',
    aliases: ['data analyst', 'analytics analyst', 'bi analyst', 'business intelligence analyst', 'reporting analyst'],
    description: 'Turns raw data into clear business insights using SQL, spreadsheets, dashboards and statistical reasoning.',
    category: 'Data & Analytics',
    salaryRange: '₹4–14 LPA depending on experience',
    demand: 'High',
    growth: 'Steady demand across product, marketing, finance and operations',
    core: [skill('Excel'), skill('SQL'), skill('Python'), skill('Pandas & NumPy'), skill('Statistics'), skill('Data Cleaning'), skill('Data Visualization'), skill('Power BI / Tableau')],
    advanced: [skill('A/B Testing', 'ADVANCED'), skill('Data Storytelling', 'ADVANCED'), skill('Big Data (Spark)', 'ADVANCED'), skill('Dashboard Design', 'ADVANCED')],
    projects: [
      { title: 'Business Sales Dashboard', description: 'Clean a sales dataset and build an interactive Power BI/Tableau dashboard with clear KPIs and insights.', subtopics: ['Data cleaning', 'SQL analysis', 'Dashboard layout', 'KPI design', 'Executive summary'] },
      { title: 'A/B Test Analysis Capstone', description: 'Design and analyze an A/B test, then present a recommendation with statistical evidence.', subtopics: ['Hypothesis & metrics', 'Sample size', 'Statistical test', 'Interpretation', 'Stakeholder presentation'] },
    ],
    certifications: ['Google Data Analytics Certificate'],
    interviewTopics: ['SQL joins and window functions', 'Statistics for analysts', 'Visualization choices', 'Business case studies'],
  },
  {
    id: 'data-scientist',
    title: 'Data Scientist',
    aliases: ['data scientist', 'applied scientist', 'machine learning scientist', 'ml scientist'],
    description: 'Uses statistics, experimentation and machine learning to answer business questions and build predictive models.',
    category: 'Data & Analytics',
    salaryRange: '₹6–28 LPA depending on experience',
    demand: 'High',
    growth: 'Strong demand but portfolio and communication matter',
    core: [skill('Python'), skill('Pandas & NumPy'), skill('Statistics'), skill('SQL'), skill('Data Visualization'), skill('Data Cleaning'), skill('Machine Learning')],
    advanced: [skill('Feature Engineering', 'ADVANCED'), skill('Deep Learning', 'ADVANCED'), skill('Model Deployment', 'ADVANCED'), skill('MLOps', 'ADVANCED'), skill('A/B Testing', 'ADVANCED')],
    projects: [
      { title: 'Exploratory Data Analysis & Prediction', description: 'Analyze a real dataset, engineer features and train a model with proper validation.', subtopics: ['Data cleaning', 'EDA & insights', 'Feature engineering', 'Model comparison', 'Reporting'] },
      { title: 'End-to-End Deployed ML Project', description: 'Build and deploy a model as an API with monitoring and a simple frontend demo.', subtopics: ['Problem framing', 'Model training', 'API serving', 'Monitoring', 'Write-up'] },
    ],
    certifications: ['Google Advanced Data Analytics Certificate'],
    interviewTopics: ['Statistics and probability', 'ML algorithms and metrics', 'SQL for analysis', 'Case study walkthroughs'],
  },
  {
    id: 'ml-engineer',
    title: 'Machine Learning Engineer',
    aliases: ['machine learning engineer', 'ml engineer', 'deep learning engineer', 'ai/ml engineer'],
    description: 'Builds and deploys production machine-learning systems, from data pipelines to model serving and monitoring.',
    category: 'AI & Machine Learning',
    salaryRange: '₹8–35 LPA depending on experience',
    demand: 'Very High',
    growth: 'Fast-growing demand for production ML and LLM systems',
    core: [skill('Python'), skill('Math for ML'), skill('Machine Learning'), skill('Deep Learning'), skill('PyTorch/TensorFlow'), skill('Data Pipelines'), skill('SQL')],
    advanced: [skill('LLMs & Prompt Engineering', 'ADVANCED'), skill('MLOps', 'ADVANCED'), skill('Model Deployment', 'ADVANCED'), skill('Feature Engineering', 'ADVANCED'), skill('Big Data (Spark)', 'ADVANCED')],
    projects: [
      { title: 'Model Training & Evaluation', description: 'Train a deep learning model on a real dataset with experiment tracking and evaluation.', subtopics: ['Data pipeline', 'Model architecture', 'Training loop', 'Metrics', 'Error analysis'] },
      { title: 'Deployed ML/LLM Application', description: 'Deploy a model or LLM-powered app with monitoring, evaluation and cost controls.', subtopics: ['Serving API', 'Prompt/RAG design', 'Evaluation', 'Monitoring', 'Cost & latency'] },
    ],
    certifications: ['TensorFlow Developer Certificate'],
    interviewTopics: ['ML theory and metrics', 'Model evaluation', 'ML system design', 'Python coding'],
  },
  {
    id: 'ai-engineer',
    title: 'AI Engineer',
    aliases: ['ai engineer', 'genai engineer', 'generative ai engineer', 'llm engineer', 'prompt engineer'],
    description: 'Builds LLM-powered products using retrieval, evaluation, orchestration and safe deployment practices.',
    category: 'AI & Machine Learning',
    salaryRange: '₹8–35 LPA depending on experience',
    demand: 'Very High',
    growth: 'Rapid hiring for RAG, agents and AI product engineering',
    core: [skill('Python'), skill('LLMs & Prompt Engineering'), skill('Machine Learning'), skill('REST APIs'), skill('SQL'), skill('Data Pipelines')],
    advanced: [skill('Model Deployment', 'ADVANCED'), skill('MLOps', 'ADVANCED'), skill('Deep Learning', 'ADVANCED'), skill('Authentication & Security', 'ADVANCED'), skill('System Design', 'ADVANCED')],
    projects: [
      { title: 'RAG Knowledge Assistant', description: 'Build a retrieval-augmented assistant over real documents with citations, evaluation and guardrails.', subtopics: ['Document ingestion', 'Embeddings & vector search', 'Prompt design', 'Evaluation', 'Deployment'] },
      { title: 'LLM Agent Capstone', description: 'Build a tool-using agent with observability, cost controls and safety checks.', subtopics: ['Tool schema', 'Planning loop', 'Guardrails', 'Tracing', 'Cost & latency'] },
    ],
    certifications: ['DeepLearning.AI LLM / GenAI certificate'],
    interviewTopics: ['Transformer and LLM fundamentals', 'RAG and embeddings', 'Evaluation and hallucination control', 'System design for AI products'],
  },
  {
    id: 'data-engineer',
    title: 'Data Engineer',
    aliases: ['data engineer', 'analytics engineer', 'etl developer', 'big data engineer'],
    description: 'Builds reliable data pipelines, warehouses and datasets that power analytics and machine learning.',
    category: 'Data & Analytics',
    salaryRange: '₹6–26 LPA depending on experience',
    demand: 'High',
    growth: 'Growing demand for cloud data platforms and orchestration',
    core: [skill('Python'), skill('SQL'), skill('Data Pipelines'), skill('PostgreSQL'), skill('Linux & Networking'), skill('Cloud (AWS)'), skill('Git & GitHub')],
    advanced: [skill('Big Data (Spark)', 'ADVANCED'), skill('Docker', 'ADVANCED'), skill('Terraform', 'ADVANCED'), skill('Monitoring', 'ADVANCED'), skill('System Design', 'ADVANCED')],
    projects: [
      { title: 'Batch ETL Pipeline', description: 'Build an orchestrated pipeline that ingests, validates and loads data into a warehouse.', subtopics: ['Source ingestion', 'Transformations', 'Orchestration', 'Data quality checks', 'Warehouse loading'] },
      { title: 'Streaming Data Platform', description: 'Build a streaming ingestion and processing pipeline with monitoring and recovery.', subtopics: ['Event ingestion', 'Stream processing', 'Schema management', 'Monitoring', 'Failure recovery'] },
    ],
    certifications: ['Google Cloud Professional Data Engineer'],
    interviewTopics: ['SQL and data modeling', 'Pipeline orchestration', 'Distributed processing', 'Data quality and reliability'],
  },
  {
    id: 'devops-engineer',
    title: 'DevOps Engineer',
    aliases: ['devops engineer', 'devops', 'sre', 'site reliability engineer', 'platform engineer', 'infrastructure engineer'],
    description: 'Automates building, deploying and operating software with CI/CD, containers and cloud infrastructure.',
    category: 'Cloud & Infrastructure',
    salaryRange: '₹6–28 LPA depending on experience',
    demand: 'High',
    growth: 'Strong demand for Kubernetes, IaC and platform engineering',
    core: [skill('Linux & Networking'), skill('Git & GitHub'), skill('Docker'), skill('CI/CD'), skill('Cloud (AWS)'), skill('Terraform'), skill('Kubernetes'), skill('Monitoring')],
    advanced: [skill('System Design', 'ADVANCED'), skill('Redis & Caching', 'ADVANCED'), skill('Authentication & Security', 'ADVANCED'), skill('Performance Optimization', 'ADVANCED')],
    projects: [
      { title: 'CI/CD Pipeline', description: 'Create a pipeline that tests, builds and deploys a containerized app with rollbacks.', subtopics: ['Pipeline stages', 'Container build', 'Automated tests', 'Deploy & rollback', 'Secrets management'] },
      { title: 'Kubernetes Deployment Capstone', description: 'Deploy a multi-service app on Kubernetes with ingress, autoscaling and monitoring.', subtopics: ['Manifests', 'Ingress & TLS', 'Autoscaling', 'Observability', 'Runbook'] },
    ],
    certifications: ['AWS Certified DevOps Engineer'],
    interviewTopics: ['Linux troubleshooting', 'CI/CD design', 'Kubernetes', 'Cloud architecture and reliability'],
  },
  {
    id: 'cloud-engineer',
    title: 'Cloud Engineer',
    aliases: ['cloud engineer', 'cloud architect', 'solutions architect', 'aws engineer', 'azure engineer', 'gcp engineer', 'cloud consultant'],
    description: 'Designs and operates secure, cost-effective cloud infrastructure and migration strategies.',
    category: 'Cloud & Infrastructure',
    salaryRange: '₹7–30 LPA depending on experience',
    demand: 'High',
    growth: 'Strong demand for AWS/Azure architecture and IaC',
    core: [skill('Linux & Networking'), skill('Cloud (AWS)'), skill('Authentication & Security'), skill('Docker'), skill('Terraform'), skill('Monitoring')],
    advanced: [skill('Kubernetes', 'ADVANCED'), skill('System Design', 'ADVANCED'), skill('Performance Optimization', 'ADVANCED'), skill('CI/CD', 'ADVANCED')],
    projects: [
      { title: 'Multi-Tier Cloud Deployment', description: 'Deploy a multi-tier app on AWS with networking, IAM and managed databases.', subtopics: ['VPC & subnets', 'Compute & storage', 'IAM roles', 'Managed DB', 'Cost review'] },
      { title: 'Infrastructure-as-Code Capstone', description: 'Provision a complete environment with Terraform, CI/CD and monitoring.', subtopics: ['Terraform modules', 'State management', 'CI/CD', 'Observability', 'Security review'] },
    ],
    certifications: ['AWS Solutions Architect – Associate'],
    interviewTopics: ['AWS/Azure core services', 'Networking and IAM', 'Architecture trade-offs', 'Cost and reliability'],
  },
  {
    id: 'cybersecurity-analyst',
    title: 'Cybersecurity Analyst',
    aliases: ['cybersecurity analyst', 'cyber security analyst', 'security analyst', 'soc analyst', 'penetration tester', 'ethical hacker', 'security engineer'],
    description: 'Protects systems and data by monitoring threats, testing defenses and responding to incidents.',
    category: 'Cybersecurity',
    salaryRange: '₹5–24 LPA depending on experience',
    demand: 'High',
    growth: 'Talent shortage keeps demand strong across industries',
    core: [skill('Linux & Networking'), skill('Web Security'), skill('Cryptography'), skill('Secure Coding'), skill('SIEM'), skill('Penetration Testing')],
    advanced: [skill('Incident Response', 'ADVANCED'), skill('Threat Modeling', 'ADVANCED'), skill('Cloud (AWS)', 'ADVANCED')],
    projects: [
      { title: 'Vulnerable App Security Assessment', description: 'Assess a deliberately vulnerable app and write a professional findings report.', subtopics: ['Reconnaissance', 'Exploitation', 'Risk rating', 'Remediation', 'Report writing'] },
      { title: 'Security Monitoring Capstone', description: 'Build a SIEM dashboard and simulate detection and incident response.', subtopics: ['Log ingestion', 'Detection rules', 'Alert triage', 'Incident timeline', 'Post-incident review'] },
    ],
    certifications: ['CompTIA Security+'],
    interviewTopics: ['Networking and OS fundamentals', 'OWASP top 10', 'Incident response', 'Security tooling'],
  },
  {
    id: 'mobile-developer',
    title: 'Mobile App Developer',
    aliases: ['mobile developer', 'mobile app developer', 'android developer', 'ios developer', 'flutter developer', 'react native developer'],
    description: 'Builds cross-platform or native mobile apps with polished UI, offline support and store deployment.',
    category: 'Software Development',
    salaryRange: '₹4–20 LPA depending on experience',
    demand: 'High',
    growth: 'Steady demand for Flutter and React Native developers',
    core: [skill('Dart'), skill('Flutter'), skill('React Native'), skill('Mobile UI/UX'), skill('REST APIs'), skill('State Management'), skill('Testing')],
    advanced: [skill('Performance Optimization', 'ADVANCED'), skill('App Store Deployment', 'ADVANCED'), skill('CI/CD', 'ADVANCED')],
    projects: [
      { title: 'Cross-Platform Mobile App', description: 'Build a mobile app with navigation, API data, offline storage and polished UI.', subtopics: ['UI screens', 'Navigation', 'API integration', 'Local storage', 'Device testing'] },
      { title: 'Published Mobile Capstone', description: 'Build, test and publish a complete app to a store with analytics.', subtopics: ['Feature scope', 'State management', 'Automated tests', 'Store listing', 'Release & monitoring'] },
    ],
    certifications: ['Google Associate Android Developer'],
    interviewTopics: ['Mobile lifecycle', 'State management', 'UI and performance', 'Platform guidelines'],
  },
  {
    id: 'ui-ux-designer',
    title: 'UI/UX Designer',
    aliases: ['ui ux designer', 'ui/ux designer', 'ux designer', 'ui designer', 'product designer', 'interaction designer'],
    description: 'Researches user needs and designs usable, accessible product experiences and design systems.',
    category: 'Design',
    salaryRange: '₹4–18 LPA depending on experience',
    demand: 'Steady',
    growth: 'Strong portfolios and product thinking stand out',
    core: [skill('User Research'), skill('Figma'), skill('Wireframing & Prototyping'), skill('Usability Testing'), skill('Design Systems'), skill('Accessibility')],
    advanced: [skill('Interaction Design', 'ADVANCED'), skill('Design Portfolio', 'ADVANCED'), skill('Product Strategy', 'ADVANCED')],
    projects: [
      { title: 'End-to-End UX Case Study', description: 'Research, wireframe, prototype and usability-test a product flow.', subtopics: ['Research plan', 'Wireframes', 'Interactive prototype', 'Usability test', 'Case study'] },
      { title: 'Design System & Portfolio Capstone', description: 'Create a reusable design system and package your work into a portfolio.', subtopics: ['Tokens & components', 'Documentation', 'Prototype', 'Portfolio case studies', 'Presentation'] },
    ],
    certifications: ['Google UX Design Certificate'],
    interviewTopics: ['Portfolio walkthrough', 'Design process', 'Usability and accessibility', 'Collaboration cases'],
  },
  {
    id: 'product-manager',
    title: 'Product Manager',
    aliases: ['product manager', 'product owner', 'product lead', 'associate product manager', 'apm'],
    description: 'Defines product strategy, prioritizes problems and leads cross-functional teams to deliver customer value.',
    category: 'Product & Business',
    salaryRange: '₹8–30 LPA depending on experience',
    demand: 'Steady',
    growth: 'Competitive; product sense and metrics matter',
    core: [skill('User Research'), skill('Product Strategy'), skill('Roadmapping'), skill('Agile/Scrum'), skill('Product Analytics'), skill('Wireframing & Prototyping'), skill('SQL')],
    advanced: [skill('A/B Testing', 'ADVANCED'), skill('Data Storytelling', 'ADVANCED'), skill('Stakeholder Management', 'ADVANCED')],
    projects: [
      { title: 'Product Discovery & PRD', description: 'Research a problem, define a product and write a PRD with success metrics.', subtopics: ['User interviews', 'Problem statement', 'PRD writing', 'Success metrics', 'Prioritization'] },
      { title: 'Product Launch Capstone', description: 'Take a product idea through roadmap, prototype, metrics plan and launch pitch.', subtopics: ['Roadmap', 'Prototype', 'Experiment plan', 'Launch plan', 'Stakeholder pitch'] },
    ],
    certifications: ['Certified Scrum Product Owner (CSPO)'],
    interviewTopics: ['Product sense', 'Metrics and analytics', 'Prioritization', 'Execution and stakeholder cases'],
  },
  {
    id: 'qa-engineer',
    title: 'QA / Test Engineer',
    aliases: ['qa engineer', 'quality assurance engineer', 'test engineer', 'automation tester', 'sdet', 'qa analyst'],
    description: 'Ensures software quality through test strategy, automation and reliable release processes.',
    category: 'Software Development',
    salaryRange: '₹4–16 LPA depending on experience',
    demand: 'Steady',
    growth: 'Automation and API testing skills are in demand',
    core: [skill('Manual Testing'), skill('Test Automation (Playwright)'), skill('API Testing'), skill('SQL'), skill('Git & GitHub'), skill('CI/CD')],
    advanced: [skill('Performance Optimization', 'ADVANCED'), skill('Web Security', 'ADVANCED'), skill('Docker', 'ADVANCED')],
    projects: [
      { title: 'Test Automation Suite', description: 'Automate an end-to-end flow for a web app with reliable selectors and reporting.', subtopics: ['Test plan', 'Page objects', 'Assertions', 'Parallel runs', 'CI integration'] },
      { title: 'Full QA Capstone', description: 'Create a complete test strategy for an app including API, UI and regression suites.', subtopics: ['Test strategy', 'API tests', 'UI automation', 'Regression suite', 'Quality report'] },
    ],
    certifications: ['ISTQB Certified Tester'],
    interviewTopics: ['Testing fundamentals', 'Automation frameworks', 'API testing', 'Bug reporting and triage'],
  },
  {
    id: 'blockchain-developer',
    title: 'Blockchain Developer',
    aliases: ['blockchain developer', 'blockchain engineer', 'web3 developer', 'solidity developer', 'smart contract developer'],
    description: 'Builds smart contracts and decentralized applications with a strong security mindset.',
    category: 'Software Development',
    salaryRange: '₹6–28 LPA depending on experience',
    demand: 'Niche',
    growth: 'Volatile but strong for security-focused builders',
    core: [skill('Blockchain Fundamentals'), skill('Solidity'), skill('Ethereum & Web3'), skill('Smart Contract Security'), skill('JavaScript')],
    advanced: [skill('dApp Development', 'ADVANCED'), skill('Testing', 'ADVANCED'), skill('System Design', 'ADVANCED')],
    projects: [
      { title: 'Smart Contract dApp', description: 'Build a dApp with a Solidity contract, wallet connection and tests.', subtopics: ['Contract design', 'Solidity implementation', 'Wallet integration', 'Contract tests', 'Testnet deploy'] },
      { title: 'Secure dApp Capstone', description: 'Build and audit a production-style dApp with upgradeability and security checks.', subtopics: ['Architecture', 'Access control', 'Security review', 'Gas optimization', 'Mainnet checklist'] },
    ],
    certifications: ['Certified Blockchain Developer'],
    interviewTopics: ['Blockchain fundamentals', 'Solidity and EVM', 'Security pitfalls', 'dApp architecture'],
  },
  {
    id: 'business-analyst',
    title: 'Business Analyst',
    aliases: ['business analyst', 'functional analyst', 'systems analyst', 'process analyst', 'ba analyst'],
    description: 'Bridges business and technology by clarifying requirements, mapping processes and supporting delivery.',
    category: 'Product & Business',
    salaryRange: '₹4–16 LPA depending on experience',
    demand: 'Steady',
    growth: 'Strong in consulting, banking and enterprise IT',
    core: [skill('Business Analysis', 'INTERMEDIATE', 'DOMAIN'), skill('Process Modeling', 'INTERMEDIATE', 'DOMAIN'), skill('SQL'), skill('Excel'), skill('Communication', 'INTERMEDIATE', 'SOFT'), skill('Data Visualization'), skill('Stakeholder Management', 'INTERMEDIATE', 'SOFT')],
    advanced: [skill('Agile/Scrum', 'ADVANCED', 'DOMAIN'), skill('Project Management', 'ADVANCED', 'DOMAIN'), skill('Domain Knowledge', 'ADVANCED', 'DOMAIN')],
    projects: [
      { title: 'Requirements & Process Analysis', description: 'Document as-is and to-be processes for a real business workflow with clear requirements.', subtopics: ['Stakeholder interviews', 'Process mapping', 'Requirements writing', 'Gap analysis', 'Presentation'] },
      { title: 'Business Case Capstone', description: 'Build a data-backed business case with KPIs, risks and an implementation plan.', subtopics: ['Problem framing', 'Data analysis', 'Option evaluation', 'Business case', 'Stakeholder pitch'] },
    ],
    certifications: ['IIBA Entry Certificate in Business Analysis (ECBA)'],
    interviewTopics: ['Requirements elicitation', 'Process modeling', 'Stakeholder management', 'Business case analysis'],
  },
  {
    id: 'game-developer',
    title: 'Game Developer',
    aliases: ['game developer', 'game programmer', 'unity developer', 'unreal developer', 'game engineer'],
    description: 'Builds interactive games and simulations, combining programming, game design and performance work.',
    category: 'Software Development',
    salaryRange: '₹4–18 LPA depending on experience',
    demand: 'Niche',
    growth: 'Indie and mobile gaming offer portfolio-driven opportunities',
    core: [skill('C#'), skill('C++'), skill('Unity'), skill('Game Design'), skill('3D Math'), skill('Git & GitHub')],
    advanced: [skill('Performance Optimization', 'ADVANCED'), skill('Testing', 'ADVANCED'), skill('CI/CD', 'ADVANCED')],
    projects: [
      { title: 'Playable Game Prototype', description: 'Build a complete small game with core loop, UI, sound and save system.', subtopics: ['Core loop', 'Player controls', 'Level design', 'UI & audio', 'Build & playtest'] },
      { title: 'Polished Game Capstone', description: 'Polish and publish a game with performance optimization and playtesting feedback.', subtopics: ['Feature scope', 'Performance profiling', 'Playtesting', 'Store build', 'Release notes'] },
    ],
    certifications: ['Unity Certified User / Associate'],
    interviewTopics: ['Game loop and architecture', 'C# and Unity fundamentals', 'Performance and optimization', 'Game design trade-offs'],
  },
  {
    id: 'technical-writer',
    title: 'Technical Writer',
    aliases: ['technical writer', 'documentation engineer', 'api writer', 'content developer', 'developer advocate writer'],
    description: 'Creates clear documentation, API references and guides that help users succeed with technical products.',
    category: 'Content & Communication',
    salaryRange: '₹4–15 LPA depending on experience',
    demand: 'Steady',
    growth: 'Strong demand for API and developer documentation',
    core: [skill('Technical Writing', 'INTERMEDIATE', 'DOMAIN'), skill('API Documentation', 'INTERMEDIATE', 'DOMAIN'), skill('Information Architecture', 'INTERMEDIATE', 'DOMAIN'), skill('Git & GitHub'), skill('HTML & CSS'), skill('Communication', 'INTERMEDIATE', 'SOFT')],
    advanced: [skill('REST APIs', 'ADVANCED'), skill('Testing', 'ADVANCED'), skill('Domain Knowledge', 'ADVANCED', 'DOMAIN')],
    projects: [
      { title: 'API Documentation Set', description: 'Document a real API with quickstart, authentication, endpoint reference and examples.', subtopics: ['Audience analysis', 'Quickstart', 'Endpoint reference', 'Examples', 'Docs review'] },
      { title: 'Developer Docs Capstone', description: 'Build a complete docs site with information architecture, search and contribution guide.', subtopics: ['Content audit', 'IA & navigation', 'Docs site setup', 'Search', 'Contribution guide'] },
    ],
    certifications: ['Google Technical Writing Certificate'],
    interviewTopics: ['Writing samples and process', 'API documentation', 'Information architecture', 'Working with engineers'],
  },
  {
    id: 'database-administrator',
    title: 'Database Administrator',
    aliases: ['database administrator', 'dba', 'database engineer', 'db administrator'],
    description: 'Keeps databases fast, secure and recoverable through tuning, backups, access control and monitoring.',
    category: 'Cloud & Infrastructure',
    salaryRange: '₹5–20 LPA depending on experience',
    demand: 'Steady',
    growth: 'Cloud database and reliability skills are increasingly important',
    core: [skill('SQL'), skill('PostgreSQL'), skill('Database Administration'), skill('Performance Tuning'), skill('Linux & Networking'), skill('Authentication & Security')],
    advanced: [skill('Cloud (AWS)', 'ADVANCED'), skill('Monitoring', 'ADVANCED'), skill('System Design', 'ADVANCED')],
    projects: [
      { title: 'Database Performance Lab', description: 'Tune a slow database workload using indexing, query plans and caching.', subtopics: ['Workload analysis', 'Query plans', 'Index strategy', 'Caching', 'Benchmark report'] },
      { title: 'High-Availability Database Capstone', description: 'Set up replication, backups and monitoring for a production-style database.', subtopics: ['Replication', 'Backup & restore', 'Failover', 'Monitoring', 'Runbook'] },
    ],
    certifications: ['Oracle / PostgreSQL professional certification'],
    interviewTopics: ['SQL and indexing', 'Backup and recovery', 'Replication and availability', 'Security and permissions'],
  },
  {
    id: 'network-engineer',
    title: 'Network Engineer',
    aliases: ['network engineer', 'network administrator', 'network security engineer', 'nocc engineer'],
    description: 'Designs, secures and troubleshoots networks, from routing and switching to cloud connectivity.',
    category: 'Cloud & Infrastructure',
    salaryRange: '₹4–18 LPA depending on experience',
    demand: 'Steady',
    growth: 'Cloud networking and security skills add value',
    core: [skill('Linux & Networking'), skill('TCP/IP'), skill('Network Security'), skill('Cloud Networking'), skill('Monitoring')],
    advanced: [skill('Cloud (AWS)', 'ADVANCED'), skill('Authentication & Security', 'ADVANCED'), skill('System Design', 'ADVANCED')],
    projects: [
      { title: 'Enterprise Network Design', description: 'Design a segmented network with routing, firewalls and monitoring.', subtopics: ['Requirements', 'Subnetting', 'Routing & switching', 'Firewall rules', 'Monitoring plan'] },
      { title: 'Cloud Network Capstone', description: 'Build a secure hybrid cloud network with VPN and observability.', subtopics: ['VPC design', 'VPN & routing', 'Security groups', 'Monitoring', 'Cost review'] },
    ],
    certifications: ['Cisco CCNA'],
    interviewTopics: ['OSI and TCP/IP', 'Routing and switching', 'Network security', 'Troubleshooting methodology'],
  },
  {
    id: 'scrum-master',
    title: 'Scrum Master',
    aliases: ['scrum master', 'agile coach', 'agile scrum master', 'delivery lead'],
    description: 'Facilitates agile delivery, removes impediments and coaches teams toward continuous improvement.',
    category: 'Product & Business',
    salaryRange: '₹6–20 LPA depending on experience',
    demand: 'Steady',
    growth: 'Strong in enterprise agile transformations',
    core: [skill('Agile/Scrum', 'INTERMEDIATE', 'DOMAIN'), skill('Scrum Facilitation', 'INTERMEDIATE', 'DOMAIN'), skill('Team Coaching', 'INTERMEDIATE', 'SOFT'), skill('JIRA & Metrics'), skill('Communication', 'INTERMEDIATE', 'SOFT')],
    advanced: [skill('Project Management', 'ADVANCED', 'DOMAIN'), skill('Stakeholder Management', 'ADVANCED', 'SOFT'), skill('Leadership', 'ADVANCED', 'SOFT')],
    projects: [
      { title: 'Team Delivery Simulation', description: 'Facilitate a simulated sprint with planning, standups, review and retrospective.', subtopics: ['Sprint planning', 'Standups', 'Board management', 'Sprint review', 'Retrospective'] },
      { title: 'Agile Transformation Capstone', description: 'Design an agile adoption plan with metrics and team coaching practices.', subtopics: ['Current state assessment', 'Adoption plan', 'Metrics', 'Coaching plan', 'Stakeholder presentation'] },
    ],
    certifications: ['Professional Scrum Master I (PSM I)'],
    interviewTopics: ['Scrum framework', 'Facilitation and coaching', 'Metrics', 'Conflict resolution'],
  },
  {
    id: 'software-engineer',
    title: 'Software Engineer',
    aliases: ['software engineer', 'software developer', 'sde', 'programmer', 'application developer'],
    description: 'Designs and builds reliable software products using strong fundamentals in programming and problem solving.',
    category: 'Software Development',
    salaryRange: '₹4–24 LPA depending on experience',
    demand: 'High',
    growth: 'Broad role with strong demand across industries',
    core: [skill('Software Engineering'), skill('Data Structures'), skill('Algorithms'), skill('Git & GitHub'), skill('SQL'), skill('Testing'), skill('Problem Solving', 'INTERMEDIATE', 'SOFT')],
    advanced: [skill('System Design', 'ADVANCED'), skill('Cloud (AWS)', 'ADVANCED'), skill('Docker', 'ADVANCED'), skill('CI/CD', 'ADVANCED')],
    projects: [
      { title: 'Production-Style Application', description: 'Build an application with clean architecture, tests and deployment.', subtopics: ['Requirements', 'Design', 'Implementation', 'Testing', 'Deployment'] },
      { title: 'System Design Capstone', description: 'Design and prototype a scalable system with clear trade-offs.', subtopics: ['Requirements', 'API design', 'Data model', 'Scaling', 'Reliability'] },
    ],
    certifications: ['AWS Certified Developer – Associate'],
    interviewTopics: ['Data structures and algorithms', 'Object-oriented design', 'System design', 'Testing and debugging'],
  },
];

const aliasRegExpCache = new Map<string, RegExp>();

function aliasRegex(alias: string): RegExp {
  let regex = aliasRegExpCache.get(alias);
  if (!regex) {
    const escaped = alias.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+');
    regex = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i');
    aliasRegExpCache.set(alias, regex);
  }
  return regex;
}

export function resolveRole(roleText: string | null | undefined): RoleDefinition | null {
  const text = String(roleText || '').trim();
  if (!text) return null;
  const lower = text.toLowerCase();

  let best: { role: RoleDefinition; score: number } | null = null;
  for (const role of ROLE_DEFINITIONS) {
    let score = 0;
    if (lower === role.title.toLowerCase()) score += 100;
    for (const alias of role.aliases) {
      if (aliasRegex(alias).test(lower)) score += 20 + alias.length;
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { role, score };
    }
  }
  return best ? best.role : null;
}

export function getRoleSkillSet(roleText: string): {
  core: string[];
  advanced: string[];
  coreDetails: RoleSkill[];
  advancedDetails: RoleSkill[];
} {
  const role = resolveRole(roleText);
  if (!role) return { core: [], advanced: [], coreDetails: [], advancedDetails: [] };
  return {
    core: role.core.map(s => s.name),
    advanced: role.advanced.map(s => s.name),
    coreDetails: [...role.core],
    advancedDetails: [...role.advanced],
  };
}

export function getRoleRequiredSkills(roleText: string): string[] {
  const { core, advanced } = getRoleSkillSet(roleText);
  return [...core, ...advanced];
}

export function getRoleRequirement(roleText: string, skillName: string): RoleSkill | null {
  const { coreDetails, advancedDetails } = getRoleSkillSet(roleText);
  const key = skillKey(canonicalSkillName(skillName));
  for (const item of [...coreDetails, ...advancedDetails]) {
    if (isDuplicateKey(skillKey(item.name), key)) return item;
  }
  return null;
}

export function getRoleDetails(roleText: string): {
  id: string;
  title: string;
  description: string;
  category: string;
  salaryRange: string;
  demand: string;
  growth: string;
  requiredSkills: string[];
  certifications: string[];
  interviewTopics: string[];
} | null {
  const role = resolveRole(roleText);
  if (!role) return null;
  return {
    id: role.id,
    title: role.title,
    description: role.description,
    category: role.category,
    salaryRange: role.salaryRange,
    demand: role.demand,
    growth: role.growth,
    requiredSkills: [...role.core, ...role.advanced].map(s => s.name),
    certifications: role.certifications,
    interviewTopics: role.interviewTopics,
  };
}

export function skillSubtopics(topic: string, role: string): string[] {
  const direct = SKILL_SUBTOPICS[topic];
  if (direct) return direct;
  const key = skillKey(topic);
  for (const [name, topics] of Object.entries(SKILL_SUBTOPICS)) {
    if (isDuplicateKey(skillKey(name), key)) return topics;
  }
  return [
    `${topic}: key concepts`,
    `${topic}: tools & ecosystem`,
    `${topic} applied to ${role}`,
    `${topic}: common pitfalls`,
    `${topic}: interview questions`,
  ];
}

function resourcesFor(topic: string): string[] {
  return [
    `${topic} — official documentation / roadmap`,
    `${topic} crash course (YouTube / freeCodeCamp)`,
    `${topic} hands-on project tutorials`,
  ];
}

export interface GeneratedRoadmapTask {
  title: string;
  description: string;
  type: string;
  priority: string;
  order: number;
  resources: string[];
  subtopics: string[];
}

export interface GeneratedRoadmap {
  title: string;
  description: string;
  duration: string;
  tasks: GeneratedRoadmapTask[];
}

function userHasSkill(userSkillKeys: string[], skillName: string): boolean {
  const key = skillKey(canonicalSkillName(skillName));
  return userSkillKeys.some(existing => isDuplicateKey(existing, key));
}

export function buildRoleRoadmap(
  careerGoal: string,
  userSkills: string[],
  options: { domain?: string; months?: number } = {}
): GeneratedRoadmap {
  const roleText = (careerGoal || options.domain || 'Target Role').trim();
  const role = resolveRole(`${roleText} ${options.domain || ''}`);
  const title = role?.title || roleText;
  const totalMonths = Math.min(36, Math.max(1, Math.floor(options.months || 6)));
  const userSkillKeys = (userSkills || [])
    .map(name => skillKey(canonicalSkillName(String(name).replace(/\s*\([^)]*\)\s*$/, '').trim())))
    .filter(Boolean);

  const core = role?.core || [];
  const advanced = role?.advanced || [];
  const coreMissing = core.filter(s => !userHasSkill(userSkillKeys, s.name));
  const advancedMissing = advanced.filter(s => !userHasSkill(userSkillKeys, s.name));
  const targetSkills = [...coreMissing, ...advancedMissing];
  const fallbackSkills = [...core, ...advanced].slice(0, 10);

  const learningTargets = (targetSkills.length > 0 ? targetSkills : fallbackSkills).slice(0, 12);
  const learningCount = Math.max(4, Math.min(12, learningTargets.length));

  interface Spec {
    title: string;
    description: string;
    type: string;
    priority: string;
    subtopics: string[];
    resources: string[];
    skillName?: string;
  }

  const specs: Spec[] = [];

  specs.push({
    title: `Orientation & Target Role Analysis for ${title}`,
    description: `Understand the day-to-day responsibilities of a ${title}, review 5 real job descriptions and set up the tools required for this role.`,
    type: 'DAILY',
    priority: 'HIGH',
    subtopics: [
      `What a ${title} does day to day`,
      `Core tools and software for ${title}`,
      'Analyse 5 real job descriptions and list recurring requirements',
      'Set up Git, GitHub and your development environment',
      'Define your weekly learning schedule',
    ],
    resources: resourcesFor(`${title} career overview`),
  });

  const chosen = learningTargets.slice(0, learningCount);
  const miniProjectIndex = Math.max(1, Math.floor(chosen.length / 2));

  chosen.forEach((target, index) => {
    specs.push({
      title: `Learn ${target.name}`,
      description: target.level === 'ADVANCED'
        ? `Reach an advanced working level in ${target.name} for ${title} responsibilities.`
        : `Build the core ${target.name} skills required for a ${title}.`,
      type: index < 3 ? 'DAILY' : 'WEEKLY',
      priority: target.level === 'ADVANCED' ? 'MEDIUM' : index < 3 ? 'CRITICAL' : 'HIGH',
      subtopics: skillSubtopics(target.name, title),
      resources: resourcesFor(target.name),
      skillName: target.name,
    });

    if (index === miniProjectIndex && role?.projects[0]) {
      const project = role.projects[0];
      specs.push({
        title: `Project: ${project.title}`,
        description: project.description,
        type: 'PROJECT',
        priority: 'HIGH',
        subtopics: project.subtopics,
        resources: resourcesFor(project.title),
      });
    }
  });

  if (role?.projects?.length) {
    const capstone = role.projects[role.projects.length - 1];
    specs.push({
      title: `Capstone Project: ${capstone.title}`,
      description: capstone.description,
      type: 'PROJECT',
      priority: 'CRITICAL',
      subtopics: capstone.subtopics,
      resources: resourcesFor(capstone.title),
    });
  } else {
    specs.push({
      title: `${title} Capstone Project`,
      description: `Build a portfolio-ready ${title} project covering the full workflow and present the outcome.`,
      type: 'PROJECT',
      priority: 'CRITICAL',
      subtopics: ['Scope the problem', 'Choose the right tools', 'Build the deliverable', 'Test & review', 'Present the outcome'],
      resources: resourcesFor(`${title} capstone project`),
    });
  }

  specs.push({
    title: 'Portfolio, Resume & LinkedIn',
    description: `Package your projects into a ${title} portfolio and tailor your resume and LinkedIn to the role.`,
    type: 'WEEKLY',
    priority: 'HIGH',
    subtopics: ['Write case studies for your projects', 'Tailor resume bullets to the role', 'Optimize LinkedIn headline & skills', 'Publish a portfolio site', 'Get feedback from peers or mentors'],
    resources: ['Resume & LinkedIn optimization guides', 'Portfolio website examples', 'STAR bullet writing guide'],
  });

  const interviewTopics = role?.interviewTopics || [
    `${title}: domain questions`,
    'Behavioral interview (STAR)',
    `${title}: practical / case round`,
  ];
  specs.push({
    title: 'Interview Preparation',
    description: `Prepare for ${title} interviews with role-specific practice and mock interviews.`,
    type: 'INTERVIEW',
    priority: 'CRITICAL',
    subtopics: interviewTopics.slice(0, 6),
    resources: ['Role-specific interview question banks', 'Mock interviews (Pramp / peers)', 'STAR method guide'],
  });

  specs.push({
    title: 'Job Search & Applications',
    description: `Run a targeted job search for ${title} roles and manage applications and offers.`,
    type: 'PLACEMENT',
    priority: 'HIGH',
    subtopics: ['Build a target company list', 'Track applications in a spreadsheet', 'Request referrals and network', 'Prepare for salary negotiation', 'Evaluate and compare offers'],
    resources: ['LinkedIn / Naukri job search', 'Company career pages', 'Salary negotiation guides'],
  });

  const tasks = specs.map((task, index) => {
    const month = Math.min(totalMonths, Math.floor((index * totalMonths) / specs.length) + 1);
    return {
      title: `Month ${month}: ${task.title}`,
      description: task.description,
      type: task.type,
      priority: task.priority,
      order: index + 1,
      subtopics: task.subtopics,
      resources: task.resources,
    };
  });

  return {
    title: `${totalMonths}-Month Roadmap to Become a ${title}`,
    description: `A ${totalMonths}-month, role-specific plan for ${title} covering ${(role?.core || []).slice(0, 4).map(s => s.name).join(', ') || 'core skills'}, hands-on projects, interview preparation and job search.`,
    duration: `${totalMonths} months`,
    tasks,
  };
}

export interface RoleRecommendation {
  careerTitle: string;
  matchPercentage: number;
  confidenceScore: number;
  requiredSkills: string[];
  reasons: string[];
  influencingSkills: string[];
  influencingGoals: string[];
  industryDemand: string;
  growthPotential: string;
  salaryRange: string;
  description: string;
  category: string;
}

function userSkillKeySet(userSkills: string[]): string[] {
  return (userSkills || [])
    .map(name => skillKey(canonicalSkillName(String(name).replace(/\s*\([^)]*\)\s*$/, '').trim())))
    .filter(Boolean);
}

function roleMatchesGoal(role: RoleDefinition, goalText: string): boolean {
  if (!goalText) return false;
  const lower = goalText.toLowerCase();
  if (lower.includes(role.title.toLowerCase())) return true;
  return role.aliases.some(alias => alias.length > 4 && aliasRegex(alias).test(lower));
}

export function getRoleMatchDetails(roleText: string, userSkills: string[]): {
  role: RoleDefinition | null;
  matchingSkills: string[];
  missingSkills: string[];
  matchPercentage: number;
} {
  const role = resolveRole(roleText);
  if (!role) return { role: null, matchingSkills: [], missingSkills: [], matchPercentage: 0 };
  const userKeys = userSkillKeySet(userSkills);
  const all = [...role.core, ...role.advanced];
  const matching: string[] = [];
  const missing: string[] = [];
  for (const item of all) {
    if (userKeys.some(key => isDuplicateKey(key, skillKey(canonicalSkillName(item.name))))) {
      matching.push(item.name);
    } else {
      missing.push(item.name);
    }
  }
  const matchPercentage = all.length > 0 ? Math.round((matching.length / all.length) * 100) : 0;
  return { role, matchingSkills: matching, missingSkills: missing, matchPercentage };
}

export function recommendRoles(userSkills: string[], goalText: string, limit = 5): RoleRecommendation[] {
  const userKeys = userSkillKeySet(userSkills);
  const goals = String(goalText || '').trim();
  const scored = ROLE_DEFINITIONS.map(role => {
    const all = [...role.core, ...role.advanced];
    const matched = all.filter(item => userKeys.some(key => isDuplicateKey(key, skillKey(canonicalSkillName(item.name)))));
    const coreMatched = role.core.filter(item => userKeys.some(key => isDuplicateKey(key, skillKey(canonicalSkillName(item.name)))));
    const coreCoverage = role.core.length ? coreMatched.length / role.core.length : 0;
    const totalCoverage = all.length ? matched.length / all.length : 0;
    const goalMatch = roleMatchesGoal(role, goals);
    let score = 28 + coreCoverage * 42 + totalCoverage * 20;
    if (goalMatch) score += 12;
    if (matched.length === 0 && !goalMatch) score = Math.max(20, score - 18);
    score = Math.max(15, Math.min(96, Math.round(score)));
    return { role, matched, score, goalMatch, coreMatched };
  });

  scored.sort((a, b) => {
    if (b.goalMatch !== a.goalMatch) return b.goalMatch ? 1 : -1;
    return b.score - a.score;
  });

  const selected = scored.slice(0, Math.max(1, Math.min(8, limit)));
  return selected.map(({ role, matched, score }) => {
    const requiredSkills = [...role.core, ...role.advanced].map(s => s.name);
    const missingCore = role.core.filter(s => !matched.some(m => m.name === s.name)).map(s => s.name);
    const matchedNames = matched.map(s => s.name);
    const reasons: string[] = [];
    if (matched.length > 0) {
      reasons.push(`Your existing skills match ${matched.length} of ${requiredSkills.length} requirements for ${role.title} (${matchedNames.slice(0, 4).join(', ')}).`);
    }
    if (missingCore.length > 0) {
      reasons.push(`Focus next on ${missingCore.slice(0, 3).join(', ')} to become competitive for this role.`);
    }
    if (goals && roleMatchesGoal(role, goals)) {
      reasons.push(`This role aligns with your stated career goal: "${goals.slice(0, 80)}".`);
    }
    reasons.push(`${role.demand} hiring demand · ${role.growth}`);
    return {
      careerTitle: role.title,
      matchPercentage: score,
      confidenceScore: Math.max(35, Math.min(94, Math.round(score * 0.9 + (matched.length >= 5 ? 8 : 0)))),
      requiredSkills,
      reasons: reasons.slice(0, 3),
      influencingSkills: matched.map(item => item.name).slice(0, 6),
      influencingGoals: goals ? [goals.slice(0, 120)] : [],
      industryDemand: role.demand,
      growthPotential: role.growth,
      salaryRange: role.salaryRange,
      description: role.description,
      category: role.category,
    };
  });
}

export function isRoadmapRoleSpecific(roadmap: any, roleText: string): boolean {
  if (!roadmap || !Array.isArray(roadmap.tasks) || roadmap.tasks.length === 0) return false;
  const required = getRoleRequiredSkills(roleText);
  if (required.length === 0) return String(roadmap.title || '').toLowerCase().includes(String(roleText).toLowerCase().slice(0, 12));
  const text = JSON.stringify(roadmap).toLowerCase();
  let hits = 0;
  for (const skillName of required) {
    const key = skillKey(skillName);
    if (key.length < 3) continue;
    const readable = skillName.toLowerCase();
    if (text.includes(readable)) {
      hits += 1;
      if (hits >= 2) return true;
    }
  }
  return hits >= 2;
}
