import api from './api';
import { Interview } from '../types';

export async function getInterviews(): Promise<Interview[]> {
  const res = await api.get('/interviews');
  return res.data;
}

export async function getInterviewById(id: string): Promise<Interview> {
  const res = await api.get(`/interviews/${id}`);
  return res.data;
}

export async function startInterview(data: { type: string; role: string; company?: string }) {
  const res = await api.post('/interviews/start', data);
  return res.data;
}

export async function submitAnswer(interviewId: string, data: { question: string; answer: string; questionIndex: number }) {
  const res = await api.post(`/interviews/${interviewId}/answers`, data);
  return res.data;
}

export async function completeInterview(interviewId: string) {
  const res = await api.post(`/interviews/${interviewId}/complete`);
  return res.data;
}
