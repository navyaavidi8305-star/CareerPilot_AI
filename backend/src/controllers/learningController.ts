import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import {
  LEARNING_SUBJECTS,
  LearningLanguage,
  LearningLevel,
  getSubjectByKey,
  nextTopicsForSubject,
  subjectsForRole,
  subjectsForSkills,
} from '../utils/learningCatalog';
import { searchLearningVideos } from '../utils/youtube';
import { canonicalSkillName, isDuplicateKey, skillKey } from '../utils/skillGapUtils';

const LANGUAGES: LearningLanguage[] = ['English', 'Telugu', 'Hindi'];
const LEVELS: LearningLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

function parseLanguage(value: unknown, fallback: string): LearningLanguage {
  const match = LANGUAGES.find(item => item.toLowerCase() === String(value || '').toLowerCase());
  return match || (fallback as LearningLanguage) || 'English';
}

function parseLevel(value: unknown, fallback: string): LearningLevel {
  const match = LEVELS.find(item => item.toLowerCase() === String(value || '').toLowerCase());
  return match || (fallback as LearningLevel) || 'Beginner';
}

function parseStringList(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((s: any) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function uniqueSubjects(items: ReturnType<typeof subjectsForRole>) {
  const seen = new Set<string>();
  return items.filter(item => {
    if (seen.has(item.key)) return false;
    seen.add(item.key);
    return true;
  });
}

function findProgress(rows: any[], subjectKey: string, language: string, level: string) {
  return rows.find(row =>
    skillKey(row.subjectKey) === skillKey(subjectKey) &&
    row.language === language &&
    row.level === level
  );
}

async function loadContext(req: AuthRequest, queryRole?: unknown) {
  const [profile, gaps] = await Promise.all([
    prisma.profile.findUnique({ where: { userId: req.userId }, include: { skills: true } }),
    prisma.skillGap.findMany({ where: { userId: req.userId } }),
  ]);
  const language = parseLanguage(req.query.language, profile?.preferredLanguage || 'English');
  const level = parseLevel(req.query.level, profile?.learningLevel || 'Beginner');
  const targetRole = String(queryRole || req.query.role || profile?.targetRole || profile?.careerGoals || '').split(/[,;|]/)[0].trim();
  const userSkills = [
    ...(profile?.skills || []).map(skill => skill.name),
    ...gaps.map(gap => gap.skillName),
  ];
  const progressRows = await prisma.learningProgress.findMany({
    where: { userId: req.userId },
    orderBy: { lastAccessedAt: 'desc' },
  });
  return { profile, gaps, language, level, targetRole, userSkills, progressRows };
}

export async function getLearningSubjects(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { profile, gaps, language, level, targetRole, progressRows } = await loadContext(req);

    const roleSubjects = targetRole ? subjectsForRole(targetRole) : [];
    const gapSubjects = subjectsForSkills(gaps.map(gap => gap.skillName));
    const allRecommended = uniqueSubjects([...gapSubjects, ...roleSubjects]);
    const recommendedKeys = new Set(allRecommended.map(item => item.key));

    const subjects = LEARNING_SUBJECTS.map(item => {
      const progress = findProgress(progressRows, item.key, language, level);
      const completedTopics = parseStringList(progress?.completedTopics);
      const matchesRole = roleSubjects.some(subject => subject.key === item.key);
      return {
        key: item.key,
        title: item.title,
        description: item.description,
        skills: item.skills,
        level: item.level,
        category: item.category,
        topics: item.topics,
        nextTopics: nextTopicsForSubject(item, completedTopics),
        progress: progress?.progress || 0,
        completedTopics,
        hasVideo: item.curatedVideos.length > 0,
        isRecommended: recommendedKeys.has(item.key),
        isRoleSubject: matchesRole,
      };
    });

    res.json({
      preferences: {
        language,
        level,
        targetRole: targetRole || '',
        preferredLanguage: profile?.preferredLanguage || 'English',
        learningLevel: profile?.learningLevel || 'Beginner',
      },
      recommendedSubjects: subjects.filter(item => item.isRecommended),
      subjects,
      gapSkills: gaps.slice(0, 10).map(gap => ({
        skillName: gap.skillName,
        currentLevel: gap.currentLevel,
        requiredLevel: gap.requiredLevel,
        priority: gap.priority,
      })),
    });
  } catch (error) {
    next(error);
  }
}

export async function getLearningSubject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const subject = getSubjectByKey(req.params.key);
    if (!subject) return res.status(404).json({ error: 'Learning subject not found' });
    const { language, level } = await loadContext(req);
    const progress = await prisma.learningProgress.findFirst({
      where: {
        userId: req.userId,
        subjectKey: subject.key,
        language,
        level,
      },
    });
    const completedTopics = parseStringList(progress?.completedTopics);
    const videos = await searchLearningVideos({
      query: `${subject.title} ${subject.skills.slice(0, 2).join(' ')}`,
      language,
      level,
      curated: subject.curatedVideos,
    });

    res.json({
      subject,
      preferences: { language, level },
      progress: progress?.progress || 0,
      completedTopics,
      nextTopics: nextTopicsForSubject(subject, completedTopics),
      videos,
    });
  } catch (error) {
    next(error);
  }
}

