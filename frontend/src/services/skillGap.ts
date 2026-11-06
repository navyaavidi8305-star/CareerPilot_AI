import api from './api';
import { SkillGap } from '../types';

export async function getSkillGaps(role?: string): Promise<SkillGap[]> {
  const res = await api.get('/skill-gaps', { params: role ? { role } : undefined });
  return res.data;
}

export async function analyzeSkillGaps(targetRole?: string): Promise<SkillGap[]> {
  const res = await api.post('/skill-gaps/analyze', targetRole ? { targetRole } : {});
  return res.data;
}

export async function updateSkillGap(id: string, data: { isBeingAddressed: boolean }) {
  const res = await api.put(`/skill-gaps/${id}`, data);
  return res.data;
}
