import api from './api';
import { Recommendation } from '../types';

export async function getRecommendations(): Promise<Recommendation[]> {
  const res = await api.get('/recommendations');
  return res.data;
}

export async function generateRecommendations(): Promise<Recommendation[]> {
  const res = await api.post('/recommendations/generate');
  return res.data;
}

export interface AcceptRecommendationResult {
  recommendation: Recommendation;
  roadmapId: string;
}

export async function acceptRecommendation(id: string): Promise<AcceptRecommendationResult> {
  const res = await api.post(`/recommendations/${id}/accept`);
  return res.data;
}
