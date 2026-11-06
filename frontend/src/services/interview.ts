import api from './api';
import { Interview, InterviewReport } from '../types';

export interface StartInterviewResponse {
  interview: Interview;
  question: string;
  questionNumber: number;
  totalQuestions: number;
  difficulty: string;
  topic: string;
}

export interface SubmitAnswerResponse {
  evaluation: {
    correctnessScore: number;
    relevanceScore: number;
    clarityScore: number;
    confidenceScore: number;
    communicationScore: number;
    problemSolvingScore?: number;
    technicalAccuracy?: number;
    overallScore: number;
    feedback: string;
    strengths: string[];
    mistakes: string[];
    improvements: string[];
    weakAreas: string[];
    improvementPlan: string;
    sampleAnswer: string;
  } | null;
  answeredCount: number;
  totalQuestions: number;
  isComplete: boolean;
  report: InterviewReport | null;
  nextQuestion: {
    question: string;
    number: number;
    difficulty: string;
    topic: string;
  } | null;
  interview: Interview;
}

export async function getInterviews(): Promise<Interview[]> {
  const res = await api.get('/interviews');
  return res.data;
}

export async function getInterviewById(id: string): Promise<Interview> {
  const res = await api.get(`/interviews/${id}`);
  return res.data;
}

export async function startInterview(data: {
  type: string;
  role: string;
  company?: string;
  experienceLevel?: string;
  difficulty?: string;
}): Promise<StartInterviewResponse> {
  const res = await api.post('/interviews/start', data);
  return res.data;
}

export async function submitAnswer(
  interviewId: string,
  data: { answer: string; questionIndex: number }
): Promise<SubmitAnswerResponse> {
  const res = await api.post(`/interviews/${interviewId}/answers`, data);
  return res.data;
}

export async function completeInterview(interviewId: string) {
  const res = await api.post(`/interviews/${interviewId}/complete`);
  return res.data;
}
