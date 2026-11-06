export interface User {
  id: string;
  fullName: string;
  email: string;
  mobile?: string;
  role: 'STUDENT' | 'ADMIN' | 'SUPER_ADMIN';
  isVerified: boolean;
  avatar?: string;
  createdAt: string;
}

export interface Profile {
  id: string;
  userId: string;
  bio?: string;
  education?: string;
  institution?: string;
  graduationYear?: number;
  experience?: string;
  currentCompany?: string;
  currentPosition?: string;
  linkedin?: string;
  github?: string;
  portfolio?: string;
  preferredCompanies?: string;
  preferredDomains?: string;
  careerGoals?: string;
  interests?: string;
  targetRole?: string;
  preferredLanguage?: string;
  learningLevel?: string;
  skills: Skill[];
  certifications: Certification[];
  projects: Project[];
  internships: Internship[];
}

export interface Skill {
  id: string;
  name: string;
  category?: string;
  level?: string;
  isVerified: boolean;
}

export interface Certification {
  id: string;
  name: string;
  issuer?: string;
  issueDate?: string;
  expiryDate?: string;
  credentialId?: string;
  url?: string;
}

export interface Project {
  id: string;
  title: string;
  description?: string;
  technologies?: string;
  url?: string;
  startDate?: string;
  endDate?: string;
}

export interface Internship {
  id: string;
  company: string;
  position: string;
  description?: string;
  startDate?: string;
  endDate?: string;
  skills?: string;
}

export interface Resume {
  id: string;
  userId: string;
  fileName: string;
  filePath: string;
  fileType: string;
  parsedData?: string;
  resumeScore?: number;
  atsScore?: number;
  careerReadiness?: number;
  employabilityScore?: number;
  strengths?: string;
  weaknesses?: string;
  isActive: boolean;
  createdAt: string;
}

export interface Dashboard {
  careerReadinessScore: number;
  placementReadinessScore: number;
  resumeScore: number;
  atsScore: number;
  interviewReadiness: number;
  skillReadiness: number;
  learningProgress: number;
  roadmapProgress: number;
  missingSkills: number;
  learningStreak: number;
  marketAlignmentScore: number;
  skillsCount: number;
  totalTasks: number;
  completedTasks: number;
  recommendationsCount: number;
  interviewsCompleted: number;
}

export interface Recommendation {
  id: string;
  userId: string;
  careerTitle: string;
  matchPercentage: number;
  confidenceScore: number;
  salaryInsights?: string;
  industryDemand?: string;
  growthPotential?: string;
  requiredSkills?: string;
  reasons?: string;
  influencingSkills?: string;
  influencingGoals?: string;
  isVerified: boolean;
  verificationSource?: string;
  isAccepted?: boolean;
  createdAt: string;
}

export interface Roadmap {
  id: string;
  userId: string;
  title: string;
  description?: string;
  careerGoal?: string;
  duration?: string;
  learningSpeed?: string;
  availableTime?: string;
  salaryGoal?: string;
  preferredCompany?: string;
  domainPreference?: string;
  status: string;
  isCurrent: boolean;
  createdAt: string;
  tasks: Task[];
}

export interface Task {
  id: string;
  roadmapId: string;
  title: string;
  description?: string;
  type: string;
  status: string;
  priority: string;
  order?: number;
  startDate?: string;
  dueDate?: string;
  completedAt?: string;
  resources?: string;
  subtopics?: string;
}

export interface Chat {
  id: string;
  userId: string;
  title?: string;
  category?: string;
  isArchived: boolean;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  chatId: string;
  role: 'USER' | 'AI';
  content: string;
  metadata?: string;
  confidence?: number | null;
  createdAt: string;
}

