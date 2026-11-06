import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';
import { normalizeUserSkillLevel, isDuplicateKey, skillKey, canonicalSkillName } from './skillGapUtils';
import {
  resolveRole,
  getRoleDetails,
  getRoleSkillSet as getCatalogRoleSkillSet,
  getRoleRequiredSkills,
  buildRoleRoadmap,
  recommendRoles,
  isRoadmapRoleSpecific,
} from './careerCatalog';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-placeholder',
});

const geminiKey = process.env.GEMINI_API_KEY || '';
const genAI = geminiKey ? new GoogleGenerativeAI(geminiKey) : null;

function canUseGemini(): boolean {
  const result = !!genAI && !!geminiKey && geminiKey !== 'your-gemini-api-key' && geminiKey.length > 10;
  console.log('[Gemini] canUseGemini:', result, '| key exists:', !!geminiKey, '| key length:', geminiKey?.length);
  return result;
}

function buildGeminiPrompt(
  systemPrompt: string,
  userMessage: string,
  context?: { role: string; content: string }[]
): string {
  let prompt = systemPrompt + '\n\n';
  if (context && context.length > 0) {
    for (const msg of context) {
      prompt += `[${msg.role.toUpperCase()}]: ${msg.content}\n`;
    }
  }
  prompt += `[USER]: ${userMessage}`;
  return prompt;
}

export async function generateAIResponse(
  systemPrompt: string,
  userMessage: string,
  context?: { role: string; content: string }[]
): Promise<string> {
  console.log('[AI] generateAIResponse called | userMessage:', userMessage.substring(0, 50));

  // 1. Try Gemini first (free)
  if (canUseGemini()) {
    try {
      console.log('[Gemini] Attempting Gemini API call...');
      const model = genAI!.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { temperature: 0.4 } });
      const prompt = buildGeminiPrompt(systemPrompt, userMessage, context);
      const result = await model.generateContent(prompt);
      const text = result.response.text();
      if (text && text.trim()) {
        console.log('[Gemini] Success! Response length:', text.length);
        return text;
      }
    } catch (error: any) {
      console.error('[Gemini] API ERROR:', error.message);
    }
  }

  // 2. Try OpenAI second
  if (canUseOpenAI()) {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...(context || []).map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.4,
        max_tokens: 2000,
      });

      return response.choices[0]?.message?.content || 'I apologize, but I could not generate a response.';
    } catch (error: any) {
      console.error('OpenAI API error, using local fallback:', error.message);
    }
  }

  // 3. Local fallback
  return generateLocalChatResponse(userMessage, context);
}

export async function* generateStreamingResponse(
  systemPrompt: string,
  userMessage: string,
  context?: { role: string; content: string }[]
): AsyncGenerator<string> {
  // 1. Try Gemini first (free)
  if (canUseGemini()) {
    try {
      const model = genAI!.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { temperature: 0.4 } });
      const prompt = buildGeminiPrompt(systemPrompt, userMessage, context);
      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) yield text;
      }
      return;
    } catch (error: any) {
      console.error('Gemini streaming error, trying OpenAI:', error.message);
    }
  }

  // 2. Try OpenAI second
  if (canUseOpenAI()) {
    try {
      const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...(context || []).map(msg => ({
          role: msg.role as 'system' | 'user' | 'assistant',
          content: msg.content,
        })),
        { role: 'user', content: userMessage },
      ];

      const stream = await openai.chat.completions.create({
        model: 'gpt-4',
        messages,
        temperature: 0.4,
        max_tokens: 2000,
        stream: true,
      });

      for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content;
        if (token) yield token;
      }
      return;
    } catch (error: any) {
      console.error('OpenAI streaming error, using local fallback:', error.message);
    }
  }

  // 3. Local fallback (simulated streaming)
  const full = generateLocalChatResponse(userMessage, context);
  const words = full.split(/(?<=\s)/);
  for (const word of words) {
    yield word;
    await new Promise(resolve => setTimeout(resolve, 30));
  }
}

