import api from './api';
import {
  LearningLanguage,
  LearningLevel,
  LearningSubjectDetail,
  LearningSubjectsResponse,
  LearningVideo,
} from '../types';

export async function getLearningSubjects(params?: {
  targetRole?: string;
  language?: LearningLanguage;
  level?: LearningLevel;
}): Promise<LearningSubjectsResponse> {
  const res = await api.get('/learning/subjects', { params });
  return res.data;
}

export async function getLearningSubject(
  key: string,
  params?: { language?: LearningLanguage; level?: LearningLevel; targetRole?: string }
): Promise<LearningSubjectDetail> {
  const res = await api.get(`/learning/subjects/${key}`, { params });
  return res.data;
}

export async function getLearningVideos(
  query: string,
  params?: { language?: LearningLanguage; level?: LearningLevel; skill?: string }
): Promise<{ videos: LearningVideo[] }> {
  const res = await api.get('/learning/videos', { params: { query, ...params } });
  return res.data;
}

export async function updateLearningPreferences(data: {
  targetRole?: string;
  preferredLanguage?: LearningLanguage;
  language?: LearningLanguage;
  learningLevel?: LearningLevel;
  level?: LearningLevel;
}): Promise<{ preferredLanguage: string; learningLevel: string; targetRole?: string }> {
  const res = await api.put('/learning/preferences', {
    targetRole: data.targetRole,
    language: data.language ?? data.preferredLanguage,
    level: data.level ?? data.learningLevel,
  });
  return res.data;
}

export async function toggleTopic(
  subjectKey: string,
  topic: string,
  completed: boolean,
  params?: { language?: LearningLanguage; level?: LearningLevel }
) {
  const res = await api.post('/learning/progress', {
    subjectKey,
    topic,
    completed,
    ...params,
  });
  return res.data as { subjectKey: string; completedTopics: string[]; progress: number };
}