export async function getLearningVideos(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { language, level } = await loadContext(req);
    const query = String(req.query.query || req.query.skill || '').trim();
    if (!query) return res.status(400).json({ error: 'A skill or search query is required' });
    const skill = String(req.query.skill || '').trim();
    const subject = skill ? getSubjectByKey(skill) || LEARNING_SUBJECTS.find(item =>
      item.skills.some(name => isDuplicateKey(skillKey(name), skillKey(canonicalSkillName(skill))))
    ) : undefined;
    const videos = await searchLearningVideos({
      query: subject ? subject.title : query,
      language,
      level,
      curated: subject?.curatedVideos,
    });
    res.json({ query, language, level, videos });
  } catch (error) {
    next(error);
  }
}

export async function updateLearningPreferences(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const language = parseLanguage(req.body.language, profile.preferredLanguage || 'English');
    const level = parseLevel(req.body.level, profile.learningLevel || 'Beginner');
    const targetRole = typeof req.body.targetRole === 'string' ? req.body.targetRole.trim() : undefined;
    const updated = await prisma.profile.update({
      where: { userId: req.userId },
      data: {
        preferredLanguage: language,
        learningLevel: level,
        ...(targetRole !== undefined ? { targetRole } : {}),
      },
    });
    res.json({
      preferredLanguage: updated.preferredLanguage,
      learningLevel: updated.learningLevel,
      targetRole: updated.targetRole,
    });
  } catch (error) {
    next(error);
  }
}

export async function updateLearningProgress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const subjectKey = String(req.body.subjectKey || '').trim();
    const subject = getSubjectByKey(subjectKey);
    if (!subject) return res.status(400).json({ error: 'A valid subjectKey is required' });
    const language = parseLanguage(req.body.language, 'English');
    const level = parseLevel(req.body.level, 'Beginner');
    const existing = await prisma.learningProgress.findFirst({
      where: { userId: req.userId, subjectKey: subject.key, language, level },
    });
    const completedTopics = new Set(parseStringList(existing?.completedTopics));

    if (typeof req.body.topic === 'string' && req.body.topic.trim()) {
      const topic = req.body.topic.trim();
      const topicKey = skillKey(topic);
      const matches = (value: string) => isDuplicateKey(topicKey, skillKey(value));
      if (req.body.completed === false) {
        for (const value of Array.from(completedTopics)) {
          if (matches(value)) completedTopics.delete(value);
        }
      } else {
        const canonical = subject.topics.find(value => matches(value)) || topic;
        completedTopics.add(canonical);
      }
    } else if (Array.isArray(req.body.completedTopics)) {
      completedTopics.clear();
      for (const topic of req.body.completedTopics) {
        if (typeof topic === 'string' && topic.trim()) completedTopics.add(topic.trim());
      }
    }

    const completedList = Array.from(completedTopics);
    const progress = subject.topics.length > 0
      ? Math.min(100, Math.round((completedList.filter(topic =>
          subject.topics.some(item => isDuplicateKey(skillKey(item), skillKey(topic)))
        ).length / subject.topics.length) * 100))
      : 0;

    const data = {
      userId: req.userId!,
      subjectKey: subject.key,
      subjectTitle: subject.title,
      skillName: subject.skills[0] || null,
      language,
      level,
      completedTopics: JSON.stringify(completedList),
      progress,
      lastAccessedAt: new Date(),
    };

    const saved = existing
      ? await prisma.learningProgress.update({ where: { id: existing.id }, data })
      : await prisma.learningProgress.create({ data });

    res.json({
      ...saved,
      completedTopics: completedList,
      nextTopics: nextTopicsForSubject(subject, completedList),
    });
  } catch (error) {
    next(error);
  }
}

export async function getLearningProgress(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rows = await prisma.learningProgress.findMany({
      where: { userId: req.userId },
      orderBy: { lastAccessedAt: 'desc' },
    });
    res.json(rows.map(row => ({
      ...row,
      completedTopics: parseStringList(row.completedTopics),
    })));
  } catch (error) {
    next(error);
  }
}