function generateLocalChatResponse(userMessage: string, context?: { role: string; content: string }[]): string {
  const msg = userMessage.toLowerCase().trim();

  const recentMessages = (context || []).slice(-4).map(c => c.content.toLowerCase()).join(' ');
  const allContext = (context || []).map(c => c.content).join(' ');

  const skillMatch = allContext.match(/skills?:\s*([^.]+)/i);
  const userSkills = skillMatch ? skillMatch[1].split(',').map(s => s.trim()).filter(Boolean) : [];

  const eduMatch = allContext.match(/education:\s*([^.]+)/i);
  const userEdu = eduMatch ? eduMatch[1].trim() : '';

  const goalMatch = allContext.match(/career\s+goals?:\s*([^.]+)/i);
  const userGoal = goalMatch ? goalMatch[1].trim() : '';

  const roadmapMatch = allContext.match(/roadmap:\s*([^.]+)/i);
  const userRoadmap = roadmapMatch ? roadmapMatch[1].trim() : '';

  const recMatch = allContext.match(/recommendations?:?\s*([^.]+)/i);
  const userRecs = recMatch ? recMatch[1].trim() : '';

  const isGreeting = /\b(hi|hello|hey|good morning|good afternoon|good evening|howdy|sup|namaste)\b/i.test(msg) && msg.length < 30;
  const isThankYou = /\b(thanks?|thank you|thankful|grateful|appreciate)\b/i.test(msg);
  const isQuestion = msg.includes('?') || /\b(what|how|why|when|where|can you|could you|tell me|explain|suggest|recommend|advise|help)\b/i.test(msg);

  if (isGreeting) {
    const greetings = [
      'Hello! Welcome to CareerGPS AI. I\'m your career assistant. How can I help you today? You can ask me about career paths, skill development, interview preparation, resume tips, coding, technology, or anything at all.',
      'Hi there! Great to have you here. I\'m CareerGPS AI, your personal career mentor. What would you like to discuss? I can help with career guidance, job preparation, learning paths, coding, and more.',
      'Hey! Welcome back. I\'m here to help you navigate your career journey. What\'s on your mind today?'
    ];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  if (isThankYou) {
    return 'You\'re welcome! I\'m happy I could help. Feel free to ask me anything else about your career journey, skill development, job preparation, or any other questions you might have. I\'m here to support you every step of the way!';
  }

  if (/\b(hello|hi)\b.*\b(resume|skill|career|job|interview)\b/i.test(msg)) {
    const matched = msg.match(/\b(resume|skill|career|job|interview)\b/i);
    return `Hello! I'm CareerGPS AI. I can see you're interested in ${matched ? matched[0] : 'career'} topics. What specific questions do you have? I'm here to provide personalized guidance based on your profile and goals.`;
  }

  if (/\b(who are you|what are you|introduce yourself|tell me about yourself)\b/i.test(msg)) {
    return 'I\'m CareerGPS AI — an advanced AI assistant created to help you with every type of question. Think of me as your personal AI career mentor. I can help you with:\n\n' +
      '• **Career Guidance** — Explore career paths that match your skills and interests\n' +
      '• **Resume Analysis** — Review and optimize your resume for ATS and impact\n' +
      '• **Interview Preparation** — Practice with mock interviews and get feedback\n' +
      '• **Skill Development** — Identify skill gaps and create learning roadmaps\n' +
      '• **Job Search Strategy** — Prepare for placements and applications\n\n' +
      'What would you like help with today?';
  }

  if (/\b(resume|analyze|review)\b.*\b(resume|analyze|review)\b/i.test(msg) || /\bhow (is|was) my resume\b/i.test(msg)) {
    const resumeContext = allContext.match(/resume\s+score/i) ? 'based on your uploaded resume' : 'once you upload your resume';
    return `I can help you optimize your resume! Here are some key areas to focus on:\n\n` +
      `1. **ATS Optimization** — Make sure your resume includes relevant keywords from job descriptions\n` +
      `2. **Quantifiable Achievements** — Use numbers and percentages to show impact\n` +
      `3. **Clean Formatting** — Use consistent fonts, bullet points, and clear section headers\n` +
      `4. **Tailored Content** — Customize your resume for each role you apply to\n\n` +
      (userSkills.length > 0 ? `I can see you have skills in ${userSkills.slice(0, 5).join(', ')}. Make sure these are prominently featured in your skills section.` : '') +
      `\n\nWould you like me to review a specific section of your resume?`;
  }

  if (/\b(skill|skills? gap|what should i learn|upskill|learn)\b/i.test(msg) && !/\b(roadmap|road map)\b/i.test(msg)) {
    return (userSkills.length > 0
      ? `Based on your profile, you have skills in: ${userSkills.slice(0, 8).join(', ')}. That's a solid foundation!\n\n`
      : '') +
      `To identify skill gaps, consider:\n\n` +
      `1. **Research target roles** — Look at job descriptions for positions you want\n` +
      `2. **Compare requirements** — Note which skills are commonly required but you don't have yet\n` +
      `3. **Prioritize by demand** — Focus on skills that appear most frequently in job postings\n` +
      `4. **Build projects** — Apply new skills through practical projects\n\n` +
      `For tech roles, trending skills include: Cloud (AWS/Azure), AI/ML, DevOps, TypeScript, and System Design. What specific career path are you targeting?`;
  }

  if (/\b(roadmap|road map|path|learning path|study plan)\b/i.test(msg)) {
    return (userRoadmap && userRoadmap !== 'No active roadmap'
      ? `I see you have a roadmap: "${userRoadmap}". ` +
        `Make sure you're following it consistently. Break down each phase into weekly goals and track your progress.\n\n`
      : '') +
      `A good learning roadmap typically includes:\n\n` +
      `1. **Foundation** — Core concepts and fundamentals (Weeks 1-4)\n` +
      `2. **Hands-on Practice** — Building projects to apply learning (Weeks 5-8)\n` +
      `3. **Advanced Topics** — Deep diving into specialized areas (Weeks 9-12)\n` +
      `4. **Interview Prep** — Practicing for interviews (Weeks 13-16)\n` +
      `5. **Job Applications** — Applying and networking (Weeks 17-24)\n\n` +
      `What stage are you currently at in your learning journey?`;
  }

  if (/\b(interview|mock|practice|prepare)\b.*\b(interview|mock|practice|prepare)\b/i.test(msg) || /\binterview (question|tip|preparation)\b/i.test(msg)) {
    return `Great, let's work on interview preparation! Here's my framework:\n\n` +
      `**1. Know the company** — Research the company's products, culture, and recent news\n` +
      `**2. Practice STAR stories** — Prepare 5-7 stories using Situation, Task, Action, Result format\n` +
      `**3. Technical preparation** — ${userSkills.length > 0 ? `Review ${userSkills.slice(0, 3).join(', ')} concepts and practice problems` : 'Review core concepts and practice coding problems'}\n` +
      `**4. Mock interviews** — Practice with friends or use our interview coach feature\n` +
      `**5. Follow up** — Send thank-you emails within 24 hours\n\n` +
      `Would you like me to conduct a mock interview with you? I can ask questions and give feedback on your answers.`;
  }

  if (/\b(career|job|role|position|path|opportunity)\b/i.test(msg) && /\b(what|suggest|recommend|advise|help|guide)\b/i.test(msg)) {
    const response = userRecs && userRecs !== 'None'
      ? `Based on your profile, you've been recommended: ${userRecs}. ` +
        `These paths align well with your skills and background. Would you like me to elaborate on any of these?`
      : (userSkills.length > 0
        ? `With your skills in ${userSkills.slice(0, 5).join(', ')}, here are some career paths to consider:\n\n` +
          `• **Software Development** — Build applications using your programming skills\n` +
          `• **Data Science / ML Engineering** — Leverage your analytical and ML skills\n` +
          `• **DevOps / Cloud Engineering** — Focus on infrastructure and deployment\n` +
          `• **Product Management** — Combine technical knowledge with business acumen\n\n` +
          `Which of these interests you most?`
        : '');

    return response || 'Career exploration is exciting! Tell me more about your interests, skills, and what kind of work environment you prefer, and I\'ll help you find the right path.';
  }

  if (/\b(placement|job search|apply|application|hiring|recruit|company)\b/i.test(msg)) {
    return `Here's a strategic approach to job placements:\n\n` +
      `**1. Target companies** — Make a list of dream companies, reach companies, and safe bets\n` +
      `**2. Prepare your materials** — Tailor your resume and cover letter for each application\n` +
      `**3. Build your network** — Connect with employees, attend career fairs, use LinkedIn\n` +
      `**4. Practice assessments** — Many companies have online tests, aptitude rounds, and coding challenges\n` +
      `**5. Track applications** — Use a spreadsheet to track where you've applied and follow-ups\n\n` +
      `Would you like specific advice for campus placements or off-campus applications?`;
  }

  if (/\b(salary|package|compensation|negotiate|offer|ctc|rupees|lpa)\b/i.test(msg)) {
    return `Salary negotiation tips (India context):\n\n` +
      `1. **Research market rates** — Use Glassdoor, AmbitionBox, Naukri, LinkedIn Salaries for your role and experience in India\n` +
      `2. **Understand CTC breakdown** — Base pay + HRA + bonuses + PF + gratuity + stocks + other allowances\n` +
      `3. **Consider total compensation** — Fixed salary + variable pay + ESOPs/RSUs + insurance + learning budget\n` +
      `4. **Negotiate in-hand salary** — A high CTC with low in-hand may not be ideal. Ask for the breakup.\n` +
      `5. **Time it right** — Negotiate after receiving the offer letter, not during interviews\n` +
      `6. **Be professional** — Express enthusiasm while advocating for fair compensation in ₹\n\n` +
      `What specific aspect of negotiations would you like help with?`;
  }

  if (/\b(motivat|inspire|discourag|burnout|stress|confident|fear|anxious|nervous)\b/i.test(msg)) {
    return `I understand career journeys can be challenging at times. Here's some perspective:\n\n` +
      `• Every expert was once a beginner — consistency matters more than perfection\n` +
      `• Rejections are redirections — each "no" teaches you something valuable\n` +
      `• Your journey is unique — don't compare your chapter 2 to someone else's chapter 10\n` +
      `• Progress over perfection — small steps every day compound into big results\n` +
      `• Take care of yourself — burnout helps no one. Rest, recharge, and come back stronger\n\n` +
      `What's specifically bothering you? Sometimes just talking it through helps.`;
  }

  if (/\b(thanks|thank you|appreciate|grateful)\b/i.test(msg)) {
    return 'You\'re very welcome! Remember, I\'m always here whenever you need career advice, interview practice, or just someone to brainstorm with. Keep pushing forward — your hard work will pay off!';
  }

  if (isQuestion) {
    const topic = msg.replace(/^(what|how|why|when|where|can|could|would|should|is|are|do|does|did|tell me|explain|define|describe|show|give|list|name)['\s]/i, '').replace(/[?\s]+$/, '').trim();

    if (/\b(what is|what are|define|explain|tell me about|describe|who is|meaning of)\b/i.test(msg) && topic.length > 3) {
      const knownTopics: Record<string, string> = {
        'machine learning': 'Machine Learning (ML) is a subset of AI that enables systems to learn and improve from experience without being explicitly programmed. Key types include supervised learning (labeled data), unsupervised learning (finding patterns), and reinforcement learning (reward-based). Popular algorithms: Linear Regression, Decision Trees, Neural Networks, SVMs.',
        'deep learning': 'Deep Learning is a subset of ML using neural networks with many layers (deep neural networks). It excels at tasks like image recognition, natural language processing, and speech recognition. Key architectures: CNNs (images), RNNs/LSTMs (sequences), Transformers (NLP).',
        'artificial intelligence': 'Artificial Intelligence (AI) is the simulation of human intelligence by machines. It encompasses ML, Deep Learning, NLP, Computer Vision, and Robotics. AI is transforming industries from healthcare to finance with applications in automation, prediction, and decision-making.',
        'cloud computing': 'Cloud computing delivers computing services (servers, storage, databases, networking, software) over the internet. Major providers: AWS, Azure, Google Cloud. Models: IaaS, PaaS, SaaS. Benefits include scalability, cost-efficiency, and global reach.',
        'devops': 'DevOps is a set of practices combining software development (Dev) and IT operations (Ops). It emphasizes automation, CI/CD pipelines, infrastructure as code, monitoring, and collaboration between teams. Key tools: Docker, Kubernetes, Jenkins, Terraform.',
        'data science': 'Data Science involves extracting insights from data using statistics, ML, and domain expertise. The workflow includes data collection, cleaning, exploration, modeling, and deployment. Key skills: Python/R, SQL, statistics, ML, data visualization.',
        'blockchain': 'Blockchain is a distributed, decentralized ledger technology that records transactions across many computers. Key concepts: blocks, chains, consensus mechanisms (PoW, PoS), smart contracts. Applications: cryptocurrencies, supply chain, voting systems.',
        'cybersecurity': 'Cybersecurity protects systems, networks, and data from digital attacks. Key areas: network security, application security, information security, incident response. Common threats: malware, phishing, DDoS, ransomware. Best practices: regular updates, strong passwords, MFA.',
        'full stack development': 'Full Stack Development involves working on both frontend (user interface) and backend (server, database) parts of web applications. Popular stacks: MERN (MongoDB, Express, React, Node), MEAN, LAMP. Key skills: HTML/CSS, JavaScript, databases, APIs, deployment.',
        'docker': 'Docker is a containerization platform that packages applications and their dependencies into lightweight, portable containers. Benefits: consistency across environments, faster deployment, scalability. Key concepts: images, containers, Dockerfile, Docker Compose, volumes, networks.',
        'kubernetes': 'Kubernetes (K8s) is an open-source container orchestration platform for automating deployment, scaling, and management of containerized applications. Key concepts: pods, services, deployments, namespaces, configmaps. It ensures high availability and auto-scaling.',
        'react': 'React is a JavaScript library for building user interfaces, developed by Meta. It uses a component-based architecture with a virtual DOM for efficient rendering. Key concepts: JSX, state, props, hooks (useState, useEffect), context API, React Router.',
        'python': 'Python is a high-level, interpreted programming language known for readability and versatility. Used extensively in data science, ML, web development (Django/Flask), automation, and scripting. Key strengths: extensive libraries, large community, cross-platform.',
        'typescript': 'TypeScript is a typed superset of JavaScript that compiles to plain JavaScript. It adds static typing, interfaces, generics, and modern ES features. Benefits: better IDE support, fewer runtime errors, improved code maintainability.',
        'sql': 'SQL (Structured Query Language) is the standard language for managing relational databases. Key operations: SELECT, INSERT, UPDATE, DELETE, JOIN, GROUP BY, subqueries. Popular databases: PostgreSQL, MySQL, SQLite, SQL Server.',
        'aws': 'Amazon Web Services (AWS) is the leading cloud platform offering 200+ services. Key services: EC2 (compute), S3 (storage), RDS (databases), Lambda (serverless), CloudFront (CDN). AWS certifications: Solutions Architect, Developer, SysOps Administrator.',
        'git': 'Git is a distributed version control system for tracking changes in code. Key concepts: repositories, commits, branches, merging, rebasing, pull requests. Popular platforms: GitHub, GitLab, Bitbucket. Essential for collaboration in software development.',
        'photosynthesis': 'Photosynthesis is the process by which plants, algae, and some bacteria convert sunlight, carbon dioxide, and water into glucose (food) and oxygen. It occurs in chloroplasts and uses chlorophyll to capture light energy. The general equation is: 6CO₂ + 6H₂O + sunlight → C₆H₁₂O₆ + 6O₂.',
        'gravity': 'Gravity is a fundamental force of nature that attracts objects with mass toward each other. Described by Newton\'s law of universal gravitation, the force is proportional to the product of masses and inversely proportional to the square of the distance between them. Einstein\'s general relativity describes gravity as the curvature of spacetime.',
        'internet': 'The Internet is a global network of interconnected computers that communicate using TCP/IP protocols. It enables access to websites, email, streaming, social media, and countless services. The World Wide Web (WWW) is a subset of the internet that uses HTTP/HTTPS to serve web pages.',
        'climate change': 'Climate change refers to long-term shifts in global temperatures and weather patterns, primarily driven by human activities like burning fossil fuels, deforestation, and industrial processes. Key effects include rising sea levels, extreme weather, biodiversity loss, and disruptions to agriculture.',
        'world war 2': 'World War II (1939-1945) was a global conflict involving most of the world\'s nations, forming two opposing alliances: the Allies (US, UK, USSR, China) and the Axis (Germany, Japan, Italy). It was the deadliest war in history, with over 70 million casualties, and ended with the defeat of the Axis powers.',
        'solar system': 'The Solar System consists of the Sun (a star) and everything that orbits it: 8 planets (Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune), dwarf planets, moons, asteroids, comets, and meteoroids. The Sun contains 99.86% of the system\'s mass.',
        'dna': 'DNA (Deoxyribonucleic Acid) is a molecule that carries genetic instructions for the development, functioning, growth, and reproduction of all living organisms. It has a double helix structure made of nucleotides (A, T, G, C). Genes are segments of DNA that code for proteins.',
        'economics': 'Economics is the social science that studies how individuals, businesses, governments, and societies make choices about allocating scarce resources. It is divided into microeconomics (individual decision-making) and macroeconomics (economy-wide phenomena like inflation, GDP, unemployment).',
        'java': 'Java is a high-level, object-oriented programming language developed by Sun Microsystems (now Oracle). It follows the "write once, run anywhere" principle through the Java Virtual Machine (JVM). Key features: automatic garbage collection, strong typing, extensive standard library. Used for enterprise apps, Android, web servers.',
        'c programming': 'C is a general-purpose, procedural programming language developed by Dennis Ritchie at Bell Labs in 1972. It is the foundation for many modern languages and operating systems. Key features: low-level memory access, pointers, structured programming. Used in systems programming, embedded systems, and operating systems.',
        'html': 'HTML (HyperText Markup Language) is the standard markup language for creating web pages. It uses tags to structure content with elements like headings, paragraphs, links, images, and forms. HTML5 is the latest version, adding semantic elements, multimedia support, and APIs for modern web applications.',
        'css': 'CSS (Cascading Style Sheets) is a stylesheet language used to describe the presentation of HTML documents. It controls layout, colors, fonts, and responsive design. Key concepts: selectors, box model, flexbox, grid, animations, and media queries for responsive design.',
        'node.js': 'Node.js is a JavaScript runtime built on Chrome\'s V8 engine that allows JavaScript to run on the server. It uses an event-driven, non-blocking I/O model, making it lightweight and efficient. Key features: npm ecosystem, Express.js framework, async/await, real-time capabilities via WebSockets.',
        'mongodb': 'MongoDB is a NoSQL document database that stores data in flexible, JSON-like documents. It uses a schema-less design, making it ideal for rapid development and scaling. Key features: collections, documents, indexes, aggregation pipeline, replica sets for high availability.',
        'postgresql': 'PostgreSQL is a powerful, open-source relational database management system with over 30 years of active development. It supports ACID transactions, advanced indexing (B-tree, hash, GiST, GIN), JSON data, full-text search, and custom functions. Known for reliability and standards compliance.',
        'rest api': 'REST (Representational State Transfer) API is an architectural style for designing networked applications. It uses HTTP methods (GET, POST, PUT, DELETE) to perform CRUD operations on resources. Key principles: statelessness, uniform interface, resource-based URLs, and standard status codes.',
        'graphql': 'GraphQL is a query language for APIs developed by Meta. Unlike REST, it allows clients to request exactly the data they need, reducing over-fetching and under-fetching. Key features: type system, queries, mutations, subscriptions, and real-time data updates.',
        'oop': 'Object-Oriented Programming (OOP) is a programming paradigm based on the concept of "objects" containing data and methods. Four main principles: encapsulation (hiding internal state), inheritance (reusing code), polymorphism (same interface, different implementations), and abstraction (hiding complexity).',
        'system design': 'System Design is the process of defining the architecture, components, modules, and data flow of a system to satisfy specific requirements. Key concepts: scalability, load balancing, caching, database sharding, microservices, message queues, CDN, and CAP theorem.',
        'data structures': 'Data Structures are ways of organizing and storing data for efficient access and modification. Common structures: arrays, linked lists, stacks, queues, trees (binary, BST, AVL), graphs, hash tables, heaps, and tries. Choosing the right structure is critical for algorithm performance.',
        'algorithms': 'Algorithms are step-by-step procedures for solving problems. Key types: sorting (quick sort, merge sort), searching (binary search), graph (BFS, DFS, Dijkstra), dynamic programming, greedy algorithms, and divide-and-conquer. Time complexity is measured using Big O notation.',
        'networking': 'Computer networking connects devices to share data and resources. Key concepts: OSI and TCP/IP models, IP addressing, DNS, HTTP/HTTPS, TCP vs UDP, routing, switching, firewalls, load balancers, and network topologies. The internet is the largest example of a computer network.',
        'operating system': 'An Operating System (OS) is system software that manages hardware resources and provides services for computer programs. Key functions: process management, memory management (paging, segmentation), file systems, device drivers, and security. Examples: Windows, Linux, macOS, Android, iOS.',
        'linux': 'Linux is an open-source, Unix-like operating system kernel created by Linus Torvalds. It powers most servers, cloud infrastructure, Android devices, and embedded systems. Key concepts: command line, file permissions, package managers (apt, yum), shell scripting, and system administration.',
        'computer networks': 'Computer networking connects devices to share data and resources. Key concepts: OSI and TCP/IP models, IP addressing, DNS, HTTP/HTTPS, TCP vs UDP, routing, switching, firewalls, load balancers, and network topologies. The internet is the largest example of a computer network.',
      };

      const topicLower = topic.toLowerCase();
      for (const [key, value] of Object.entries(knownTopics)) {
        if (topicLower.includes(key) || key.includes(topicLower)) {
          return value + '\n\n' + (userSkills.length > 0
            ? `I see you have experience in ${userSkills.slice(0, 4).join(', ')}. Would you like to know how this connects to your career path?`
            : 'Would you like to explore how this fits into your career growth? I can help you create a learning plan around it.');
        }
      }

      return `That's an interesting question about "${topic.substring(0, 50)}" — unfortunately, I don't have enough information in my knowledge base to give you a thorough answer on that specific topic.\n\n` +
        `Here's what I'd suggest:\n` +
        `1. **Try asking on my online mode** — Configure an OpenAI API key in the backend .env file for full ChatGPT-like capabilities\n` +
        `2. **Search online** — Use Google, Wikipedia, or specialized forums for the most up-to-date information\n` +
        `3. **Ask me to elaborate** — If you can share more context about what you're looking for, I might be able to help connect it to career or learning topics\n\n` +
        `I want to be honest with you rather than make something up. What else can I help you with?`;
    }

    if (/\b(how (to|do|can|should)|what should|which|tips?|advice|suggest)\b/i.test(msg)) {
      return (userGoal ? `Regarding your goal of becoming a ${userGoal}, ` : '') +
        `I'd love to give you specific advice, but I need a bit more context from you:\n\n` +
        `• **What exactly are you trying to learn or achieve?** Be as specific as possible\n` +
        `• **Where are you starting from?** Your current experience level helps me tailor suggestions\n` +
        `• **What's your timeline?** Are you preparing for something specific?\n\n` +
        `If you share more details, I can give you more targeted help. Otherwise, I want to be honest — I don't want to give you generic advice that might not apply to your situation.`;
    }

    const unknownTopicResponse = `I'm afraid I don't have enough information to give you a meaningful answer about "${topic.substring(0, 100)}". I don't want to make something up or give you incorrect information.\n\n` +
      `**Here's what I recommend:**\n` +
      `• For the best experience, configure an OpenAI API key in the backend to unlock full AI capabilities\n` +
      `• Try searching online for reliable resources on this topic\n` +
      `• Feel free to ask me about career guidance, skills, interviews, or learning paths — those are my strengths!\n\n` +
      `What else can I help you with?`;
    return unknownTopicResponse;
  }

  return `I'm not sure I understood your question correctly. I'm currently running in offline mode with limited knowledge, so I can best help you with:\n\n` +
    `• **Career guidance** — Path exploration, industry insights, job strategies\n` +
    `• **Interview prep** — Mock questions, tips, and feedback\n` +
    `• **Resume help** — ATS optimization, structure, and content advice\n` +
    `• **Skill development** — Learning paths and resource recommendations\n` +
    `• **Placement prep** — Campus placement strategies and company prep\n` +
    `• **General tech knowledge** — Programming, AI, cloud, DevOps, and more\n\n` +
    `For full ChatGPT-like capabilities on any topic, configure an OpenAI API key in the backend .env file.\n\n` +
    `What can I help you with?`;
}

export async function analyzeResumeWithAI(resumeText: string): Promise<any> {
  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are a resume parsing expert. Carefully extract information from ANY resume template format.
Return a JSON object with exactly these fields:
- skills (array of strings — ONLY technical/professional skills, NEVER mix in education, project names, or personal info)
- education (string summarizing education — degrees, institutions, years. Do NOT include projects or skills here)
- certifications (array of strings)
- projects (array of {title, description, technologies[]} — ONLY actual projects. Do NOT mix in work experience or internships)
- internships (array of {company, position, description} — ONLY internships. Do NOT mix in full-time jobs or projects)
- experience (string — work experience summary only)
- achievements (array of strings)
- technologies (array of strings)
- name (string, optional)
- email (string, optional)
- mobile (string, optional)

CRITICAL RULES:
1. DO NOT mix content between sections. Skills must be skills only. Education must be education only.
2. Project titles should be the actual project name, not a section header.
3. If you cannot clearly identify a section, leave it as an empty array/string.
4. Parse each section independently. A line in the SKILLS section should never appear in PROJECTS.

Also include analysis scores:
- resumeScore (0-100)
- atsScore (0-100)
- careerReadiness (0-100)
- employabilityScore (0-100)
- strengths (array of strings)
- weaknesses (array of strings)

Return ONLY valid JSON, no markdown formatting.`;

      const parsed = await generateJSONWithAI(systemPrompt, resumeText.substring(0, 15000), 0.3, 3000);
      if (parsed !== null) return parsed;
    } catch (error: any) {
      console.error('AI resume analysis failed, using local fallback:', error.message);
    }
  }

  return analyzeResumeLocally(resumeText);
}

function analyzeResumeLocally(resumeText: string) {
  const lines = resumeText.split('\n');
  const nonEmptyLines = lines.map(l => l.trim()).filter(Boolean);
  const fullText = resumeText;

  const emailPattern = /[\w.-]+@[\w.-]+\.\w+/;
  const emailMatch = fullText.match(emailPattern);
  const phonePattern = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/;
  const phoneMatch = fullText.match(phonePattern);

  const knownTechnicalSkills = new Set([
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'c', 'go', 'rust', 'swift', 'kotlin',
    'php', 'ruby', 'scala', 'perl', 'r', 'matlab', 'dart', 'elixir', 'clojure', 'haskell',
    'react', 'angular', 'vue', 'svelte', 'next.js', 'nuxt', 'node.js', 'express', 'django', 'flask',
    'spring boot', 'spring', 'fastapi', 'asp.net', 'rails', 'laravel', 'symfony',
    'sql', 'mysql', 'postgresql', 'mongodb', 'sqlite', 'oracle', 'redis', 'elasticsearch',
    'aws', 'azure', 'gcp', 'docker', 'kubernetes', 'jenkins', 'terraform', 'ansible',
    'git', 'github', 'gitlab', 'bitbucket', 'linux', 'bash', 'powershell',
    'html', 'css', 'sass', 'less', 'tailwind', 'bootstrap', 'material ui',
    'rest api', 'graphql', 'grpc', 'websocket', 'microservices',
    'machine learning', 'deep learning', 'nlp', 'computer vision', 'tensorflow', 'pytorch',
    'pandas', 'numpy', 'scikit-learn', 'matplotlib', 'seaborn', 'opencv',
    'tableau', 'power bi', 'looker', 'excel',
    'agile', 'scrum', 'jira', 'confluence',
    'figma', 'sketch', 'adobe xd', 'photoshop', 'illustrator',
    'selenium', 'jest', 'mocha', 'cypress', 'pytest', 'junit',
    'kafka', 'rabbitmq', 'nginx', 'apache', 'tomcat',
    'hadoop', 'spark', 'airflow', 'snowflake', 'databricks',
    'blockchain', 'solidity', 'web3', 'ethereum',
    'ci/cd', 'devops', 'mlops', 'data science', 'data engineering',
    'oop', 'system design', 'data structures', 'algorithms',
  ]);

  const headerCandidates: { name: string; startIdx: number; cleanedName: string }[] = [];

  const headerRegex = /^(?:\d+[\.\)]\s*|[\*\-•·●▪➢→]\s*|\[.*?\]?\s*)?(?:(?:PROFESSIONAL\s+)?SUMMARY|EDUCATION|TECHNICAL\s+SKILLS?|SKILLS?\s*(?:&\s*TOOLS|&\s*TECHNOLOGIES|&\s*ABILITIES)?|SKILLS?|PROJECTS?|EXPERIENCE|INTERNSHIP|WORK\s+(?:EXPERIENCE|HISTORY)|EMPLOYMENT|CERTIFICATIONS?|ACHIEVEMENTS?|AWARDS?|LEADERSHIP|VOLUNTEER|PUBLICATIONS?|LANGUAGES?|INTERESTS?|ACTIVITIES?|COURSES?|TRAINING|RESEARCH|EXTRACURRICULAR|ADDITIONAL|CORE\s+COMPETENCIES|TECHNOLOGIES|TOOLS\s*(?:&\s*TECHNOLOGIES)?|RELEVANT\s+EXPERIENCE|PROFESSIONAL\s+EXPERIENCE|ACADEMIC\s+(?:PROJECTS?|BACKGROUND|QUALIFICATIONS)|EDUCATIONAL\s+BACKGROUND|QUALIFICATIONS|PERSONAL\s+PROJECTS?|MAJOR\s+PROJECTS?)\s*:?$/im;

  const headerLowerRegex = /^(?:\d+[\.\)]\s*|[\*\-•·●▪➢→]\s*|\[.*?\]?\s*)?(?:professional\s+)?summary|education|technical\s+skills?(?:\s*&\s*(?:tools|technologies|abilities))?|skills?|projects?|experience|internship|work\s+(?:experience|history)|employment|certifications?|achievements?|core\s+competencies|technologies|tools(?:\s*&\s*technologies)?|relevant\s+experience|professional\s+experience|academic\s+(?:projects?|background|qualifications)|educational\s+background|qualifications|personal\s+projects?|major\s+projects?/i;

  for (let i = 0; i < nonEmptyLines.length; i++) {
    const lineTrimmed = nonEmptyLines[i];
    const cleanedForMatch = lineTrimmed.replace(/[*_]/g, '').trim();
    if (cleanedForMatch.length >= 60) continue;

    const isHeader = headerRegex.test(cleanedForMatch) ||
      headerLowerRegex.test(cleanedForMatch.replace(/[:]$/, ''));
    if (isHeader) {
      const cleanName = cleanedForMatch.replace(/^\d+[\.\)]\s*/, '').replace(/^[\*\-•·●▪➢→]\s*/, '').replace(/:$/, '').trim();
      headerCandidates.push({ name: cleanName, startIdx: i, cleanedName: cleanName.toLowerCase() });
    }
  }

  headerCandidates.sort((a, b) => a.startIdx - b.startIdx);

  function getSectionContent(headerKey: string): string[] {
    let start = -1, end = nonEmptyLines.length;
    for (let i = 0; i < headerCandidates.length; i++) {
      if (headerCandidates[i].cleanedName.includes(headerKey.toLowerCase()) ||
          headerKey.toLowerCase().includes(headerCandidates[i].cleanedName)) {
        start = headerCandidates[i].startIdx;
        end = i < headerCandidates.length - 1 ? headerCandidates[i + 1].startIdx : nonEmptyLines.length;
        break;
      }
    }
    if (start === -1) return [];
    const content = nonEmptyLines.slice(start + 1, end).filter(l => l.length > 1);
    return content.filter(l => {
      const trimmed = l.replace(/[*_]/g, '').trim();
      return !headerRegex.test(trimmed) && !headerLowerRegex.test(trimmed.replace(/[:]$/, ''));
    });
  }

  let name = '';
  if (nonEmptyLines.length > 0) {
    const firstLine = nonEmptyLines[0].replace(/[^a-zA-Z\s]/g, '').trim();
    if (firstLine.split(/\s+/).length <= 4 && firstLine.length > 5) {
      name = firstLine;
    }
  }

  const skillsContent = getSectionContent('skills').length > 0
    ? getSectionContent('skills')
    : (getSectionContent('technologies').length > 0 ? getSectionContent('technologies') : getSectionContent('tools'));

  const skills: string[] = [];
  for (const line of skillsContent.length > 0 ? skillsContent : []) {
    const cleanedLine = line.replace(/^[A-Za-z\s&/]+:\s*/, '').trim();
    const parts = cleanedLine.split(/[,|•\-;·•●▪➢→/]+/).map(s => s.trim()).filter(Boolean);
    for (const part of parts) {
      const cleaned = part.replace(/^[•\-*·●▪➢→]\s*/, '').replace(/\s+/g, ' ').trim();
      if (cleaned.length > 1 && cleaned.length < 50 &&
          !/^(the|and|or|for|with|from|this|that|a|an|in|on|at|by|to|of|is|was|are)$/i.test(cleaned) &&
          /[a-zA-Z]/.test(cleaned) &&
          !/^\d/.test(cleaned)) {
        skills.push(cleaned);
      }
    }
  }

  const filteredSkills = skills.filter(s => {
    const lower = s.toLowerCase();
    if (knownTechnicalSkills.has(lower)) return true;
    if (lower.length <= 2) return false;
    if (/^(teamwork|leadership|communication|problem.solving|certification|course|training|project|internship|education|bachelor|master|phd|diploma)$/i.test(s)) return false;
    if (/\d{4}/.test(s)) return false;
    for (const known of knownTechnicalSkills) {
      if (lower.includes(known) || known.includes(lower)) return true;
    }
    if (/^[A-Z][a-z]+(\s*[A-Z][a-z]+)*$/.test(s) && s.length > 3) return true;
    if (/^[A-Z]{2,}$/.test(s)) return true;
    return false;
  });

  const allSkills = [...new Set(filteredSkills)];

  const educationContent = getSectionContent('education');
  let education = '';
  const eduDegreePattern = /(B\.?\s*Tech|M\.?\s*Tech|Bachelor|Master|PhD|Ph\.D|B\.?\s*E|M\.?\s*E|B\.?\s*Sc|M\.?\s*Sc|BCA|MCA|Diploma|BBA|MBA|B\.?\s*A|M\.?\s*A|B\.?\s*Com|M\.?\s*Com|HSC|SSC|12th|10th|XII|X|B\.?\s*Arch|M\.?\s*Arch|B\.?\s*Pharm|M\.?\s*Pharm|MBBS|MD|LLB|LLM|B\.?\s*Ed|M\.?\s*Ed|PG\s*Diploma|Graduate|Post\s*Graduate|Doctorate)/i;
  const eduInstitutionPattern = /(University|College|Institute|School|Academy|IIT|NIT|IIIT|IISc|BITS|VIT|SRM|LPU|Amrita|MIT|Stanford|Harvard|Oxford|Cambridge|Delhi|Mumbai|Pune|Anna|JNTU|RGPV|GTU|AKTU|VTU)/i;
  const eduYearPattern = /\b\d{4}\s*[-–]\s*\d{4}\b|\b\d{4}\b/;
  const eduGradePattern = /(GPA|CGPA|Percentage|Grade|SGPA|Aggregate|Marks|Score|CPI|SPI)[:\s]*(\d+\.?\d*)/i;

  if (educationContent.length > 0) {
    const eduLines: string[] = [];
    for (const line of educationContent) {
      if (eduDegreePattern.test(line) || eduInstitutionPattern.test(line) || eduYearPattern.test(line) || eduGradePattern.test(line)) {
        eduLines.push(line);
      }
    }
    if (eduLines.length === 0) {
      for (const line of educationContent) {
        if (line.length > 3 && !/^(about me|profile|summary|objective|skill)/i.test(line)) {
          eduLines.push(line);
        }
      }
    }
    if (eduLines.length > 0) {
      education = eduLines.join(' ').trim();
      if (education.length > 500) education = education.substring(0, 500) + '...';
    }
  }

  if (!education) {
    let eduLines: string[] = [];
    let inEdu = false;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (l.length < 2) continue;
      if (/^education\b/i.test(l) || /^educational\b/i.test(l) || /^academic\b.*background/i.test(l) || /^qualifications/i.test(l)) { inEdu = true; continue; }
      if (inEdu && /^(experience|projects?|skills?|certifications?|internship|achievements?|languages?|interests?|activities?|volunteer|publications?|references?|work\s+experience|employment|technical\s+skills)/i.test(l)) { break; }
      if (inEdu && eduDegreePattern.test(l) || eduInstitutionPattern.test(l) || eduYearPattern.test(l) || eduGradePattern.test(l)) {
        eduLines.push(l);
      }
    }
    if (eduLines.length > 0) {
      education = eduLines.join(' ').substring(0, 300);
    }
  }

  const fullEduFallback = fullText.match(/(B\.?\s*Tech|M\.?\s*Tech|Bachelor|Master|PhD|Ph\.D|B\.?\s*E|M\.?\s*E|B\.?\s*Sc|M\.?\s*Sc|BCA|MCA|Diploma|BBA|MBA|B\.?\s*Com|M\.?\s*Com|HSC|SSC|12th|10th|XII|X)\s[^.]*(?:University|College|Institute|School|Academy|IIT|NIT|IIIT|IISc)[^.]*(?:\d{4}\s*[-–]\s*\d{4})?/i);
  if (!education && fullEduFallback) {
    education = fullEduFallback[0].trim().substring(0, 300);
  }

  const projectContent = getSectionContent('project').length > 0
    ? getSectionContent('project')
    : getSectionContent('academic');

  const projects: { title: string; description: string; technologies: string[] }[] = [];
  if (projectContent.length > 0) {
    let current: { title: string; description: string; technologies: string[] } | null = null;

    const dateRangePattern = /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s*\d{4}\b|\b\d{4}\s*[-–]\s*(?:\d{4}|Present|Current|Ongoing)\b|\b(?:Spring|Summer|Fall|Winter)\s*\d{4}\b/;
    const isLikelyProjectLine = (text: string): boolean => {
      const t = text.trim();
      if (!t || t.length < 3) return false;
      if (/^(technologies|tech stack|tools|features|description|overview|summary|introduction|about|link|url|github|demo|live|screenshot|objective|responsibilities)/i.test(t)) return true;
      if (dateRangePattern.test(t)) return false;
      if (t.startsWith('•') || t.startsWith('-') || t.startsWith('·')) return false;
      if (/^[A-Z][A-Za-z0-9\s\-:,./()&_]+$/.test(t) && t.length < 100) return true;
      if (/^Project\s+\d+/i.test(t)) return true;
      return false;
    };

    for (const line of projectContent) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.length < 2) continue;

      const techTagMatch = trimmed.match(/^Technologies?\s*:?\s*(.+)$/i);
      if (techTagMatch) {
        if (current) {
          current.technologies = techTagMatch[1].split(/[,;•·●▪]+/).map(s => s.trim()).filter(Boolean);
        }
        continue;
      }

      if (dateRangePattern.test(trimmed) && current) {
        projects.push(current);
        current = null;
        continue;
      }

      const isBullet = /^[•\-·●▪➢→◆◇‣⁃◦▸▹▹►▪▫*]\s*/.test(trimmed);
      const isTitle = isLikelyProjectLine(trimmed);

      if (isTitle && !isBullet) {
        if (current && current.title) projects.push(current);
        current = { title: trimmed, description: '', technologies: [] };
      } else if (isBullet) {
        const text = trimmed.replace(/^[•\-·●▪➢→◆◇‣⁃◦▸▹▹►▪▫*]\s*/, '');
        if (current) {
          current.description += (current.description ? ' ' : '') + text;
        } else {
          current = { title: 'Project ' + (projects.length + 1), description: text, technologies: [] };
        }
      } else if (current) {
        current.description += (current.description ? ' ' : '') + trimmed;
      }
    }
    if (current && (current.title || current.description)) projects.push(current);

    for (let i = projects.length - 1; i >= 0; i--) {
      const p = projects[i];
      const lowerTitle = p.title.toLowerCase();
      if (lowerTitle === 'project' || lowerTitle.startsWith('project ') && !p.description) {
        projects.splice(i, 1);
        continue;
      }
      for (let j = i - 1; j >= 0; j--) {
        if (projects[j].title.toLowerCase() === p.title.toLowerCase() &&
            projects[j].description.slice(0, 50) === p.description.slice(0, 50)) {
          projects.splice(i, 1);
          break;
        }
      }
    }
  }

  const internContent = getSectionContent('internship');
  const internships: { company: string; position: string; description: string }[] = [];
  if (internContent.length > 0) {
    let currentIntern: { company: string; position: string; description: string } | null = null;

    for (const line of internContent) {
      const trimmed = line.trim();
      const internMatch = trimmed.match(/^(.+?)\s*(?:Intern|Internship)\s*(?:at|@|–|-|—|\||:)\s*(.+?)(?:\s*\(|$)/i);
      if (internMatch) {
        if (currentIntern) internships.push(currentIntern);
        let pos = internMatch[1].trim();
        if (!pos.toLowerCase().includes('intern')) pos += ' Intern';
        const company = internMatch[2].trim();
        currentIntern = { position: pos, company, description: '' };
        continue;
      }
      const companyMatch = trimmed.match(/^(?:Intern(?:ship)?\s*(?:at|@|–|-|—|:)?\s*)(.+?)(?:\s*\(|$)/i);
      if (companyMatch) {
        if (currentIntern) internships.push(currentIntern);
        currentIntern = { position: 'Intern', company: companyMatch[1].trim(), description: '' };
        continue;
      }
      const roleMatch = trimmed.match(/^(.+?)\s+(?:Intern|Internship)\b/i);
      if (roleMatch && (!currentIntern || !currentIntern.position.toLowerCase().includes('intern'))) {
        if (currentIntern) internships.push(currentIntern);
        currentIntern = { position: roleMatch[1].trim() + ' Intern', company: '', description: '' };
        continue;
      }
      if (/^[A-Z][A-Za-z\s]+$/.test(trimmed) && trimmed.length < 60 && !trimmed.startsWith('•') && !trimmed.startsWith('-')) {
        if (currentIntern && !currentIntern.company) {
          currentIntern.company = trimmed;
          continue;
        }
      }
      if (currentIntern) {
        const desc = trimmed.replace(/^[•\-·]\s*/, '');
        currentIntern.description += (currentIntern.description ? ' ' : '') + desc;
      }
    }
    if (currentIntern) internships.push(currentIntern);
    for (let i = internships.length - 1; i >= 0; i--) {
      if (!internships[i].company && !internships[i].description) internships.splice(i, 1);
    }
  }

  const expContent = getSectionContent('experience');
  const experience = expContent.length > 0 ? expContent.slice(0, 10).join(' ').substring(0, 500) : '';

  const certContent = getSectionContent('certification');
  const certifications = certContent.length > 0 ? certContent : [];

  const achievementContent = getSectionContent('achievement');
  const achievements = achievementContent.length > 0 ? achievementContent : [];

  const email = emailMatch ? emailMatch[0] : undefined;
  const phone = phoneMatch ? phoneMatch[0] : undefined;

  const wordCount = fullText.split(/\s+/).length;
  const hasLinkedIn = /linkedin/i.test(fullText);
  const hasGithub = /github/i.test(fullText);
  const hasDegree = /(bachelor|master|phd|b\.?tech|m\.?tech|b\.?e|m\.?e|b\.?sc|m\.?sc|b\.?a|m\.?a|diploma|bca|mca)/i.test(fullText);
  const hasProjectsSection = projects.length > 0;
  const hasInternships = internships.length > 0;

  let resumeScore = 0;
  if (email) resumeScore += 5;
  if (phone) resumeScore += 5;
  if (hasLinkedIn) resumeScore += 5;
  if (hasGithub) resumeScore += 3;
  if (education) resumeScore += 10;
  if (experience) resumeScore += 12;
  if (hasProjectsSection) resumeScore += 10;
  if (hasInternships) resumeScore += 8;
  if (certifications.length > 0) resumeScore += 5;
  if (achievements.length > 0) resumeScore += 5;
  if (allSkills.length >= 10) resumeScore += 8;
  else if (allSkills.length >= 5) resumeScore += 5;
  if (wordCount >= 300 && wordCount <= 900) resumeScore += 6;
  if (name) resumeScore += 5;
  resumeScore += allSkills.length;

  let atsScore = 0;
  if (email) atsScore += 6;
  if (phone) atsScore += 5;
  if (hasLinkedIn) atsScore += 5;
  if (education) atsScore += 12;
  if (allSkills.length >= 8) atsScore += 15;
  else if (allSkills.length >= 4) atsScore += 8;
  if (experience) atsScore += 12;
  if (hasProjectsSection) atsScore += 8;
  if (hasInternships) atsScore += 6;
  if (certifications.length > 0) atsScore += 5;
  if (wordCount >= 300 && wordCount <= 900) atsScore += 6;
  if (name) atsScore += 5;
  atsScore += Math.min(5, Math.floor(allSkills.length / 3));

  let careerReadiness = 0;
  if (hasDegree) careerReadiness += 12;
  if (experience) careerReadiness += 15;
  if (hasInternships) careerReadiness += 10;
  if (hasProjectsSection) careerReadiness += 10;
  if (allSkills.length >= 10) careerReadiness += 12;
  else if (allSkills.length >= 5) careerReadiness += 8;
  if (hasLinkedIn) careerReadiness += 5;
  if (hasGithub) careerReadiness += 5;
  if (certifications.length > 0) careerReadiness += 8;
  careerReadiness += Math.min(5, Math.floor(allSkills.length / 4));

  let employabilityScore = 0;
  if (hasDegree) employabilityScore += 10;
  if (experience) employabilityScore += 15;
  if (hasInternships) employabilityScore += 10;
  if (hasProjectsSection) employabilityScore += 10;
  if (allSkills.length >= 10) employabilityScore += 12;
  else if (allSkills.length >= 5) employabilityScore += 8;
  if (hasLinkedIn) employabilityScore += 5;
  if (hasGithub) employabilityScore += 3;
  if (certifications.length > 0) employabilityScore += 5;
  if (achievements.length > 0) employabilityScore += 5;
  employabilityScore += Math.min(5, Math.floor(allSkills.length / 3));

  resumeScore = Math.min(100, Math.max(10, resumeScore));
  atsScore = Math.min(100, Math.max(10, atsScore));
  careerReadiness = Math.min(100, Math.max(10, careerReadiness));
  employabilityScore = Math.min(100, Math.max(10, employabilityScore));

  const strengths: string[] = [];
  if (allSkills.length >= 8) strengths.push(`Strong technical skill set with ${allSkills.length} identified skills`);
  if (experience) strengths.push('Contains relevant work experience with detailed descriptions');
  if (hasProjectsSection) strengths.push(`Includes ${projects.length} project(s) demonstrating practical application`);
  if (hasInternships) strengths.push(`Has ${internships.length} internship(s) providing industry exposure`);
  if (education) strengths.push('Solid educational background with relevant degree');
  if (hasLinkedIn) strengths.push('Includes LinkedIn profile for professional networking');
  if (wordCount >= 250 && wordCount <= 1000) strengths.push(`Well-structured resume with appropriate length (${wordCount} words)`);
  if (certifications.length > 0) strengths.push('Has certifications that validate expertise');
  if (achievements.length > 0) strengths.push('Showcases achievements and accomplishments');

  const weaknesses: string[] = [];
  if (!achievements.length) weaknesses.push('No achievements section - highlight quantifiable accomplishments to stand out');
  if (!certifications.length) weaknesses.push('No certifications listed - consider adding relevant certifications to boost credibility');
  if (!hasLinkedIn) weaknesses.push('LinkedIn profile link not found');
  if (!hasGithub && allSkills.some(s => ['JavaScript', 'Python', 'Java', 'React', 'Node.js'].includes(s))) {
    weaknesses.push('GitHub profile not detected - important for technical roles');
  }
  if (allSkills.length < 5) weaknesses.push(`Limited skill set (${allSkills.length}) - consider expanding your technical skills`);
  if (hasInternships && !hasProjectsSection) weaknesses.push('Internship experience present but no project section - add projects to demonstrate initiative');
  if (wordCount < 200) weaknesses.push('Resume content is too brief - add more detail about your experience and skills');
  if (wordCount > 1000) weaknesses.push('Resume may be too long - aim for 400-800 words for optimal readability');

  return {
    skills: allSkills,
    education,
    certifications,
    projects,
    internships,
    experience,
    achievements,
    technologies: allSkills.filter(s => knownTechnicalSkills.has(s.toLowerCase()) || /^(JavaScript|TypeScript|Python|Java|React|Node|SQL|AWS|Docker|Git|MongoDB|CSS|HTML|Flask|Django|TensorFlow|PyTorch|Keras|OpenCV|REST|GraphQL|Angular|Vue|Linux|GitHub)/i.test(s)),
    name,
    email,
    phone,
    resumeScore,
    atsScore,
    careerReadiness,
    employabilityScore,
    strengths,
    weaknesses,
  };
}

function canUseOpenAI(): boolean {
  return !!(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'your-openai-api-key');
}

function extractJSON(text: string): any | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const match = cleaned.match(/[\[{][\s\S]*[\]}]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch { /* fall through */ }
    }
  }
  return null;
}

async function generateJSONWithAI(
  systemPrompt: string,
  userPrompt: string,
  temperature = 0.4,
  maxTokens = 3000
): Promise<any | null> {
  if (canUseGemini()) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        const model = genAI!.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { temperature } });
        const result = await model.generateContent(buildGeminiPrompt(systemPrompt, userPrompt));
        const parsed = extractJSON(result.response.text());
        if (parsed !== null) return parsed;
        console.error(`[Gemini] attempt ${attempt}: returned unparseable JSON`);
      } catch (error: any) {
        console.error(`[Gemini] attempt ${attempt} API ERROR:`, error.message);
      }
      if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 800));
    }
    console.error('[Gemini] failed after retries, trying OpenAI');
  }

  if (canUseOpenAI()) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      });
      return extractJSON(response.choices[0]?.message?.content || '');
    } catch (error: any) {
      console.error('OpenAI generation failed, using local fallback:', error.message);
    }
  }

  return null;
}

function determineCareerPaths(skills: string[]): { title: string; requiredSkills: string[]; score: number }[] {
  const careerPaths = [
    { title: 'Full Stack Developer', requiredSkills: ['JavaScript', 'React', 'Node.js', 'Python', 'SQL', 'TypeScript', 'HTML', 'CSS', 'Git', 'MongoDB'] },
    { title: 'Data Scientist', requiredSkills: ['Python', 'Machine Learning', 'Deep Learning', 'SQL', 'NLP', 'Data Analysis', 'Pandas', 'NumPy', 'Statistics'] },
    { title: 'DevOps Engineer', requiredSkills: ['AWS', 'Docker', 'Kubernetes', 'Jenkins', 'Linux', 'Terraform', 'Git', 'Python', 'CI/CD'] },
    { title: 'Frontend Developer', requiredSkills: ['JavaScript', 'React', 'TypeScript', 'HTML', 'CSS', 'Angular', 'Vue', 'Responsive Design'] },
    { title: 'Backend Developer', requiredSkills: ['Node.js', 'Python', 'Java', 'SQL', 'REST API', 'GraphQL', 'PostgreSQL', 'MongoDB', 'Microservices'] },
    { title: 'Mobile Developer', requiredSkills: ['Swift', 'Kotlin', 'React Native', 'Flutter', 'JavaScript', 'REST API', 'UI/UX'] },
    { title: 'Machine Learning Engineer', requiredSkills: ['Python', 'Machine Learning', 'Deep Learning', 'TensorFlow', 'PyTorch', 'NLP', 'Computer Vision', 'Data Science'] },
    { title: 'Cloud Architect', requiredSkills: ['AWS', 'Azure', 'GCP', 'Docker', 'Kubernetes', 'System Design', 'Terraform', 'Linux'] },
    { title: 'Cybersecurity Analyst', requiredSkills: ['Linux', 'Python', 'Network Security', 'Penetration Testing', 'Risk Assessment', 'Incident Response'] },
    { title: 'Product Manager', requiredSkills: ['Communication', 'Leadership', 'Agile', 'Scrum', 'Data Analysis', 'Problem Solving', 'Critical Thinking'] },
    { title: 'AI Engineer', requiredSkills: ['Python', 'Machine Learning', 'Deep Learning', 'NLP', 'Computer Vision', 'TensorFlow', 'PyTorch', 'REST API'] },
    { title: 'Data Engineer', requiredSkills: ['Python', 'SQL', 'AWS', 'MongoDB', 'ETL', 'Data Pipeline', 'Spark', 'Hadoop'] },
    { title: 'Game Developer', requiredSkills: ['C++', 'C#', 'Unity', 'Unreal Engine', 'Python', '3D Modeling', 'Game Design', 'Animation'] },
    { title: 'Embedded Systems Engineer', requiredSkills: ['C', 'C++', 'Python', 'Microcontrollers', 'RTOS', 'IoT', 'Arduino', 'Raspberry Pi', 'Circuit Design'] },
    { title: 'Blockchain Developer', requiredSkills: ['JavaScript', 'Solidity', 'Ethereum', 'Web3', 'Smart Contracts', 'React', 'Node.js', 'Cryptography'] },
    { title: 'QA / Test Engineer', requiredSkills: ['Python', 'JavaScript', 'Selenium', 'Test Automation', 'CI/CD', 'API Testing', 'Agile', 'SQL'] },
    { title: 'Technical Writer', requiredSkills: ['Documentation', 'API Documentation', 'Markdown', 'Git', 'Communication', 'HTML', 'Technical Communication'] },
    { title: 'Site Reliability Engineer', requiredSkills: ['Linux', 'AWS', 'Docker', 'Kubernetes', 'Python', 'Monitoring', 'Terraform', 'CI/CD'] },
    { title: 'Business Analyst', requiredSkills: ['SQL', 'Data Analysis', 'Excel', 'Communication', 'Problem Solving', 'Critical Thinking', 'Agile'] },
    { title: 'Database Administrator', requiredSkills: ['SQL', 'PostgreSQL', 'MySQL', 'MongoDB', 'Backup', 'Performance Tuning', 'Linux'] },
    { title: 'Network Engineer', requiredSkills: ['Linux', 'TCP/IP', 'Networking', 'CCNA', 'Security', 'Firewall', 'Cloud'] },
    { title: 'Research Scientist', requiredSkills: ['Python', 'Machine Learning', 'Research', 'Statistics', 'NLP', 'Computer Vision', 'Data Analysis'] },
    { title: 'UI/UX Designer', requiredSkills: ['Figma', 'Sketch', 'User Research', 'Wireframing', 'Prototyping', 'Design Systems', 'HTML', 'CSS'] },
    { title: 'Solutions Architect', requiredSkills: ['AWS', 'System Design', 'Microservices', 'REST API', 'Docker', 'Kubernetes', 'Node.js', 'Python'] },
    { title: 'Scrum Master', requiredSkills: ['Agile', 'Scrum', 'Leadership', 'Communication', 'Problem Solving', 'JIRA', 'Facilitation'] },
    { title: 'Data Analyst', requiredSkills: ['SQL', 'Python', 'Excel', 'Tableau', 'Power BI', 'Statistics', 'Data Visualization', 'Pandas'] },
    { title: 'Systems Administrator', requiredSkills: ['Linux', 'Windows Server', 'Networking', 'Security', 'AWS', 'Bash', 'Scripting'] },
    { title: 'BI Developer', requiredSkills: ['SQL', 'Power BI', 'Tableau', 'Data Warehousing', 'ETL', 'Python', 'Excel', 'DAX'] },
    { title: 'AR/VR Developer', requiredSkills: ['C#', 'Unity', 'Unreal Engine', '3D Math', 'ARKit', 'ARCore', 'Blender'] },
    { title: 'Robotics Engineer', requiredSkills: ['Python', 'C++', 'ROS', 'Computer Vision', 'Control Systems', 'Embedded', 'AWS'] },
    { title: 'Security Engineer', requiredSkills: ['Python', 'Linux', 'Network Security', 'Cryptography', 'Vulnerability Assessment', 'AWS', 'Docker'] },
    { title: 'Technical Project Manager', requiredSkills: ['Project Management', 'Agile', 'Scrum', 'Communication', 'Leadership', 'JIRA', 'Risk Management'] },
    { title: 'DevSecOps Engineer', requiredSkills: ['AWS', 'Docker', 'Kubernetes', 'Python', 'Security', 'Terraform', 'Jenkins', 'Linux'] },
  ];

  const lowerSkills = skills.map(s => s.toLowerCase());
  const scored = careerPaths.map(path => {
    const matchCount = path.requiredSkills.filter(rs => lowerSkills.some(us => us.includes(rs.toLowerCase()))).length;
    const score = Math.round((matchCount / path.requiredSkills.length) * 100);
    return { title: path.title, requiredSkills: path.requiredSkills, score };
  });

  const sorted = scored.sort((a, b) => b.score - a.score);
  const topTier = sorted.filter(p => p.score >= 60);
  const midTier = sorted.filter(p => p.score >= 30 && p.score < 60);
  const rest = sorted.filter(p => p.score < 30);

  function pickRandom(arr: any[], count: number) {
    const shuffled = [...arr].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, count);
  }

  const result = [
    ...pickRandom(topTier, Math.min(3, topTier.length)),
    ...pickRandom(midTier, Math.min(2, midTier.length)),
  ];

  if (result.length < 5) {
    result.push(...pickRandom(rest, 5 - result.length));
  }

  return result.slice(0, 5);
}

function dedupeSkillNames(skills: unknown): string[] {
  const result: string[] = [];
  for (const raw of Array.isArray(skills) ? skills : []) {
    const name = canonicalSkillName(raw);
    const key = skillKey(name);
    if (!name || key.length < 2) continue;
    if (result.some(existing => isDuplicateKey(skillKey(existing), key))) continue;
    result.push(name);
  }
  return result;
}

function roleRequiredSkills(careerTitle: string, fallbackSkills: unknown): string[] {
  const roleSkills = getRoleRequiredSkills(careerTitle);
  if (roleSkills.length > 0) return dedupeSkillNames(roleSkills);
  return dedupeSkillNames(fallbackSkills).slice(0, 12);
}

function normalizeRecommendations(list: unknown): any[] {
  if (!Array.isArray(list)) return [];
  const seen = new Set<string>();
  const normalized: any[] = [];
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const careerTitle = String((raw as any).careerTitle || (raw as any).title || '').trim();
    if (!careerTitle) continue;
    const titleKey = careerTitle.toLowerCase();
    if (seen.has(titleKey)) continue;
    seen.add(titleKey);
    const roleDetails = getRoleDetails(careerTitle);
    normalized.push({
      ...(raw as any),
      careerTitle: roleDetails?.title || careerTitle,
      description: (raw as any).description || roleDetails?.description || '',
      category: (raw as any).category || roleDetails?.category || '',
      salaryRange: (raw as any).salaryRange || roleDetails?.salaryRange || '',
      industryDemand: (raw as any).industryDemand || roleDetails?.demand || '',
      growthPotential: (raw as any).growthPotential || roleDetails?.growth || '',
      requiredSkills: roleRequiredSkills(careerTitle, (raw as any).requiredSkills),
      matchPercentage: Math.max(0, Math.min(100, Number((raw as any).matchPercentage) || 0)),
      confidenceScore: Math.max(0, Math.min(100, Number((raw as any).confidenceScore) || 0)),
    });
  }
  return normalized;
}

export async function generateCareerRecommendations(
  userProfile: any,
  userSkills: string[],
  userGoals: string,
  marketTrends: any[]
): Promise<any[]> {
  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are a career recommendation expert with access to market data.
Analyze the user's profile and generate career recommendations.
Return a JSON array of recommendation objects, each with:
- careerTitle (string)
- matchPercentage (0-100)
- confidenceScore (0-100)
- salaryInsights (object with entry, mid, senior ranges)
- industryDemand (string)
- growthPotential (string)
- requiredSkills (array of strings)
- reasons (array of strings explaining why recommended)
- influencingSkills (array of strings that influenced this)
- influencingGoals (array of strings that influenced this)
- isVerified (boolean - false initially)
- verificationSource (string)

If confidenceScore is below 60, isVerified must be false and verificationSource should explain uncertainty.
Return ONLY valid JSON array.`;

      const prompt = `User Profile:
- Skills: ${userSkills.join(', ')}
- Education: ${userProfile?.education || 'Not specified'}
- Experience: ${userProfile?.experience || 'Not specified'}
- Interests: ${userProfile?.interests || 'Not specified'}
- Career Goals: ${userGoals || 'Not specified'}

Market Trends: ${JSON.stringify(marketTrends.slice(0, 10))}

Generate 3-5 career recommendations with detailed analysis.`;

      const parsed = await generateJSONWithAI(systemPrompt, prompt, 0.4, 4000);
      if (parsed !== null) {
        const normalized = normalizeRecommendations(parsed);
        if (normalized.length > 0) return normalized;
      }
    } catch (error: any) {
      console.error('AI recommendation failed, using local fallback:', error.message);
    }
  }

  return recommendRoles(userSkills, userGoals, 5).map(rec => {
    const confidenceScore = rec.confidenceScore;
    return {
      careerTitle: rec.careerTitle,
      matchPercentage: rec.matchPercentage,
      confidenceScore,
      description: rec.description,
      category: rec.category,
      salaryRange: rec.salaryRange,
      salaryInsights: {
        entry: rec.salaryRange,
        mid: rec.salaryRange,
        senior: rec.salaryRange,
      },
      industryDemand: rec.industryDemand,
      growthPotential: rec.growthPotential,
      requiredSkills: dedupeSkillNames(rec.requiredSkills),
      reasons: rec.reasons,
      influencingSkills: rec.influencingSkills,
      influencingGoals: rec.influencingGoals,
      isVerified: confidenceScore >= 60,
      verificationSource: confidenceScore >= 60 ? 'Role catalogue + profile skill match' : 'Limited skill overlap - consider upskilling',
    };
  });
}

const resourcePool: string[] = [
  'YouTube tutorials (free)',
  'Official documentation',
  'Medium / Dev.to articles',
  'FreeCodeCamp / W3Schools',
  'Daily coding challenges (LeetCode)',
  'Online courses (Coursera/Udemy)',
  'Blog posts & case studies',
  'Community forums (Stack Overflow)',
  'Project-based learning',
  'Technical books & ebooks',
  'Conference talks (YouTube)',
  'Research papers & whitepapers',
  'Capstone projects',
  'GitHub project templates',
  'Documentation guides',
  'Stack Overflow / Q&A sites',
  'CodePen / Replit / CodeSandbox',
  'Open source contributions',
  'Personal portfolio website',
  'Official certification guides',
  'Practice exams & mock tests',
  'Study groups & peer learning',
  'Interviewing.io / Pramp',
  'System Design primer (GitHub)',
  'Behavioral question bank',
  'LinkedIn Jobs / Naukri',
  'Company career pages',
  'Referral networking',
  'Podcasts & tech talks',
  'Newsletters (TLDR, ByteByteGo)',
  'Roadmap.sh / Awesome Lists',
  'Interactive tutorials (Scrimba)',
];

function getUniqueResources(title: string, type: string, index: number, total: number): string[] {
  const offset = (index + type.length) % resourcePool.length;
  const indices: number[] = [];
  for (let i = 0; i < 3; i++) {
    indices.push((offset + i * 7 + i) % resourcePool.length);
  }
  return indices.map(i => resourcePool[i]);
}

function generateLegacyLocalRoadmap(careerGoal: string, skills: string[], domain?: string, months?: number): any {
  const lowerSkills = skills.map(s => s.toLowerCase());
  const hasTech = lowerSkills.some(s => ['javascript', 'python', 'java', 'react', 'node.js', 'typescript', 'c++', 'c#'].includes(s));
  const domainStr = (domain || careerGoal).toLowerCase();
  const totalMonths = months || 6;

  const isTechnical = hasTech || /developer|engineer|scientist|architect|analyst|programmer|devops/i.test(domainStr);

  const weeks = totalMonths * 4;
  const tasksPerMonth = Math.max(2, Math.ceil(15 / totalMonths));

  interface LocalTask { title: string; description: string; type: string; priority: string; order?: number; resources?: string[]; subtopics?: string[]; }

  const tasks: LocalTask[] = [];

  function getSubtopics(title: string, desc: string): string[] {
    const base = careerGoal.toLowerCase();
    if (title.includes('Introduction')) return [`Overview of ${domain || careerGoal}`, 'Industry trends & opportunities', 'Key concepts & terminology', 'Learning resources & tools', 'Setting up your environment'];
    if (title.includes('Foundation')) return isTechnical
      ? ['Variables & data types', 'Control flow & loops', 'Functions & modularity', 'Basic data structures', 'Debugging techniques']
      : ['Core principles', 'Industry best practices', 'Terminology & frameworks', 'Case studies', 'Entry-level certifications'];
    if (title.includes('Hands-on')) return isTechnical
      ? ['Build a small CLI app', 'Practice coding challenges', 'Implement basic algorithms', 'Version control with Git', 'Code review basics']
      : ['Real-world exercises', 'Tool familiarization', 'Process documentation', 'Basic project setup', 'Peer collaboration'];
    if (title.includes('Project')) return isTechnical
      ? ['Architecture planning', 'Implementation', 'Testing & debugging', 'Deployment', 'Documentation']
      : ['Project scoping', 'Execution plan', 'Stakeholder management', 'Deliverable tracking', 'Post-mortem review'];
    if (title.includes('Advanced')) return isTechnical
      ? ['Design patterns', 'Performance optimization', 'Security best practices', 'Scalability considerations', 'Industry case studies']
      : ['Strategic planning', 'Advanced methodologies', 'Risk management', 'Innovation frameworks', 'Industry 4.0 trends'];
    if (title.includes('Certification')) return ['Choose right certification', 'Study materials & guides', 'Practice exams', 'Exam strategies', 'Renewal & maintenance'];
    if (title.includes('Resume')) return ['ATS-friendly formatting', 'Quantifiable achievements', 'Skills section optimization', 'Portfolio creation', 'LinkedIn profile matching'];
    if (title.includes('Interview')) return ['Common questions', 'STAR method stories', 'Technical problem solving', 'Communication skills', 'Mock interview practice'];
    if (title.includes('Job Search')) return ['Target company research', 'Application tracking', 'Networking strategies', 'Cover letter templates', 'Referral approaches'];
    if (title.includes('Application Sprint')) return ['Bulk application tips', 'Follow-up strategies', 'Offer evaluation', 'Negotiation tactics', 'Decision framework'];
    if (title.includes('Networking')) return ['LinkedIn optimization', 'Industry events', 'Informational interviews', 'Online communities', 'Personal branding'];
    if (title.includes('Skill Assessment')) return ['Self-evaluation quizzes', 'Peer feedback', 'Progress tracking', 'Gap analysis', 'Goal adjustment'];
    return isTechnical
      ? [`${domain || careerGoal} fundamentals`, 'Practical exercises', 'Real-world applications', 'Common pitfalls', 'Next steps & resources']
      : [`${domain || careerGoal} basics`, 'Practical applications', 'Industry standards', 'Common challenges', 'Growth opportunities'];
  }

  for (let m = 1; m <= totalMonths; m++) {
    if (m === 1) {
      const t1 = { title: `Month ${m}: Introduction to ${careerGoal}`, description: `Research core concepts of ${careerGoal} in ${domain || careerGoal}. Study industry trends and requirements.`, type: 'DAILY', priority: 'HIGH' as const };
      tasks.push({ ...t1, subtopics: getSubtopics(t1.title, t1.description) });
      const t2 = { title: `Month ${m}: Foundation Skills`, description: `Strengthen your foundation in ${isTechnical ? 'programming fundamentals, data structures, and algorithms' : 'core domain concepts, industry terminology, and best practices'} for ${domain || careerGoal}.`, type: 'DAILY', priority: 'HIGH' as const };
      tasks.push({ ...t2, subtopics: getSubtopics(t2.title, t2.description) });
      if (tasksPerMonth > 2) { const t = { title: `Month ${m}: Hands-on Practice`, description: 'Start with practical exercises and small projects.', type: 'WEEKLY' as const, priority: 'HIGH' as const }; tasks.push({ ...t, subtopics: getSubtopics(t.title, t.description) }); }
      if (tasksPerMonth > 3) { const t = { title: `Month ${m}: Skill Assessment`, description: 'Evaluate your progress and identify weak areas.', type: 'WEEKLY' as const, priority: 'MEDIUM' as const }; tasks.push({ ...t, subtopics: getSubtopics(t.title, t.description) }); }
    } else if (m === Math.ceil(totalMonths / 2) && m > 1) {
      const t1 = { title: `Month ${m}: Intermediate Project`, description: `Build a mid-sized project demonstrating proficiency in ${domain || careerGoal}.`, type: 'PROJECT' as const, priority: 'HIGH' as const };
      tasks.push({ ...t1, subtopics: getSubtopics(t1.title, t1.description) });
      const t2 = { title: `Month ${m}: Advanced Topics`, description: `Explore advanced ${isTechnical ? 'architecture, optimization, and scaling' : 'strategic planning and advanced methodologies'} for ${domain || careerGoal}.`, type: 'WEEKLY' as const, priority: 'MEDIUM' as const };
      tasks.push({ ...t2, subtopics: getSubtopics(t2.title, t2.description) });
      if (tasksPerMonth > 2) { const t = { title: `Month ${m}: Networking & Community`, description: 'Join professional communities, attend meetups, connect with industry professionals.', type: 'WEEKLY' as const, priority: 'MEDIUM' as const }; tasks.push({ ...t, subtopics: getSubtopics(t.title, t.description) }); }
    } else if (m === totalMonths) {
      const t1 = { title: `Month ${m}: Capstone Project`, description: `Build a comprehensive ${domain || careerGoal} project showcasing all skills learned.`, type: 'PROJECT' as const, priority: 'CRITICAL' as const };
      tasks.push({ ...t1, subtopics: getSubtopics(t1.title, t1.description) });
      const t2 = { title: `Month ${m}: Resume & Portfolio`, description: 'Update your resume and create a compelling portfolio.', type: 'WEEKLY' as const, priority: 'HIGH' as const };
      tasks.push({ ...t2, subtopics: getSubtopics(t2.title, t2.description) });
      const t3 = { title: `Month ${m}: Interview Preparation`, description: 'Practice technical and behavioral interviews.', type: 'INTERVIEW' as const, priority: 'CRITICAL' as const };
      tasks.push({ ...t3, subtopics: getSubtopics(t3.title, t3.description) });
      const t4 = { title: `Month ${m}: Job Search Strategy`, description: 'Develop a targeted job search plan for your domain.', type: 'PLACEMENT' as const, priority: 'HIGH' as const };
      tasks.push({ ...t4, subtopics: getSubtopics(t4.title, t4.description) });
      const t5 = { title: `Month ${m}: Application Sprint & Offers`, description: 'Apply to positions, evaluate offers, and make decisions.', type: 'PLACEMENT' as const, priority: 'CRITICAL' as const };
      tasks.push({ ...t5, subtopics: getSubtopics(t5.title, t5.description) });
    } else {
      const t1 = { title: `Month ${m}: Core ${domain || careerGoal} Skills`, description: `Deep dive into ${isTechnical ? 'key technologies and frameworks' : 'essential domain-specific tools and methodologies'}.`, type: 'WEEKLY' as const, priority: 'HIGH' as const };
      tasks.push({ ...t1, subtopics: getSubtopics(t1.title, t1.description) });
      if (tasksPerMonth > 2) { const t = { title: `Month ${m}: Practical Exercises`, description: `Apply knowledge through hands-on exercises in ${domain || careerGoal}.`, type: 'WEEKLY' as const, priority: 'MEDIUM' as const }; tasks.push({ ...t, subtopics: getSubtopics(t.title, t.description) }); }
      if (tasksPerMonth > 3) { const t = { title: `Month ${m}: Certification Preparation`, description: 'Prepare for relevant industry certifications.', type: 'CERTIFICATION' as const, priority: 'HIGH' as const }; tasks.push({ ...t, subtopics: getSubtopics(t.title, t.description) }); }
    }
  }

  return {
    title: `Roadmap to ${careerGoal}`,
    description: `A ${totalMonths}-month learning and placement roadmap for ${careerGoal}${domain ? ` in ${domain}` : ''}. Includes skill development, projects, certifications, and job placement preparation.`,
    duration: `${totalMonths} months`,
    tasks: tasks.map((task, i) => ({
      title: task.title,
      description: task.description,
      type: task.type,
      priority: task.priority as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
      subtopics: task.subtopics,
      order: i + 1,
      resources: getUniqueResources(task.title, task.type, i, tasks.length),
    })),
  };
}

interface RoleProfile {
  keywords: RegExp;
  core: string[];
  advanced: string[];
  projects: { title: string; description: string; subtopics: string[] }[];
  certifications: string[];
  interview: string[];
}

const SKILL_SUBTOPICS: Record<string, string[]> = {
  'HTML & CSS': ['Semantic HTML', 'Flexbox & Grid', 'Responsive units & media queries', 'Forms & accessibility', 'CSS architecture'],
  'JavaScript': ['Variables, types & functions', 'Arrays & objects', 'DOM & events', 'Async/await & promises', 'Modules & error handling'],
  'TypeScript': ['Types & interfaces', 'Generics', 'Utility types', 'Type narrowing', 'Configuring tsconfig'],
  'React': ['Components & props', 'State & hooks', 'Effects & lifecycle', 'Context & state management', 'Routing & forms'],
  'Next.js': ['App router & layouts', 'Server vs client components', 'Data fetching & caching', 'API routes', 'Deployment'],
  'Responsive Design': ['Mobile-first layouts', 'Breakpoints & fluid grids', 'Images & media', 'Testing on devices', 'Accessibility'],
  'State Management': ['Local vs global state', 'Context API', 'Redux Toolkit / Zustand', 'Server state & caching', 'Avoiding prop drilling'],
  'Git & GitHub': ['Branching & merging', 'Pull requests & reviews', 'Rebasing & conflict resolution', 'Conventional commits', 'GitHub Actions basics'],
  'REST APIs': ['HTTP methods & status codes', 'Request/response design', 'Pagination & filtering', 'Error handling', 'Consuming APIs with fetch/axios'],
  'Testing': ['Unit vs integration tests', 'Test structure & assertions', 'Mocking dependencies', 'Coverage & CI', 'End-to-end basics'],
  'Performance Optimization': ['Profiling & measuring', 'Caching strategies', 'Code splitting & lazy loading', 'Bundle analysis', 'Core Web Vitals'],
  'Accessibility': ['ARIA roles & labels', 'Keyboard navigation', 'Color contrast & focus', 'Screen reader testing', 'Semantic HTML'],
  'Node.js': ['Event loop & async I/O', 'Modules & npm', 'File system & streams', 'Environment config', 'Error handling'],
  'Express': ['Routing & middleware', 'Request validation', 'Error middleware', 'Auth middleware', 'Project structure'],
  'SQL': ['SELECT, JOIN & GROUP BY', 'Subqueries & CTEs', 'Window functions', 'Indexes & query plans', 'Schema design'],
  'PostgreSQL': ['Data types & constraints', 'Transactions & isolation', 'Indexes & performance', 'JSONB & full-text search', 'Backups & migrations'],
  'MongoDB': ['Documents & collections', 'CRUD & queries', 'Aggregation pipeline', 'Indexes', 'Schema design patterns'],
  'Authentication & Security': ['Password hashing', 'JWT & sessions', 'OAuth basics', 'Input validation & rate limiting', 'OWASP top risks'],
  'System Design': ['Requirements & trade-offs', 'Load balancing & caching', 'Database scaling', 'Queues & async processing', 'Reliability & monitoring'],
  'Docker': ['Images & containers', 'Dockerfiles & layers', 'Volumes & networks', 'Docker Compose', 'Multi-stage builds'],
  'Kubernetes': ['Pods, deployments & services', 'ConfigMaps & secrets', 'Ingress & networking', 'Scaling & probes', 'Helm basics'],
  'CI/CD': ['Pipeline stages', 'Automated tests & linting', 'Build & artifacts', 'Deployments & rollbacks', 'GitHub Actions / Jenkins'],
  'Cloud (AWS)': ['Core services (EC2, S3, RDS)', 'IAM & networking', 'Serverless (Lambda)', 'Monitoring & cost', 'Well-Architected basics'],
  'Redis & Caching': ['Cache patterns', 'TTL & eviction', 'Data structures', 'Pub/sub', 'Cache invalidation'],
  'Message Queues': ['Producer/consumer model', 'Delivery guarantees', 'Retries & dead letters', 'Kafka vs RabbitMQ', 'Ordering & partitioning'],
  'Linux & Networking': ['Shell & permissions', 'Processes & systemd', 'DNS, HTTP & TLS', 'Firewalls & ports', 'Troubleshooting tools'],
  'Python': ['Syntax & data types', 'Functions & modules', 'OOP', 'File & API handling', 'Virtual envs & testing'],
  'Pandas & NumPy': ['DataFrames & Series', 'Cleaning & missing data', 'Grouping & joins', 'Vectorized operations', 'Time series basics'],
  'Statistics': ['Descriptive statistics', 'Probability & distributions', 'Hypothesis testing', 'Regression basics', 'Interpreting p-values'],
  'Data Visualization': ['Chart selection', 'Matplotlib/Seaborn', 'Interactive dashboards', 'Design principles', 'Storytelling with data'],
  'Data Cleaning': ['Missing values', 'Outliers & duplicates', 'Type conversion', 'Feature scaling', 'Data validation'],
  'Machine Learning': ['Supervised vs unsupervised', 'Train/test splits & CV', 'Regression & classification', 'Evaluation metrics', 'Avoiding overfitting'],
  'Feature Engineering': ['Encoding categoricals', 'Scaling & normalization', 'Feature selection', 'Leakage prevention', 'Domain features'],
  'Deep Learning': ['Neural network basics', 'Activations & loss', 'Optimizers & regularization', 'CNNs & RNNs', 'Transfer learning'],
  'PyTorch/TensorFlow': ['Tensors & autograd', 'Model definition', 'Training loops', 'Datasets & dataloaders', 'Saving & serving models'],
  'Model Deployment': ['Serving via API', 'Batching & latency', 'Model versioning', 'Monitoring drift', 'Containerized deployment'],
  'MLOps': ['Experiment tracking', 'CI/CD for models', 'Feature stores', 'Model registry', 'Monitoring & retraining'],
  'Excel': ['Formulas & lookups', 'Pivot tables', 'Data cleaning', 'Charts & dashboards', 'What-if analysis'],
  'Power BI / Tableau': ['Data connections', 'Data modeling', 'Calculated fields', 'Interactive dashboards', 'Publishing & sharing'],
  'A/B Testing': ['Hypothesis & metrics', 'Sample size & power', 'Randomization', 'Significance & pitfalls', 'Reporting results'],
  'Data Storytelling': ['Audience & narrative', 'Choosing metrics', 'Visual hierarchy', 'Executive summaries', 'Stakeholder presentation'],
  'Big Data (Spark)': ['RDDs & DataFrames', 'Transformations & actions', 'Partitioning', 'Joins & shuffles', 'Performance tuning'],
  'Terraform': ['Providers & resources', 'State & workspaces', 'Modules', 'Variables & outputs', 'Plan/apply workflow'],
  'Monitoring': ['Metrics & logs', 'Dashboards & alerts', 'SLOs & error budgets', 'Tracing', 'Incident response'],
  'Web Security': ['OWASP top 10', 'XSS & CSRF', 'SQL injection', 'Auth & session flaws', 'Secure headers'],
  'Cryptography': ['Hashing vs encryption', 'Symmetric & asymmetric', 'TLS & certificates', 'Key management', 'Common pitfalls'],
  'Penetration Testing': ['Reconnaissance', 'Scanning & enumeration', 'Exploitation basics', 'Privilege escalation', 'Reporting'],
  'SIEM': ['Log ingestion', 'Correlation rules', 'Alert triage', 'Incident timelines', 'Threat hunting'],
  'Secure Coding': ['Input validation', 'Secrets management', 'Dependency scanning', 'Least privilege', 'Secure design reviews'],
  'React Native': ['Components & styling', 'Navigation', 'State & storage', 'Native modules', 'Build & release'],
  'Flutter': ['Widgets & layout', 'State management', 'Navigation', 'Networking & storage', 'Build & release'],
  'Mobile UI/UX': ['Mobile patterns', 'Touch targets', 'Responsive layouts', 'Offline states', 'Platform guidelines'],
  'App Store Deployment': ['Signing & certificates', 'Build variants', 'Store listings', 'Review guidelines', 'Release monitoring'],
  'User Research': ['Interview guides', 'Usability sessions', 'Surveys', 'Personas & journeys', 'Synthesizing insights'],
  'Figma': ['Frames & components', 'Auto layout', 'Variants & properties', 'Prototyping', 'Design handoff'],
  'Wireframing & Prototyping': ['Low-fidelity wireframes', 'User flows', 'Interactive prototypes', 'Feedback loops', 'Iteration'],
  'Usability Testing': ['Test plans & tasks', 'Moderated vs unmoderated', 'Observation & notes', 'Severity ranking', 'Reporting'],
  'Design Systems': ['Tokens & foundations', 'Component libraries', 'Documentation', 'Governance', 'Adoption'],
  'Product Strategy': ['Vision & positioning', 'Market & competitors', 'Prioritization frameworks', 'OKRs', 'Roadmap alignment'],
  'Roadmapping': ['Now/next/later planning', 'Milestones & dependencies', 'Stakeholder alignment', 'Scope trade-offs', 'Communication'],
  'Agile/Scrum': ['Roles & ceremonies', 'Backlog refinement', 'Sprint planning', 'Estimation', 'Retrospectives'],
  'Product Analytics': ['Event tracking', 'Funnels & retention', 'Cohorts', 'Experimentation', 'North-star metrics'],
  'Manual Testing': ['Test cases & plans', 'Boundary & equivalence', 'Regression testing', 'Bug reporting', 'Exploratory testing'],
  'Test Automation (Playwright)': ['Selectors & actions', 'Assertions', 'Page objects', 'Fixtures & parallel runs', 'CI integration'],
  'API Testing': ['Status & schema checks', 'Auth flows', 'Contract testing', 'Postman/Newman', 'Mocking services'],
  'Blockchain Fundamentals': ['Consensus & blocks', 'Wallets & keys', 'Transactions & gas', 'L2 & scaling', 'Security risks'],
  'Solidity': ['Contracts & state', 'Functions & modifiers', 'Events & errors', 'Inheritance & libraries', 'Gas optimization'],
  'Ethereum & Web3': ['Accounts & networks', 'Smart contract calls', 'ethers.js/web3.js', 'ERC standards', 'IPFS & oracles'],
  'Smart Contract Security': ['Reentrancy', 'Access control', 'Integer issues', 'Audit checklist', 'Testing & fuzzing'],
  'dApp Development': ['Contract integration', 'Wallet connection', 'Frontend state', 'Indexing events', 'Deployment'],
  'Math for ML': ['Linear algebra', 'Calculus & gradients', 'Probability', 'Optimization', 'Numerical stability'],
  'LLMs & Prompt Engineering': ['Transformer basics', 'Prompt patterns', 'RAG & embeddings', 'Evaluation', 'Safety & cost'],
  'Data Pipelines': ['ETL vs ELT', 'Orchestration (Airflow)', 'Idempotency', 'Data quality checks', 'Warehouse loading'],
  'Dashboard Design': ['Metric selection', 'Layout & hierarchy', 'Filters & drilldowns', 'Performance', 'Accessibility'],
  'Interaction Design': ['Micro-interactions', 'Motion & feedback', 'States & edge cases', 'Prototyping', 'Usability'],
  'Design Portfolio': ['Case study structure', 'Problem & process', 'Visual presentation', 'Storytelling', 'Feedback & iteration'],
  'Stakeholder Management': ['Expectation setting', 'Communication plans', 'Trade-off negotiation', 'Status reporting', 'Conflict resolution'],
  'Incident Response': ['Detection & triage', 'Containment', 'Forensics', 'Communication', 'Post-incident review'],
  'Threat Modeling': ['Assets & trust boundaries', 'STRIDE', 'Attack surfaces', 'Mitigations', 'Review cadence'],
};

const ROLE_PROFILES: RoleProfile[] = [
  {
    keywords: /front.?end|react|angular|vue|web developer|ui developer|javascript developer/i,
    core: ['HTML & CSS', 'JavaScript', 'TypeScript', 'React', 'Responsive Design', 'Git & GitHub', 'REST APIs', 'State Management'],
    advanced: ['Next.js', 'Testing', 'Performance Optimization', 'Accessibility', 'CI/CD'],
    projects: [
      { title: 'Interactive Dashboard', description: 'Build a responsive dashboard that fetches data from a public API with filtering, charts, and loading/error states.', subtopics: ['Component planning', 'API integration', 'State & filters', 'Responsive layout', 'Deploy to Vercel'] },
      { title: 'Full-Featured Web Application', description: 'Build a complete React app (e.g., e-commerce or task manager) with auth, CRUD, routing, and tests.', subtopics: ['App architecture', 'Auth flow', 'CRUD screens', 'Automated tests', 'Performance review'] },
    ],
    certifications: ['Meta Front-End Developer Certificate'],
    interview: ['JavaScript fundamentals', 'React hooks & rendering', 'CSS layout & responsiveness', 'Browser APIs & debugging'],
  },
  {
    keywords: /back.?end|node|java developer|python developer|api developer|server.?side/i,
    core: ['JavaScript', 'TypeScript', 'Node.js', 'Express', 'SQL', 'PostgreSQL', 'REST APIs', 'Authentication & Security', 'Git & GitHub'],
    advanced: ['System Design', 'Docker', 'Redis & Caching', 'Message Queues', 'Testing', 'CI/CD'],
    projects: [
      { title: 'Production-Ready REST API', description: 'Build an authenticated REST API with validation, pagination, error handling, and tests.', subtopics: ['API design', 'Auth & roles', 'Validation', 'Database schema', 'Integration tests'] },
      { title: 'Scalable Backend Service', description: 'Build a service with caching, background jobs, Docker deployment, and monitoring.', subtopics: ['Service architecture', 'Caching layer', 'Queue workers', 'Docker Compose', 'Load testing'] },
    ],
    certifications: ['AWS Certified Developer – Associate'],
    interview: ['Data structures & algorithms', 'API design', 'Database design & SQL', 'System design', 'Concurrency & reliability'],
  },
  {
    keywords: /full.?stack|mern|mean|web developer/i,
    core: ['HTML & CSS', 'JavaScript', 'TypeScript', 'React', 'Node.js', 'Express', 'SQL', 'MongoDB', 'REST APIs', 'Git & GitHub'],
    advanced: ['Next.js', 'Authentication & Security', 'System Design', 'Docker', 'Testing', 'CI/CD'],
    projects: [
      { title: 'Full-Stack CRUD Application', description: 'Build a end-to-end app with a React frontend, Node API, database, and authentication.', subtopics: ['Frontend routes', 'API integration', 'Database models', 'Auth & sessions', 'Deployment'] },
      { title: 'Production Full-Stack Capstone', description: 'Build and deploy a complete product with payments or real-time features, tests, and CI/CD.', subtopics: ['Feature planning', 'Backend services', 'Frontend polish', 'Testing & CI', 'Monitoring'] },
    ],
    certifications: ['Meta Full-Stack Developer Certificate'],
    interview: ['JavaScript & TypeScript', 'React & frontend architecture', 'API & database design', 'System design basics'],
  },
  {
    keywords: /data scientist|machine learning scientist|ml scientist/i,
    core: ['Python', 'Pandas & NumPy', 'Statistics', 'SQL', 'Data Visualization', 'Data Cleaning', 'Machine Learning'],
    advanced: ['Feature Engineering', 'Deep Learning', 'Model Deployment', 'MLOps', 'A/B Testing'],
    projects: [
      { title: 'Exploratory Data Analysis & Prediction', description: 'Analyze a real dataset, engineer features, and train a model with proper validation.', subtopics: ['Data cleaning', 'EDA & insights', 'Feature engineering', 'Model comparison', 'Reporting'] },
      { title: 'End-to-End Deployed ML Project', description: 'Build and deploy a model as an API with monitoring and a simple frontend demo.', subtopics: ['Problem framing', 'Model training', 'API serving', 'Monitoring', 'Write-up'] },
    ],
    certifications: ['Google Advanced Data Analytics Certificate'],
    interview: ['Statistics & probability', 'ML algorithms & metrics', 'SQL for analysis', 'Case study walkthroughs'],
  },
  {
    keywords: /data analyst|business analyst|analytics|bi analyst/i,
    core: ['Excel', 'SQL', 'Python', 'Pandas & NumPy', 'Statistics', 'Data Cleaning', 'Data Visualization', 'Power BI / Tableau'],
    advanced: ['A/B Testing', 'Data Storytelling', 'Big Data (Spark)', 'Dashboard Design'],
    projects: [
      { title: 'Business Sales Dashboard', description: 'Clean a sales dataset and build an interactive Power BI/Tableau dashboard with insights.', subtopics: ['Data cleaning', 'SQL analysis', 'Dashboard layout', 'KPI design', 'Executive summary'] },
      { title: 'A/B Test Analysis Capstone', description: 'Design and analyze an A/B test, then present a recommendation with statistical evidence.', subtopics: ['Hypothesis & metrics', 'Sample size', 'Statistical test', 'Interpretation', 'Stakeholder presentation'] },
    ],
    certifications: ['Google Data Analytics Certificate'],
    interview: ['SQL joins & window functions', 'Statistics for analysts', 'Visualization choices', 'Business case studies'],
  },
  {
    keywords: /ml engineer|ai engineer|machine learning engineer|deep learning engineer/i,
    core: ['Python', 'Math for ML', 'Machine Learning', 'Deep Learning', 'PyTorch/TensorFlow', 'Data Pipelines', 'SQL'],
    advanced: ['LLMs & Prompt Engineering', 'MLOps', 'Model Deployment', 'Feature Engineering', 'Big Data (Spark)'],
    projects: [
      { title: 'Model Training & Evaluation', description: 'Train a deep learning model on a real dataset with experiment tracking and evaluation.', subtopics: ['Data pipeline', 'Model architecture', 'Training loop', 'Metrics', 'Error analysis'] },
      { title: 'Deployed ML/LLM Application', description: 'Deploy a model or LLM-powered app with monitoring, evaluation, and cost controls.', subtopics: ['Serving API', 'Prompt/RAG design', 'Evaluation', 'Monitoring', 'Cost & latency'] },
    ],
    certifications: ['TensorFlow Developer Certificate'],
    interview: ['ML theory & metrics', 'Model evaluation', 'ML system design', 'Python coding'],
  },
  {
    keywords: /devops|sre|site reliability|platform engineer|infrastructure/i,
    core: ['Linux & Networking', 'Git & GitHub', 'Docker', 'CI/CD', 'Cloud (AWS)', 'Terraform', 'Kubernetes', 'Monitoring'],
    advanced: ['System Design', 'Redis & Caching', 'Authentication & Security', 'Performance Optimization'],
    projects: [
      { title: 'CI/CD Pipeline', description: 'Create a pipeline that tests, builds, and deploys a containerized app with rollbacks.', subtopics: ['Pipeline stages', 'Container build', 'Automated tests', 'Deploy & rollback', 'Secrets management'] },
      { title: 'Kubernetes Deployment Capstone', description: 'Deploy a multi-service app on Kubernetes with ingress, autoscaling, and monitoring.', subtopics: ['Manifests', 'Ingress & TLS', 'Autoscaling', 'Observability', 'Runbook'] },
    ],
    certifications: ['AWS Certified DevOps Engineer'],
    interview: ['Linux troubleshooting', 'CI/CD design', 'Kubernetes', 'Cloud architecture'],
  },
  {
    keywords: /cloud|aws|azure|gcp|solutions architect/i,
    core: ['Linux & Networking', 'Cloud (AWS)', 'Authentication & Security', 'Docker', 'Terraform', 'Monitoring'],
    advanced: ['Kubernetes', 'System Design', 'Performance Optimization', 'CI/CD'],
    projects: [
      { title: 'Multi-Tier Cloud Deployment', description: 'Deploy a multi-tier app on AWS with networking, IAM, and managed databases.', subtopics: ['VPC & subnets', 'Compute & storage', 'IAM roles', 'Managed DB', 'Cost review'] },
      { title: 'Infrastructure-as-Code Capstone', description: 'Provision a complete environment with Terraform, CI/CD, and monitoring.', subtopics: ['Terraform modules', 'State management', 'CI/CD', 'Observability', 'Security review'] },
    ],
    certifications: ['AWS Solutions Architect – Associate'],
    interview: ['AWS core services', 'Networking & IAM', 'Architecture trade-offs', 'Cost & reliability'],
  },
  {
    keywords: /security|cyber|penetration|soc analyst|ethical hack/i,
    core: ['Linux & Networking', 'Web Security', 'Cryptography', 'Secure Coding', 'SIEM', 'Penetration Testing'],
    advanced: ['Incident Response', 'Threat Modeling', 'Cloud (AWS)'],
    projects: [
      { title: 'Vulnerable App Security Assessment', description: 'Assess a deliberately vulnerable app and write a professional findings report.', subtopics: ['Reconnaissance', 'Exploitation', 'Risk rating', 'Remediation', 'Report writing'] },
      { title: 'Security Monitoring Capstone', description: 'Build a SIEM dashboard and simulate detection and incident response.', subtopics: ['Log ingestion', 'Detection rules', 'Alert triage', 'Incident timeline', 'Post-incident review'] },
    ],
    certifications: ['CompTIA Security+'],
    interview: ['Networking & OS fundamentals', 'OWASP top 10', 'Incident response', 'Security tooling'],
  },
  {
    keywords: /mobile|android|ios|flutter|react native/i,
    core: ['Flutter', 'React Native', 'Mobile UI/UX', 'REST APIs', 'State Management', 'Testing'],
    advanced: ['Performance Optimization', 'App Store Deployment', 'CI/CD'],
    projects: [
      { title: 'Cross-Platform Mobile App', description: 'Build a mobile app with navigation, API data, offline storage, and polished UI.', subtopics: ['UI screens', 'Navigation', 'API integration', 'Local storage', 'Device testing'] },
      { title: 'Published Mobile Capstone', description: 'Build, test, and publish a complete app to a store with analytics.', subtopics: ['Feature scope', 'State management', 'Automated tests', 'Store listing', 'Release & monitoring'] },
    ],
    certifications: ['Google Associate Android Developer'],
    interview: ['Mobile lifecycle', 'State management', 'UI & performance', 'Platform guidelines'],
  },
  {
    keywords: /product manager|product owner|product lead/i,
    core: ['User Research', 'Product Strategy', 'Roadmapping', 'Agile/Scrum', 'Product Analytics', 'Wireframing & Prototyping', 'SQL'],
    advanced: ['A/B Testing', 'Data Storytelling', 'Stakeholder Management'],
    projects: [
      { title: 'Product Discovery & PRD', description: 'Research a problem, define a product, and write a PRD with success metrics.', subtopics: ['User interviews', 'Problem statement', 'PRD writing', 'Success metrics', 'Prioritization'] },
      { title: 'Product Launch Capstone', description: 'Take a product idea through roadmap, prototype, metrics plan, and launch pitch.', subtopics: ['Roadmap', 'Prototype', 'Experiment plan', 'Launch plan', 'Stakeholder pitch'] },
    ],
    certifications: ['Certified Scrum Product Owner (CSPO)'],
    interview: ['Product sense', 'Metrics & analytics', 'Prioritization', 'Execution & stakeholder cases'],
  },
  {
    keywords: /ui\/ux|ux designer|product designer|ui designer|interaction designer/i,
    core: ['User Research', 'Figma', 'Wireframing & Prototyping', 'Usability Testing', 'Design Systems', 'Accessibility'],
    advanced: ['Interaction Design', 'Design Portfolio', 'Product Strategy'],
    projects: [
      { title: 'End-to-End UX Case Study', description: 'Research, wireframe, prototype, and usability-test a product flow.', subtopics: ['Research plan', 'Wireframes', 'Interactive prototype', 'Usability test', 'Case study'] },
      { title: 'Design System & Portfolio Capstone', description: 'Create a reusable design system and package your work into a portfolio.', subtopics: ['Tokens & components', 'Documentation', 'Prototype', 'Portfolio case studies', 'Presentation'] },
    ],
    certifications: ['Google UX Design Certificate'],
    interview: ['Portfolio walkthrough', 'Design process', 'Usability & accessibility', 'Collaboration cases'],
  },
  {
    keywords: /qa|quality assurance|test engineer|automation tester|sdet/i,
    core: ['Manual Testing', 'Test Automation (Playwright)', 'API Testing', 'SQL', 'Git & GitHub', 'CI/CD'],
    advanced: ['Performance Optimization', 'Web Security', 'Docker'],
    projects: [
      { title: 'Test Automation Suite', description: 'Automate an end-to-end flow for a web app with reliable selectors and reporting.', subtopics: ['Test plan', 'Page objects', 'Assertions', 'Parallel runs', 'CI integration'] },
      { title: 'Full QA Capstone', description: 'Create a complete test strategy for an app including API, UI, and regression suites.', subtopics: ['Test strategy', 'API tests', 'UI automation', 'Regression suite', 'Quality report'] },
    ],
    certifications: ['ISTQB Certified Tester'],
    interview: ['Testing fundamentals', 'Automation frameworks', 'API testing', 'Bug reporting & triage'],
  },
  {
    keywords: /blockchain|web3|solidity|smart contract/i,
    core: ['Blockchain Fundamentals', 'Solidity', 'Ethereum & Web3', 'Smart Contract Security', 'JavaScript'],
    advanced: ['dApp Development', 'Testing', 'System Design'],
    projects: [
      { title: 'Smart Contract dApp', description: 'Build a dApp with a Solidity contract, wallet connection, and tests.', subtopics: ['Contract design', 'Solidity implementation', 'Wallet integration', 'Contract tests', 'Testnet deploy'] },
      { title: 'Secure dApp Capstone', description: 'Build and audit a production-style dApp with upgradeability and security checks.', subtopics: ['Architecture', 'Access control', 'Security review', 'Gas optimization', 'Mainnet checklist'] },
    ],
    certifications: ['Certified Blockchain Developer'],
    interview: ['Blockchain fundamentals', 'Solidity & EVM', 'Security pitfalls', 'dApp architecture'],
  },
];

function getRoleProfile(roleText: string): RoleProfile {
  const lower = roleText.toLowerCase();
  const match = ROLE_PROFILES.find(p => p.keywords.test(lower));
  if (match) return match;

  const role = roleText.trim() || 'your target role';
  return {
    keywords: /$^/,
    core: [`${role}: core concepts`, `${role}: tools & workflows`, `${role}: industry standards`, 'Communication & collaboration'],
    advanced: [`Advanced ${role} practices`, `${role}: measurement & analysis`, `${role}: real-world case studies`],
    projects: [
      { title: `Intermediate ${role} Project`, description: `Build a realistic ${role} deliverable that demonstrates your core skills.`, subtopics: ['Scope the problem', 'Choose the right tools', 'Build the deliverable', 'Test & review', 'Present the outcome'] },
      { title: `${role} Capstone Project`, description: `Create a portfolio-ready ${role} project covering the full workflow.`, subtopics: ['Plan the project', 'Execute the workflow', 'Quality checks', 'Documentation', 'Portfolio write-up'] },
    ],
    certifications: [`Relevant ${role} certification`],
    interview: [`${role}: domain questions`, 'Behavioral interview (STAR)', `${role}: practical / case round`],
  };
}

export function getRoleSkillSet(roleText: string): { core: string[]; advanced: string[] } {
  const catalog = getCatalogRoleSkillSet(roleText);
  return { core: catalog.core, advanced: catalog.advanced };
}

function skillSubtopics(topic: string, role: string): string[] {
  return SKILL_SUBTOPICS[topic] || [
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

function generateLocalRoadmap(careerGoal: string, skills: string[], domain?: string, months?: number): any {
  const role = (careerGoal || domain || 'your target role').trim();
  const profile = getRoleProfile(`${careerGoal} ${domain || ''}`);
  const totalMonths = Math.min(36, Math.max(1, Math.floor(months || 6)));
  const targetTasks = Math.min(25, Math.max(15, totalMonths * 3));
  const userSkills = skills.map(s => s.toLowerCase());

  const isKnown = (topic: string) => {
    const t = topic.toLowerCase();
    return userSkills.some(s => s.length >= 3 && (t.includes(s) || s.includes(t)));
  };

  const learningPool = [...profile.core, ...profile.advanced].filter((t, i, arr) => arr.indexOf(t) === i);
  const learningCount = Math.max(6, targetTasks - 6);
  let topics = learningPool.filter(t => !isKnown(t));
  if (topics.length < 3) topics = learningPool.slice();

  const fillers = [...profile.certifications, ...profile.interview, `Advanced ${role} patterns`, `${role}: portfolio polishing`];
  for (const filler of fillers) {
    if (topics.length >= learningCount) break;
    if (!topics.some(t => t.toLowerCase() === filler.toLowerCase())) topics.push(filler);
  }
  while (topics.length < learningCount) {
    topics.push(`${role}: advanced topic ${topics.length + 1}`);
  }
  topics = topics.slice(0, learningCount);

  interface Spec { title: string; description: string; type: string; priority: string; subtopics: string[]; resources: string[]; }
  const specs: Spec[] = [];

  specs.push({
    title: `Orientation & Environment Setup for ${role}`,
    description: `Understand what a ${role} does day to day, install the standard tools, and set up your learning plan.`,
    type: 'DAILY',
    priority: 'HIGH',
    subtopics: [`What a ${role} does day to day`, 'Core tools and software to install', 'Set up Git and GitHub', 'Define your weekly learning schedule', `Collect 3-5 ${role} job descriptions to target`],
    resources: resourcesFor(`${role} career overview`),
  });

  const miniProjectIndex = Math.floor(topics.length / 2);
  topics.forEach((topic, i) => {
    specs.push({
      title: `Learn ${topic}`,
      description: `Build working knowledge of ${topic} and apply it to realistic ${role} tasks.`,
      type: i < 2 ? 'DAILY' : 'WEEKLY',
      priority: i < 3 ? 'HIGH' : 'MEDIUM',
      subtopics: skillSubtopics(topic, role),
      resources: resourcesFor(topic),
    });
    if (i === miniProjectIndex) {
      const project = profile.projects[0];
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

  const capstone = profile.projects[profile.projects.length - 1];
  specs.push({
    title: `Capstone Project: ${capstone.title}`,
    description: capstone.description,
    type: 'PROJECT',
    priority: 'CRITICAL',
    subtopics: capstone.subtopics,
    resources: resourcesFor(capstone.title),
  });
  specs.push({
    title: 'Portfolio, Resume & LinkedIn',
    description: `Package your projects into a ${role} portfolio and tailor your resume and LinkedIn to the role.`,
    type: 'WEEKLY',
    priority: 'HIGH',
    subtopics: ['Write case studies for your projects', 'Tailor resume bullets to the role', 'Optimize LinkedIn headline & skills', 'Publish a portfolio site', 'Get feedback from peers or mentors'],
    resources: ['Resume & LinkedIn optimization guides', 'Portfolio website examples', 'STAR bullet writing guide'],
  });
  specs.push({
    title: 'Interview Preparation',
    description: `Prepare for ${role} interviews with role-specific practice and mock interviews.`,
    type: 'INTERVIEW',
    priority: 'CRITICAL',
    subtopics: profile.interview,
    resources: ['Role-specific interview question banks', 'Mock interviews (Pramp / peers)', 'STAR method guide'],
  });
  specs.push({
    title: 'Job Search & Applications',
    description: `Run a targeted job search for ${role} roles and manage applications and offers.`,
    type: 'PLACEMENT',
    priority: 'HIGH',
    subtopics: ['Build a target company list', 'Track applications in a spreadsheet', 'Request referrals and network', 'Prepare for salary negotiation', 'Evaluate and compare offers'],
    resources: ['LinkedIn / Naukri job search', 'Company career pages', 'Salary negotiation guides'],
  });

  const tasks = specs.map((task, i) => {
    const month = Math.min(totalMonths, Math.floor((i * totalMonths) / specs.length) + 1);
    return {
      title: `Month ${month}: ${task.title}`,
      description: task.description,
      type: task.type,
      priority: task.priority,
      subtopics: task.subtopics,
      order: i + 1,
      resources: task.resources,
    };
  });

  return {
    title: `${totalMonths}-Month Roadmap to Become a ${role}`,
    description: `A ${totalMonths}-month, role-specific plan for ${role} covering ${profile.core.slice(0, 3).join(', ')}, hands-on projects, interview prep, and job search.`,
    duration: `${totalMonths} months`,
    tasks,
  };
}

export async function generateRoadmap(
  careerGoal: string,
  skills: string[],
  preferences: {
    learningSpeed?: string;
    availableTime?: string;
    salaryGoal?: string;
    preferredCompany?: string;
    domain?: string;
    months?: number;
  }
): Promise<any> {
  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are a senior career mentor and curriculum designer. Build a practical, role-specific learning roadmap for the target role.
Return a JSON object with:
- title (string, e.g. "12-Week Roadmap to Become a Data Analyst")
- description (string, 1-2 sentences tailored to the role and the candidate's current skills)
- duration (string)
- tasks (array of 15-25 objects: title, description, type [DAILY/WEEKLY/MONTHLY/PROJECT/CERTIFICATION/PLACEMENT/INTERVIEW], priority [LOW/MEDIUM/HIGH/CRITICAL], order (number), durationWeeks (number), resources (array of strings), subtopics (array of 4-6 strings))

CRITICAL RULES:
1. The roadmap MUST be specific to the target role. Name the exact technologies, tools, concepts, and deliverables that role uses. For example, a Data Analyst roadmap must cover Excel, SQL, Python/pandas, statistics, Power BI/Tableau, dashboards, A/B testing, and portfolio case studies — never generic "programming fundamentals".
2. Sequence tasks from prerequisites to core skills to advanced topics, then role-relevant projects, then interview and job-search preparation.
3. Use the candidate's current skills: skip or compress basics they already know, and add a short refresher only when needed.
4. Every task must have concrete subtopics (specific tools, concepts, or deliverables). Never use generic words like "basics", "fundamentals", or "practice".
5. Include at least 2 role-relevant projects (one intermediate, one capstone) with the exact stack, features, and deliverables.
6. Include role-specific interview topics (e.g., SQL joins and window functions for analysts, system design for backend, ML metrics for ML roles).
7. Fit the number of tasks and effort to the requested duration, learning speed, and available time.
Return ONLY valid JSON, no markdown.`;

      const prompt = `Target role: ${careerGoal}
Candidate's current skills: ${skills.length ? skills.join(', ') : 'None specified'}
Domain/Specialization: ${preferences.domain || 'Not specified'}
Total duration: ${preferences.months ? `${preferences.months} months` : '6 months'}
Learning speed: ${preferences.learningSpeed || 'MODERATE'}
Available time: ${preferences.availableTime || '2 hours per day'}
Salary goal: ${preferences.salaryGoal || 'Not specified'}
Preferred company: ${preferences.preferredCompany || 'Not specified'}

Build the exact learning path someone needs to become a ${careerGoal}. Make every task, subtopic, project, and interview topic specific to this role and realistic for the available time.`;

      const parsed = await generateJSONWithAI(systemPrompt, prompt, 0.5, 5000);
      if (parsed !== null) {
        if (isRoadmapRoleSpecific(parsed, careerGoal)) return parsed;
        console.warn('AI roadmap was not role-specific; using the role catalogue roadmap instead.');
      }
    } catch (error: any) {
      console.error('AI roadmap generation failed, using local fallback:', error.message);
    }
  }

  return buildRoleRoadmap(careerGoal, skills, {
    domain: preferences.domain,
    months: preferences.months,
  });
}

export function generateLocalSkillGaps(currentSkills: string[], targetSkills: string[], role?: string): any[] {
  const levelValues: Record<string, number> = {
    NONE: 0, BEGINNER: 25, INTERMEDIATE: 50, ADVANCED: 75, EXPERT: 100,
  };
  const computeGap = (cur: string, req: string) =>
    Math.max(0, Math.min(100, (levelValues[req] ?? 50) - (levelValues[cur] ?? 0)));

  const userSkills = currentSkills.map(entry => {
    const cleanEntry = String(entry || '');
    const m = cleanEntry.match(/^(.*?)\s*\(([^)]+)\)\s*$/);
    const name = canonicalSkillName(m ? m[1].trim() : cleanEntry.trim());
    return { name, key: skillKey(name), level: normalizeUserSkillLevel(m ? m[2] : null) };
  }).filter(s => s.key.length >= 2);

  const roleSet = role ? getRoleSkillSet(role) : { core: [], advanced: [] };
  const inRole = (list: string[], target: string) =>
    list.some(s => isDuplicateKey(skillKey(s), skillKey(target)));

  const seenKeys: string[] = [];
  const gaps: any[] = [];

  const candidates = targetSkills
    .map(t => canonicalSkillName(t))
    .filter(Boolean)
    .sort((a, b) => a.length - b.length);

  for (const target of candidates) {
    const key = skillKey(target);
    if (key.length < 2 || seenKeys.some(existing => isDuplicateKey(existing, key))) continue;
    seenKeys.push(key);

    const matched = userSkills.find(u => isDuplicateKey(u.key, key));
    const isCore = inRole(roleSet.core, target);
    const isAdvanced = inRole(roleSet.advanced, target);

    const currentLevel = matched ? matched.level : 'NONE';
    const requiredLevel = isAdvanced ? 'ADVANCED' : 'INTERMEDIATE';
    if (matched && levelValues[currentLevel] >= levelValues[requiredLevel]) continue;

    const lower = target.toLowerCase();
    const isSoft = /communication|leadership|teamwork|collaboration|problem solving|critical thinking|time management|presentation|stakeholder|negotiation|adaptability|creativity|mentoring/i.test(lower);
    const isTechnical = /javascript|python|java|react|node|sql|aws|docker|git|typescript|mongodb|css|html|kubernetes|tensorflow|pytorch|api|microservice|linux|devops|ml|ai|data|cloud|excel|pandas|numpy|tableau|power bi|figma|statistics|testing|security|terraform/i.test(lower);
    const priority = isCore || (!matched && gaps.length < 3)
      ? 'CRITICAL'
      : isAdvanced || matched
        ? 'RECOMMENDED'
        : 'OPTIONAL';

    gaps.push({
      skillName: target,
      currentLevel,
      requiredLevel,
      gap: computeGap(currentLevel, requiredLevel),
      priority,
      category: isSoft ? 'SOFT' : isTechnical ? 'TECHNICAL' : 'DOMAIN',
      isBeingAddressed: false,
    });
  }

  const priorityRank: Record<string, number> = { CRITICAL: 0, RECOMMENDED: 1, OPTIONAL: 2 };
  return gaps
    .sort((a, b) => (priorityRank[a.priority] ?? 3) - (priorityRank[b.priority] ?? 3) || b.gap - a.gap)
    .slice(0, 15);
}

export async function generateSkillGapAnalysis(
  currentSkills: string[],
  targetSkills: string[],
  targetRole?: string
): Promise<any[]> {
  const role = (targetRole || '').trim();
  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are a senior hiring manager and skill gap analyst. ${role ? `Assess a candidate against the real hiring bar for the target role "${role}".` : 'No specific target role was provided, so assess the candidate only against the provided baseline skills and general employability; do not invent a role.'}
The candidate's current skills may include proficiency hints like "HTML (ADVANCED)" or "SQL (BEGINNER)".

Produce a JSON array of skill gap objects. Each object must have:
- skillName (string, standard industry name)
- currentLevel (NONE/BEGINNER/INTERMEDIATE/ADVANCED/EXPERT) - use the candidate's actual listed level; NONE if the skill is not listed
- requiredLevel (NONE/BEGINNER/INTERMEDIATE/ADVANCED/EXPERT) - a realistic requirement for this role
- priority (CRITICAL/RECOMMENDED/OPTIONAL)
- category (TECHNICAL/SOFT/DOMAIN)

RULES:
1. The target role is the source of truth. The provided role-required skills are a baseline; add any essential skills for the role that are missing, and ignore skills irrelevant to this role.
2. Only include skills where the candidate's current level is below the required level.
3. CRITICAL = must-have to get shortlisted; RECOMMENDED = strengthens the application; OPTIONAL = nice to have.
4. Include role-specific tools, technical concepts, and 1-3 essential soft/domain skills.
5. Do not inflate currentLevel. A listed skill with no level should be treated as INTERMEDIATE at most.
6. Return 8-15 gaps, most important first.
Return ONLY valid JSON array, no markdown.`;

      const prompt = `Target role: ${role || 'Not specified'}
Candidate's current skills: ${currentSkills.length ? currentSkills.join(', ') : 'None listed'}
Role-required skills (baseline): ${targetSkills.length ? targetSkills.join(', ') : 'Not provided - derive them from the target role'}

Assess the candidate against the target role and return the skill gaps.`;

      const parsed = await generateJSONWithAI(systemPrompt, prompt, 0.3, 3000);
      if (parsed !== null) return parsed;
    } catch (error: any) {
      console.error('AI skill gap analysis failed, using local fallback:', error.message);
    }
  }

  return generateLocalSkillGaps(currentSkills, targetSkills, role);
}

function normalizeQuestionKey(question: string): string {
  return String(question || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function pickInterviewQuestions(pool: string[], count: number, previousQuestions: string[]): string[] {
  const previous = new Set(previousQuestions.map(normalizeQuestionKey));
  const chosen: string[] = [];
  const chosenKeys = new Set<string>();

  const take = (allowRepeat: boolean) => {
    for (const question of pool) {
      if (chosen.length >= count) break;
      const key = normalizeQuestionKey(question);
      if (!key || chosenKeys.has(key)) continue;
      if (!allowRepeat && previous.has(key)) continue;
      chosen.push(question);
      chosenKeys.add(key);
    }
  };

  take(false);
  // If we exhausted the fresh pool, still avoid returning fewer than requested.
  if (chosen.length < count) take(true);
  return chosen.slice(0, count);
}

function expectedAnswerHint(question: string, target: string): string {
  if (/complexity|algorithm|array|string|tree|graph|dynamic programming|data structure/i.test(question)) {
    return 'State assumptions, walk through the algorithm step by step, give the time/space complexity, and test edge cases.';
  }
  if (/trade-off|architect|design|scal/i.test(question)) {
    return `Frame requirements first, compare options and trade-offs, then justify a choice relevant to a ${target}.`;
  }
  if (/Describe|Tell me|time when|conflict|pressure|leadership|criticism/i.test(question)) {
    return 'Use the STAR method (Situation, Task, Action, Result) with a specific, measurable outcome.';
  }
  if (/Explain|What are|How have you used|How would you/i.test(question)) {
    return `Give a clear, structured explanation with a concrete example from your experience as it relates to ${target}.`;
  }
  if (/Why/i.test(question)) {
    return 'Connect your motivation and strengths directly to the role and company requirements.';
  }
  return 'Give a concise, structured answer grounded in real experience and role requirements.';
}

function buildLocalExpectedAnswer(question: string, role: string): string {
  const lower = question.toLowerCase();
  const target = role || 'the role';

  if (/two numbers.*target sum|pair.*sum/i.test(question)) {
    return 'Use a hash map while iterating once: store each value with its index, check whether target minus the current value already exists, and return the pair. Time O(n), space O(n). Mention the brute-force O(n^2) alternative and edge cases such as duplicate values and no valid pair.';
  }
  if (/cycle in a linked list/i.test(question)) {
    return 'Use Floyd\'s tortoise and hare: advance one pointer one step and another two steps; if they meet there is a cycle, then reset one pointer to the head to find the entry node. Time O(n), space O(1).';
  }
  if (/longest substring without repeating/i.test(question)) {
    return 'Use a sliding window with a hash map of the last seen index. Expand the right pointer, move the left pointer past the previous occurrence when a repeat appears, and track the maximum window length. Time O(n), space O(min(n, alphabet)).';
  }
  if (/lru cache/i.test(question)) {
    return 'Combine a hash map for O(1) lookup with a doubly linked list for O(1) move-to-front and eviction. get and put are O(1); explain capacity handling and removal of the least-recently-used tail node.';
  }
  if (/lowest common ancestor/i.test(question)) {
    return 'For a binary tree, recurse on left and right; if both return a node, the current node is the LCA, otherwise return the non-null result. For a BST, walk from the root and split when the two values fall on different sides. Time O(h).';
  }
  if (/k-th largest/i.test(question)) {
    return 'Option 1: sort and index, O(n log n). Option 2: min-heap of size k, O(n log k). Option 3: quickselect with average O(n) and worst-case O(n^2). Discuss when each is appropriate.';
  }
  if (/deadlock/i.test(question)) {
    return 'Detect via thread dumps and lock graphs; prevent by consistent lock ordering, timeouts, try-lock, or reducing shared mutable state. Explain diagnosis with jstack/profiler and how to reproduce the deadlock.';
  }
  if (/api rate limiter|rate limiter/i.test(question)) {
    return 'Clarify limits per user/IP and time window, then choose fixed window, sliding window, token bucket or leaky bucket. Store counters in Redis with atomic operations, return 429 with Retry-After, and discuss distributed consistency and hot keys.';
  }
  if (/merge overlapping intervals/i.test(question)) {
    return 'Sort intervals by start, then iterate and merge when the current start is less than or equal to the last merged end. Otherwise append a new interval. Time O(n log n), space O(n) for the result.';
  }
  if (/shortest path in an unweighted graph/i.test(question)) {
    return 'Use breadth-first search from the source, tracking visited nodes and distances. Each edge has weight 1, so BFS gives the shortest path in O(V + E); reconstruct the path with a parent map.';
  }
  if (/conflict|disagreed|criticism|leadership|pressure|stressful|team|deadline|did not go as planned|decision with incomplete/i.test(question)) {
    return 'Answer with STAR: describe the Situation and Task briefly, explain your specific Actions and reasoning, then give the measurable Result. Show ownership, what you learned, and what you would do differently, using one concrete example.';
  }
  if (/why do you want|career goals|next 3-5 years/i.test(question)) {
    return `Connect your motivation, current strengths, and growth plan to the ${target}. Give a specific reason for this role and company, and show how it fits your next 3-5 years without sounding generic.`;
  }
  if (/diagnose and fix|failing intermittently|production system/i.test(question)) {
    return 'Structure the answer: confirm impact and check dashboards, logs, traces and error rates; reproduce or isolate the failing component; mitigate with rollback/feature flag; find the root cause with evidence; add tests, monitoring and a prevention plan. Mention communication during the incident.';
  }
  if (/separates a good|great .* from/i.test(question)) {
    return `A strong ${target} goes beyond coding: they clarify requirements, reason about trade-offs, communicate clearly, test edge cases, consider reliability and cost, mentor others, and connect technical decisions to user and business outcomes. Give one concrete example.`;
  }
  if (/used ([a-z0-9+#. ]+?)(?: in a real project| for a )/i.test(question)) {
    const skill = (question.match(/used ([a-z0-9+#. ]+?)(?: in a real project| for a )/i) || [])[1] || 'the skill';
    return `Describe a real project using ${skill}: the problem, why ${skill} was chosen, the design and implementation, one difficult bug or trade-off, testing, and the measurable result. Mention best practices, performance and maintainability.`;
  }
  if (/best practices for ([a-z0-9+#. ]+?)(?: for|,| and)/i.test(question)) {
    const skill = (question.match(/best practices for ([a-z0-9+#. ]+?)(?: for|,| and)/i) || [])[1] || 'the skill';
    return `Cover ${skill} best practices with concrete examples: clear structure and naming, error handling, testing, security, performance, observability and maintainability. Explain the trade-off behind each practice and a mistake you have seen.`;
  }
  if (/ml theory|machine learning|model|metrics/i.test(lower)) {
    return `Define the ML workflow and the theory behind the model, then explain data collection, feature engineering, train/validation/test splits, baseline models, bias-variance and overfitting. Name concrete metrics such as accuracy, precision, recall, F1 and ROC-AUC, how to choose them for the problem, and how you monitor and retrain models in production.`;
  }
  if (/python/i.test(lower)) {
    return 'Explain Python fundamentals with an example: data structures, functions, modules, error handling, virtual environments, testing, and performance considerations. Mention libraries you used and one real bug or design decision.';
  }
  if (/sql|database/i.test(lower)) {
    return 'Explain schema design, normalization, indexes, joins, transactions and query performance. Give a concrete query example, discuss how you would read an execution plan and fix a slow query.';
  }
  if (/data structure|algorithm|complexity/i.test(lower)) {
    return 'State assumptions, describe the data structure and algorithm step by step, give time and space complexity, and test edge cases. Mention an alternative approach and why yours is preferable.';
  }
  if (/design|architect|scal|trade-off/i.test(lower)) {
    return `Clarify requirements and constraints, then compare at least two designs with trade-offs in scalability, reliability, cost and complexity. Choose one for a ${target}, describe components and data flow, and cover monitoring and failure handling.`;
  }
  return `Give a structured answer for a ${target}: define the concept, explain the process and trade-offs, use one concrete example, mention relevant tools or metrics, and finish with the result or what you learned.`;
}

function generateLocalInterviewQuestions(
  type: string,
  role: string,
  skills: string[],
  options: { company?: string; previousQuestions?: string[]; questionCount?: number } = {}
): any {
  const roleText = (role || 'the target role').trim();
  const company = (options.company || '').trim();
  const target = company ? `${roleText} at ${company}` : roleText;
  const roleProfile = getRoleProfile(roleText);

  const isTechnical = /technical|backend|frontend|full.?stack|devops|engineer|developer|architect|data|ml|ai/i.test(type) || /engineer|developer|architect|scientist|analyst/i.test(roleText);
  const isHR = /hr|behavioral|behavioural|soft/i.test(type);
  const isCoding = /coding|code|dsa|algorithm/i.test(type);
  const isMock = /mock/i.test(type);

  const skillList = [...new Set(skills.filter(Boolean))].slice(0, 8);

  const technical: string[] = [];
  for (const topic of roleProfile.interview) {
    technical.push(`As a ${target}, how would you approach ${topic.toLowerCase()}? Walk through your process and the trade-offs you would consider.`);
    technical.push(`Describe a realistic ${topic.toLowerCase()} challenge for a ${target} and explain how you would solve it.`);
  }
  for (const skill of skillList) {
    technical.push(`How have you used ${skill} in a real project? Explain the key design decisions you made.`);
    technical.push(`What are the most important best practices for ${skill} for a ${target}, and why do they matter?`);
  }
  technical.push(`A production system used by ${target} teams is failing intermittently. How would you diagnose and fix the issue?`);
  technical.push(`What separates a good ${roleText} from a great ${roleText}? Explain the trade-offs that matter most.`);

  const coding = [
    'Given an array of integers and a target sum, explain how you would find two numbers that add up to the target. What are the time and space complexities?',
    'How would you detect a cycle in a linked list? Explain the approach and prove why it works.',
    'Given a string, explain how you would find the longest substring without repeating characters.',
    'How would you implement a least-recently-used (LRU) cache? Describe the data structures and complexity.',
    'Given a binary tree, explain how you would find the lowest common ancestor of two nodes.',
    'How would you find the k-th largest element in an unsorted array? Compare at least two approaches.',
    'Explain how you would detect and resolve a deadlock in a multi-threaded application.',
    'How would you design an API rate limiter for a high-traffic service?',
    'Given a list of intervals, explain how you would merge overlapping intervals.',
    'How would you find the shortest path in an unweighted graph? Explain the algorithm and complexity.',
  ];

  const behavioral = [
    'Tell me about a time you worked successfully in a team. What was your specific contribution?',
    'Describe a conflict you faced at work and how you resolved it.',
    'Tell me about a project that did not go as planned. What did you learn and what would you do differently?',
    'How do you prioritize tasks when you are handling multiple deadlines?',
    'Describe a time you received constructive criticism and how you handled it.',
    'Tell me about a time you showed leadership without having formal authority.',
    'How do you handle pressure or stressful situations? Give a specific example.',
    'Describe a time you had to learn a new technology or domain quickly.',
    'Tell me about a time you disagreed with a teammate or manager. How did you handle it?',
    'Describe a situation where you had to make a decision with incomplete information.',
    'Why do you want this role, and how does it fit your career goals?',
    'Where do you see yourself growing in the next 3-5 years?',
  ];

  let pool: string[];
  if (isMock) {
    pool = [...technical, ...behavioral, ...coding.slice(0, 4)];
  } else if (isCoding) {
    pool = [...coding, ...technical.slice(0, 4)];
  } else if (isHR) {
    pool = behavioral;
  } else if (isTechnical) {
    pool = [...technical, ...behavioral.slice(0, 4)];
  } else {
    pool = [...technical.slice(0, 5), ...behavioral.slice(0, 7)];
  }

  const count = Math.min(12, Math.max(8, options.questionCount || 10));
  const questions = pickInterviewQuestions(pool, count, options.previousQuestions || []);

  return {
    questions,
    expectedAnswers: questions.map(q => expectedAnswerHint(q, target)),
    evaluationCriteria: {
      communication: isTechnical ? 30 : 40,
      confidence: 20,
      technicalAccuracy: isTechnical || isCoding ? 40 : 20,
      problemSolving: isTechnical || isCoding ? 30 : 20,
    },
  };
}

export async function generateInterviewQuestions(
  type: string,
  role: string,
  skills: string[],
  options: { company?: string; previousQuestions?: string[]; questionCount?: number } = {}
): Promise<any> {
  const company = (options.company || '').trim();
  const previousQuestions = (options.previousQuestions || []).filter(Boolean);
  const questionCount = Math.min(12, Math.max(8, options.questionCount || 10));

  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are a senior interview coach who prepares candidates for real interviews at specific companies.
Generate ${questionCount} interview questions for the given interview type, target role${company ? ', and company' : ''}.
Return a JSON object with:
- questions (array of ${questionCount} strings)
- expectedAnswers (array of strings, brief expected answer points, same length as questions)
- evaluationCriteria (object with: communication, confidence, technicalAccuracy, problemSolving weights)

Rules:
1. Every question must be specific to the target role${company ? ` and ${company}'s interview style` : ''}. Use role-relevant tools, concepts, and scenarios; avoid generic filler.
2. Match the interview type: TECHNICAL = hands-on technical depth; CODING = algorithms/data structures with complexity; HR = behavioral/STAR; MOCK = realistic mix.
3. Include the candidate's listed skills where relevant, but only when they fit the role.
4. Do NOT repeat or lightly rephrase any question in the "Previously asked questions" list. If a topic is exhausted, choose a different angle or topic.
5. Questions must be answerable in a conversational interview (no "write code on a whiteboard" unless the type is CODING).
Return ONLY valid JSON.`;

      const prompt = `Interview Type: ${type}
Role: ${role}${company ? `\nCompany: ${company}` : ''}
Relevant Skills: ${skills.join(', ') || 'Not specified'}

Previously asked questions (do not repeat any of these):
${previousQuestions.length ? previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None'}

Generate ${questionCount} fresh, role-specific interview questions.`;

      const parsed = await generateJSONWithAI(systemPrompt, prompt, 0.6, 3500);
      if (parsed !== null) return parsed;
    } catch (error: any) {
      console.error('AI interview generation failed, using local fallback:', error.message);
    }
  }

  return generateLocalInterviewQuestions(type, role, skills, {
    company,
    previousQuestions,
    questionCount,
  });
}

export interface InterviewQuestionBankItem {
  question: string;
  expectedAnswer: string;
  difficulty: 'EASY' | 'INTERMEDIATE' | 'HARD';
  topic: string;
}

function normalizeDifficulty(value: unknown, index: number): 'EASY' | 'INTERMEDIATE' | 'HARD' {
  const text = String(value || '').toUpperCase();
  if (text.includes('HARD') || text.includes('ADVANCED')) return 'HARD';
  if (text.includes('EASY') || text.includes('BEGINNER')) return 'EASY';
  if (text.includes('INTERMEDIATE') || text.includes('MEDIUM')) return 'INTERMEDIATE';
  return index < 3 ? 'EASY' : index < 7 ? 'INTERMEDIATE' : 'HARD';
}

export async function generateInterviewQuestionBank(
  type: string,
  role: string,
  skills: string[],
  options: {
    company?: string;
    previousQuestions?: string[];
    questionCount?: number;
    experienceLevel?: string;
    difficulty?: string;
  } = {}
): Promise<{ questions: InterviewQuestionBankItem[]; evaluationCriteria: any }> {
  const company = (options.company || '').trim();
  const previousQuestions = (options.previousQuestions || []).filter(Boolean);
  const questionCount = Math.min(14, Math.max(8, options.questionCount || 10));
  const experienceLevel = options.experienceLevel || 'Fresher';

  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are a senior interview coach preparing a candidate for a real ${type} interview.
Create a ${questionCount}-question interview bank for the target role${company ? ` at ${company}` : ''}.
Return ONLY JSON:
{
  "questions": [
    {
      "question": "string",
      "expectedAnswer": "string — the key points a strong answer must contain, written as a model answer for the interviewer",
      "difficulty": "EASY | INTERMEDIATE | HARD",
      "topic": "string — the skill/concept being tested"
    }
  ],
  "evaluationCriteria": { "communication": number, "confidence": number, "technicalAccuracy": number, "problemSolving": number }
}

Rules:
1. Questions must be specific to the role, skills and experience level (${experienceLevel}). Avoid generic filler.
2. Match the interview type: TECHNICAL = role-specific depth; CODING = algorithms/data structures with complexity; HR = behavioral/STAR; MOCK = realistic mix.
3. Progress from EASY to INTERMEDIATE to HARD. Include at least 3 questions per difficulty band.
4. The expectedAnswer is for the evaluator only. It must contain concrete points, not a generic hint.
5. Do not repeat any question from the previously asked list.
Return ONLY valid JSON.`;

      const prompt = `Interview Type: ${type}
Role: ${role}${company ? `\nCompany: ${company}` : ''}
Experience Level: ${experienceLevel}
Candidate Skills: ${skills.join(', ') || 'Not specified'}
Previously asked questions: ${previousQuestions.length ? previousQuestions.map((q, i) => `${i + 1}. ${q}`).join('\n') : 'None'}

Generate the interview bank.`;

      const parsed = await generateJSONWithAI(systemPrompt, prompt, 0.5, 4500);
      const rawQuestions = Array.isArray(parsed) ? parsed : parsed?.questions;
      if (Array.isArray(rawQuestions) && rawQuestions.length > 0) {
        const questions: InterviewQuestionBankItem[] = rawQuestions
          .map((item: any, index: number) => {
            const question = String(typeof item === 'string' ? item : item?.question || '').trim();
            if (!question) return null;
            return {
              question,
              expectedAnswer: String(item?.expectedAnswer || item?.sampleAnswer || expectedAnswerHint(question, role)).trim(),
              difficulty: normalizeDifficulty(item?.difficulty, index),
              topic: String(item?.topic || (role ? `${role} interview` : 'Interview')).trim(),
            };
          })
          .filter((item): item is InterviewQuestionBankItem => !!item)
          .slice(0, questionCount);
        if (questions.length >= 4) {
          return {
            questions,
            evaluationCriteria: parsed?.evaluationCriteria || {
              communication: 25, confidence: 20, technicalAccuracy: 35, problemSolving: 20,
            },
          };
        }
      }
    } catch (error: any) {
      console.error('AI interview bank generation failed, using local fallback:', error.message);
    }
  }

  const local = generateLocalInterviewQuestions(type, role, skills, {
    company,
    previousQuestions,
    questionCount,
  });
  const questions: InterviewQuestionBankItem[] = (local.questions || []).map((question: string, index: number) => ({
    question,
    expectedAnswer: buildLocalExpectedAnswer(question, role) || local.expectedAnswers?.[index] || expectedAnswerHint(question, role),
    difficulty: normalizeDifficulty(null, index),
    topic: /data structure|algorithm|array|string|tree|graph|dynamic programming/i.test(question)
      ? 'Data Structures & Algorithms'
      : /conflict|team|pressure|criticism|leadership|deadline/i.test(question)
        ? 'Behavioral'
        : role || 'Role Knowledge',
  }));
  return { questions, evaluationCriteria: local.evaluationCriteria };
}

function keywordsFrom(text: string): string[] {
  const stop = new Set(['the', 'and', 'for', 'with', 'that', 'this', 'your', 'you', 'are', 'how', 'what', 'when', 'why', 'would', 'could', 'should', 'from', 'into', 'about', 'have', 'has', 'will', 'using', 'use', 'not', 'but', 'its', 'their', 'them', 'then', 'than', 'also', 'can', 'may', 'must', 'give', 'explain', 'describe', 'answer', 'question', 'role', 'target', 'candidate']);
  return Array.from(new Set(
    String(text || '')
      .toLowerCase()
      .replace(/[^a-z0-9+#\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length >= 5 && !stop.has(word))
  ));
}

export async function evaluateInterviewAnswerDetailed(
  question: string,
  answer: string,
  options: {
    expectedAnswer?: string;
    role?: string;
    company?: string;
    difficulty?: string;
    experienceLevel?: string;
    criteria?: any;
  } = {}
): Promise<any> {
  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are a strict but constructive interview evaluator. Use the expected answer (for evaluator use only) to judge correctness.
Return ONLY JSON:
{
  "correctnessScore": 0-100,
  "relevanceScore": 0-100,
  "clarityScore": 0-100,
  "confidenceScore": 0-100,
  "communicationScore": 0-100,
  "problemSolvingScore": 0-100,
  "technicalAccuracy": 0-100,
  "overallScore": 0-100,
  "feedback": "2-4 sentences of specific feedback",
  "strengths": ["..."],
  "mistakes": ["specific factual or structural mistake"],
  "improvements": ["specific actionable improvement"],
  "weakAreas": ["..."],
  "improvementPlan": "one paragraph",
  "sampleAnswer": "a strong model answer the candidate can study"
}
Judge correctness against the expected answer, relevance against the question, clarity/communication from structure and language, and confidence from decisiveness and ownership. Do not inflate scores.`;

      const prompt = `Role: ${options.role || 'Not specified'}${options.company ? ` at ${options.company}` : ''}
Experience Level: ${options.experienceLevel || 'Fresher'}
Difficulty: ${options.difficulty || 'INTERMEDIATE'}
Question: ${question}
Interviewer expected answer / key points: ${options.expectedAnswer || 'Not provided'}
Candidate answer: ${answer}
Weights: ${JSON.stringify(options.criteria || {})}

Evaluate the answer.`;

      const parsed = await generateJSONWithAI(systemPrompt, prompt, 0.2, 2200);
      if (parsed !== null && !Array.isArray(parsed)) {
        const clamp = (value: any) => Math.max(0, Math.min(100, Math.round(Number(value) || 0)));
        const correctness = clamp(parsed.correctnessScore ?? parsed.technicalAccuracy);
        const relevance = clamp(parsed.relevanceScore ?? parsed.problemSolvingScore);
        const clarity = clamp(parsed.clarityScore ?? parsed.communicationScore);
        const confidence = clamp(parsed.confidenceScore);
        const communication = clamp(parsed.communicationScore ?? clarity);
        const overall = clamp(parsed.overallScore ?? ((correctness + relevance + clarity + confidence + communication) / 5));
        return {
          correctnessScore: correctness,
          relevanceScore: relevance,
          clarityScore: clarity,
          confidenceScore: confidence,
          communicationScore: communication,
          problemSolvingScore: clamp(parsed.problemSolvingScore ?? relevance),
          technicalAccuracy: clamp(parsed.technicalAccuracy ?? correctness),
          overallScore: overall,
          feedback: String(parsed.feedback || ''),
          strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
          mistakes: Array.isArray(parsed.mistakes) ? parsed.mistakes : [],
          improvements: Array.isArray(parsed.improvements) ? parsed.improvements : [],
          weakAreas: Array.isArray(parsed.weakAreas) ? parsed.weakAreas : [],
          improvementPlan: String(parsed.improvementPlan || ''),
          sampleAnswer: String(parsed.sampleAnswer || options.expectedAnswer || ''),
          evaluatedBy: 'ai',
        };
      }
    } catch (error: any) {
      console.error('AI interview evaluation failed, using local fallback:', error.message);
    }
  }

  return evaluateLocalAnswerDetailed(question, answer, options);
}

function evaluateLocalAnswerDetailed(
  question: string,
  answer: string,
  options: { expectedAnswer?: string } = {}
): any {
  const base = evaluateLocalAnswer(question, answer);
  const answerKeywords = new Set(keywordsFrom(answer));
  const expectedKeywords = keywordsFrom(options.expectedAnswer || '');
  const questionKeywords = keywordsFrom(question);
  const expectedHits = expectedKeywords.filter(word => answerKeywords.has(word));
  const questionHits = questionKeywords.filter(word => answerKeywords.has(word));
  const expectedRatio = expectedKeywords.length > 0 ? expectedHits.length / expectedKeywords.length : 0;
  const relevanceRatio = questionKeywords.length > 0 ? questionHits.length / questionKeywords.length : 0;
  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;

  const correctnessScore = Math.max(
    wordCount < 8 ? 10 : 30,
    Math.min(100, Math.round(
      30 + expectedRatio * 55 + Math.min(15, expectedHits.length * 2) + Math.min(5, Math.floor(wordCount / 30))
    ))
  );
  const relevanceScore = Math.max(
    wordCount < 8 ? 15 : 30,
    Math.min(100, Math.round(30 + relevanceRatio * 55 + (answerKeywords.size >= 5 ? 15 : 0)))
  );
  const clarityScore = base.communicationScore;
  const communicationScore = base.communicationScore;
  const confidenceScore = base.confidenceScore;
  const correctness = Math.round((correctnessScore + relevanceScore) / 2);
  const overallScore = Math.round(
    (correctness * 0.35 + relevanceScore * 0.2 + clarityScore * 0.2 + confidenceScore * 0.15 + communicationScore * 0.1)
  );
  const mistakes = [...base.weakAreas];
  if (expectedHits.length === 0 && expectedKeywords.length > 0) {
    mistakes.unshift('The answer does not cover the key points expected for this question.');
  }
  const improvements = [
    ...base.weakAreas.map((item: string) => `Improve: ${item}`),
    expectedHits.length === 0 && expectedKeywords.length > 0
      ? `Include key points such as: ${expectedKeywords.slice(0, 5).join(', ')}.`
      : 'Add one concrete example and one measurable outcome.',
  ];
  const sampleAnswer = options.expectedAnswer ||
    `A strong answer would: ${base.strengths[0] || 'state the approach clearly'}, cover the key concepts, give a concrete example, and finish with the result or trade-off.`;

  return {
    ...base,
    correctnessScore,
    relevanceScore,
    clarityScore,
    communicationScore,
    technicalAccuracy: correctness,
    overallScore,
    feedback: `Correctness ${correctnessScore}/100 · Relevance ${relevanceScore}/100 · Clarity ${clarityScore}/100. ${base.feedback}`,
    mistakes,
    improvements,
    sampleAnswer,
    evaluatedBy: 'local',
  };
}

function evaluateLocalAnswer(question: string, answer: string): any {
  const wordCount = answer.split(/\s+/).length;
  const sentenceCount = answer.split(/[.!?]+/).filter(s => s.trim()).length;
  const hasStructure = /\b(first|second|third|then|finally|initially|subsequently|ultimately)\b/i.test(answer);
  const hasMetrics = /\b(\d+|percent|percentage|increased|decreased|improved|reduced|saved)\b/i.test(answer);
  const hasExamples = /\b(for example|for instance|such as|specifically|in particular|like)\b/i.test(answer);
  const hasActionWords = /\b(developed|created|built|designed|implemented|led|managed|delivered|achieved|solved)\b/i.test(answer);
  const isTechnical = /\b(code|algorithm|system|architecture|api|database|framework|function|class|module)\b/i.test(question);

  const communicationScore = Math.min(100, 30 + (sentenceCount > 3 ? 20 : 0) + (hasStructure ? 25 : 0) + (wordCount > 50 ? 15 : 0) + (hasExamples ? 10 : 0));
  const confidenceScore = Math.min(100, 40 + (hasActionWords ? 25 : 0) + (hasMetrics ? 15 : 0) + (hasStructure ? 20 : 0));
  const technicalAccuracy = isTechnical ? Math.min(100, 30 + (hasExamples ? 20 : 0) + (hasMetrics ? 20 : 0) + (hasStructure ? 15 : 0) + (wordCount > 40 ? 15 : 0)) : 70;
  const problemSolvingScore = Math.min(100, 30 + (hasStructure ? 25 : 0) + (hasMetrics ? 20 : 0) + (hasActionWords ? 25 : 0));
  const overallScore = Math.round((communicationScore + confidenceScore + technicalAccuracy + problemSolvingScore) / 4);

  const strengths: string[] = [];
  if (hasStructure) strengths.push('Well-structured response with clear logical flow');
  if (hasMetrics) strengths.push('Uses quantifiable achievements and metrics');
  if (hasExamples) strengths.push('Provides specific examples to support points');
  if (hasActionWords) strengths.push('Uses strong action verbs demonstrating initiative');
  if (wordCount > 80) strengths.push('Comprehensive answer with sufficient detail');
  if (sentenceCount > 4) strengths.push('Articulate with good sentence variety');

  const weakAreas: string[] = [];
  if (!hasStructure) weakAreas.push('Response lacks clear structure - use STAR method (Situation, Task, Action, Result)');
  if (!hasMetrics) weakAreas.push('Missing quantifiable accomplishments - include numbers and percentages');
  if (!hasExamples) weakAreas.push('No specific examples provided - use real experiences to strengthen answers');
  if (!hasActionWords) weakAreas.push('Use more action verbs (developed, implemented, achieved)');
  if (wordCount < 30) weakAreas.push('Answer too brief - provide more detail and context');
  if (wordCount > 200) weakAreas.push('Answer may be too verbose - aim for concise, focused responses');

  const improvementPlan = overallScore < 50
    ? 'Focus on structuring your answers using the STAR method. Prepare specific examples from your experience with measurable outcomes.'
    : overallScore < 70
      ? `Good foundation! Work on ${weakAreas.slice(0, 2).join(' and ').toLowerCase()}. Prepare quantifiable achievements.`
      : 'Strong performance! Continue refining your examples and consider preparing for follow-up questions.';

  return {
    communicationScore,
    confidenceScore,
    technicalAccuracy,
    problemSolvingScore,
    overallScore,
    feedback: `Your answer scored ${overallScore}/100. ${strengths[0] || 'Good effort.'} ${weakAreas[0] || 'Keep up the good work.'} Length: ${wordCount} words.`,
    strengths,
    weakAreas,
    improvementPlan,
  };
}

export async function evaluateInterviewAnswer(
  question: string,
  answer: string,
  criteria: any
): Promise<any> {
  if (canUseGemini() || canUseOpenAI()) {
    try {
      const systemPrompt = `You are an interview evaluator. Evaluate the candidate's answer.
Return a JSON object with:
- communicationScore (0-100)
- confidenceScore (0-100)
- technicalAccuracy (0-100)
- problemSolvingScore (0-100)
- overallScore (0-100)
- feedback (string with detailed evaluation)
- strengths (array of strings)
- weakAreas (array of strings)
- improvementPlan (string)

Return ONLY valid JSON.`;

      const prompt = `Question: ${question}
Answer: ${answer}
Evaluation Criteria: ${JSON.stringify(criteria)}

Evaluate this interview answer thoroughly.`;

      const parsed = await generateJSONWithAI(systemPrompt, prompt, 0.3, 2000);
      if (parsed !== null) return parsed;
    } catch (error: any) {
      console.error('AI interview evaluation failed, using local fallback:', error.message);
    }
  }

  return evaluateLocalAnswer(question, answer);
}

function buildConfidenceJudgePrompt(question: string, answer: string, profileContext: string): string {
  return `You are an AI output auditor. Your job is to estimate how factually reliable an AI assistant's answer is (hallucination risk).

USER QUESTION:
${question}

AI ANSWER TO AUDIT:
${answer}

PROFILE DATA THE ASSISTANT HAD ACCESS TO:
${profileContext || 'None'}

Score 0-100 where:
- 90-100 = general explanations/concepts with no risky specific claims; fully trustworthy
- 70-89 = mostly reliable; minor approximations that are clearly labeled as approximate
- 40-69 = contains suspicious specifics (exact statistics, dates, salaries, rankings, citations, links) that may be fabricated or unverifiable
- 0-39 = likely fabricated facts presented confidently

Penalize: invented statistics, fake-sounding links/courses/certifications, overly precise numbers without sources, contradicting the profile data.
Reward: honest hedging ("approximately", "may vary", "I'm not certain"), well-known established knowledge.

Return ONLY valid JSON, no markdown: {"score": <number 0-100>, "issues": "<one short sentence about main risk, or empty>"}`;
}

function parseConfidenceScore(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      const score = typeof parsed.score === 'number' ? parsed.score : parseInt(String(parsed.score).match(/\d+/)?.[0] || '', 10);
      if (Number.isFinite(score)) return Math.max(0, Math.min(100, Math.round(score)));
    } catch { /* fall through */ }
  }
  const numMatch = cleaned.match(/\b(\d{1,3})\b/);
  if (numMatch) {
    const score = parseInt(numMatch[1], 10);
    if (score >= 0 && score <= 100) return score;
  }
  return null;
}

function localConfidenceHeuristic(answer: string): number {
  let score = 78;
  const statCount = (answer.match(/\d+(\.\d+)?\s*(%|percent|lpa|crore|million|billion)/gi) || []).length;
  score -= Math.min(25, statCount * 6);
  if (/https?:\/\//.test(answer)) score -= 8;
  if (/\b(i'?m not certain|not sure|approximate|approximately|may vary|verify|varies)\b/i.test(answer)) score += 8;
  if (answer.length > 3000) score -= 5;
  return Math.max(10, Math.min(95, Math.round(score)));
}

export async function evaluateResponseConfidence(
  question: string,
  answer: string,
  context?: { role: string; content: string }[]
): Promise<number> {
  const profileContext = (context || [])
    .filter(c => c.role !== 'assistant')
    .map(c => c.content)
    .join('\n')
    .substring(0, 1500);

  const judgePrompt = buildConfidenceJudgePrompt(question, answer.substring(0, 4000), profileContext);

  if (canUseGemini()) {
    try {
      const model = genAI!.getGenerativeModel({ model: 'gemini-3.5-flash', generationConfig: { temperature: 0 } });
      const result = await model.generateContent(judgePrompt);
      const parsed = parseConfidenceScore(result.response.text());
      if (parsed !== null) return parsed;
    } catch (error: any) {
      console.error('[Confidence] Gemini evaluation failed:', error.message);
    }
  }

  if (canUseOpenAI()) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [{ role: 'user', content: judgePrompt }],
        temperature: 0,
        max_tokens: 100,
      });
      const parsed = parseConfidenceScore(response.choices[0]?.message?.content || '');
      if (parsed !== null) return parsed;
    } catch (error: any) {
      console.error('[Confidence] OpenAI evaluation failed:', error.message);
    }
  }

  return localConfidenceHeuristic(answer);
}