export interface Interview {
  id: string;
  userId: string;
  type: string;
  role?: string;
  company?: string;
  experienceLevel?: string;
  difficulty?: string;
  status: string;
  overallScore?: number;
  communicationScore?: number;
  confidenceScore?: number;
  technicalAccuracy?: number;
  problemSolvingScore?: number;
  relevanceScore?: number;
  clarityScore?: number;
  strengths?: string;
  weakAreas?: string;
  improvementPlan?: string;
  questions?: string;
  questionBank?: string;
  answers?: string;
  answeredCount?: number;
  totalQuestions?: number;
  currentQuestion?: {
    question: string;
    number: number;
    difficulty: string;
    topic: string;
  } | null;
  feedback?: string;
  report?: InterviewReport | null;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface InterviewReport {
  overallScore: number;
  scores: {
    correctness: number;
    relevance: number;
    clarity: number;
    confidence: number;
    communication: number;
    problemSolving: number;
    technicalAccuracy: number;
  };
  byDifficulty: { difficulty: string; questions: number; averageScore: number }[];
  questionsAnswered: number;
  strengths: string[];
  weakAreas: string[];
  mistakes: string[];
  improvements: string[];
  recommendations: string[];
  summary: string;
  generatedAt: string;
}

export interface SkillGap {
  id: string;
  userId: string;
  targetRole?: string;
  skillName: string;
  currentLevel?: string;
  requiredLevel?: string;
  gap?: number;
  priority?: string;
  category?: string;
  isBeingAddressed: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  link?: string;
  createdAt: string;
}

export interface MarketInsight {
  id: string;
  skill?: string;
  title?: string;
  category: string;
  value?: string;
  trend?: string;
  percentage?: number;
  description?: string;
}

export interface LearningResource {
  id: string;
  title: string;
  description?: string;
  url?: string;
  type: string;
  skills?: string;
  difficulty?: string;
}

export type LearningLanguage = 'English' | 'Telugu' | 'Hindi';
export type LearningLevel = 'Beginner' | 'Intermediate' | 'Advanced';

export interface LearningVideo {
  videoId: string;
  title: string;
  channel: string;
  description: string;
  thumbnail: string;
  url: string;
  duration?: string;
  views?: string;
  publishedAt?: string;
  language: LearningLanguage;
  isFallback?: boolean;
}

export interface LearningSubjectSummary {
  key: string;
  title: string;
  description: string;
  skills: string[];
  level: LearningLevel;
  category: string;
  topics: string[];
  nextTopics: string[];
  progress: number;
  completedTopics: string[];
  hasVideo: boolean;
  isRecommended: boolean;
  isRoleSubject: boolean;
}

export interface LearningSubjectsResponse {
  preferences: {
    language: LearningLanguage;
    level: LearningLevel;
    targetRole: string;
    preferredLanguage: string;
    learningLevel: string;
  };
  recommendedSubjects: LearningSubjectSummary[];
  subjects: LearningSubjectSummary[];
  gapSkills: {
    skillName: string;
    currentLevel?: string;
    requiredLevel?: string;
    priority?: string;
  }[];
}

export interface LearningSubjectDetail {
  subject: {
    key: string;
    title: string;
    description: string;
    skills: string[];
    level: LearningLevel;
    category: string;
    topics: string[];
  };
  preferences: { language: LearningLanguage; level: LearningLevel };
  progress: number;
  completedTopics: string[];
  nextTopics: string[];
  videos: LearningVideo[];
}

export interface KnowledgeGraphNode {
  id: string;
  label: string;
  type: string;
  group: string;
  color: string;
  match?: number;
  priority?: string;
  level?: string;
  meta: Record<string, any>;
}

export interface KnowledgeGraphLink {
  source: string;
  target: string;
  type: string;
  label?: string;
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[];
  links: KnowledgeGraphLink[];
  categories: { id: string; label: string; color: string; count: number }[];
  targetRole: {
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
    matchingSkills: string[];
    missingSkills: string[];
    matchPercentage: number;
    learningPaths: { key: string; title: string; description: string; topics: string[]; skills: string[]; level: string }[];
  } | null;
  stats: {
    nodes: number;
    links: number;
    skills: number;
    gaps: number;
    careers: number;
    learningPaths: number;
  };
  updatedAt: string;
}
