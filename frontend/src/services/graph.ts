import api from './api';
import { KnowledgeGraphData } from '../types';

export async function getKnowledgeGraph(): Promise<KnowledgeGraphData> {
  const res = await api.get('/graph');
  return res.data;
}
