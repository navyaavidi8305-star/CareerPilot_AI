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
  status: string;
  overallScore?: number;
  communicationScore?: number;
  confidenceScore?: number;
  technicalAccuracy?: number;
  problemSolvingScore?: number;
  strengths?: string;
  weakAreas?: string;
  improvementPlan?: string;
  questions?: string;
  answers?: string;
  feedback?: string;
  startedAt: string;
  completedAt?: string;
  createdAt: string;
}

export interface SkillGap {
  id: string;
  userId: string;
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
