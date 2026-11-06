import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import { generateSkillGapAnalysis, generateLocalSkillGaps, getRoleSkillSet } from '../utils/openai';
import {
  skillKey,
  isDuplicateKey,
  sanitizeGaps,
  buildUserSkillIndex,
  canonicalSkillName,
} from '../utils/skillGapUtils';

export async function getSkillGaps(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const role = String(req.query.role || '').trim();
    const gaps = await prisma.skillGap.findMany({
      where: { userId: req.userId },
      orderBy: [{ priority: 'asc' }, { gap: 'desc' }],
    });
    res.json(role
      ? gaps.filter(gap => gap.targetRole?.trim().toLowerCase() === role.toLowerCase())
      : gaps);
  } catch (error) {
    next(error);
  }
}

function parseSkillList(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((s: any) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

export async function analyzeSkillGaps(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [profile, recommendations, currentRoadmap, acceptedRecommendation] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: req.userId },
        include: { skills: true },
      }),
      prisma.recommendation.findMany({
        where: { userId: req.userId },
        orderBy: { matchPercentage: 'desc' },
        take: 3,
      }),
      prisma.roadmap.findFirst({
        where: { userId: req.userId, isCurrent: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.recommendation.findFirst({
        where: { userId: req.userId, isAccepted: true },
        orderBy: { matchPercentage: 'desc' },
      }),
    ]);

    const userSkills = profile?.skills || [];
    const currentSkills = userSkills.map(s =>
      s.level ? `${s.name} (${String(s.level).toUpperCase()})` : s.name
    );

    const requestedRole = typeof req.body?.targetRole === 'string' ? req.body.targetRole.trim() : '';
    const profileGoal = (profile?.careerGoals || '').split(/[,;|]/)[0]?.trim();
    // One explicit target role only. Never blend requirements from multiple recommendations.
    const targetRole =
      requestedRole ||
      profile?.targetRole ||
      acceptedRecommendation?.careerTitle ||
      currentRoadmap?.careerGoal ||
      profileGoal ||
      recommendations[0]?.careerTitle ||
      '';

    if (requestedRole && requestedRole !== profile?.targetRole) {
      await prisma.profile.update({
        where: { userId: req.userId },
        data: { targetRole: requestedRole },
      }).catch(() => undefined);
    }

    const roleSkills = targetRole ? getRoleSkillSet(targetRole) : { core: [], advanced: [] };
    const baseline: string[] = [...roleSkills.core, ...roleSkills.advanced];

    // If the role is not in the built-in catalogue, use the required skills from the
    // recommendation for that exact role (not from the other recommendations).
    if (baseline.length === 0 && targetRole) {
      const roleKey = targetRole.trim().toLowerCase();
      const matchingRec = [acceptedRecommendation, ...recommendations].find(
        rec => rec && rec.careerTitle.trim().toLowerCase() === roleKey
      );
      if (matchingRec) baseline.push(...parseSkillList(matchingRec.requiredSkills));
    }

    if (!targetRole) {
      baseline.push('Communication', 'Problem Solving', 'Time Management', 'Data Literacy', 'Project Management');
    }

    // Keep every role requirement in the baseline. A skill the user already lists must
    // still be compared against the required level for this role.
    const normalizedKeys: string[] = [];
    const targetSkills = baseline
      .map(s => canonicalSkillName(s))
      .filter(s => {
        const key = skillKey(s);
        if (!key || key.length < 2) return false;
        if (normalizedKeys.some(existing => isDuplicateKey(existing, key))) return false;
        normalizedKeys.push(key);
        return true;
      });

    const aiGaps = await generateSkillGapAnalysis(currentSkills, targetSkills, targetRole);

    const targetKeys = targetSkills.map(s => skillKey(s));
    const matchesTarget = (name: string) => {
      if (targetKeys.length === 0) return true;
      const key = skillKey(name);
      return targetKeys.some(targetKey => isDuplicateKey(targetKey, key));
    };

    const aiCleaned = sanitizeGaps(aiGaps, userSkills).filter(gap => matchesTarget(gap.skillName));

    const localGaps = targetSkills.length > 0
      ? generateLocalSkillGaps(currentSkills, targetSkills, targetRole)
      : [];

    const aiByKey = new Map<string, any>();
    for (const gap of aiCleaned) {
      const key = skillKey(gap.skillName);
      if (!aiByKey.has(key)) aiByKey.set(key, gap);
    }
    const findAiGap = (name: string) => {
      const key = skillKey(name);
      const direct = aiByKey.get(key);
      if (direct) return direct;
      for (const [aiKey, gap] of aiByKey.entries()) {
        if (isDuplicateKey(aiKey, key)) return gap;
      }
      return null;
    };

    const seenKeys: string[] = [];
    const mergedGaps: any[] = [];
    const addGap = (gap: any, aiHint?: any) => {
      const key = skillKey(gap.skillName);
      if (!key) return;
      if (seenKeys.some(existing => isDuplicateKey(existing, key))) return;
      seenKeys.push(key);
      mergedGaps.push({
        ...gap,
        priority: aiHint?.priority || gap.priority,
        category: aiHint?.category || gap.category,
      });
    };

    for (const gap of localGaps) addGap(gap, findAiGap(gap.skillName));
    // With no baseline target skills, keep the AI's role-derived gaps.
    for (const gap of aiCleaned) addGap(gap);

    const levelRank: Record<string, number> = {
      NONE: 0, BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4,
    };
    const cleanedGaps = mergedGaps
      .filter(gap => (levelRank[String(gap.currentLevel || 'NONE').toUpperCase()] ?? 0) <
        (levelRank[String(gap.requiredLevel || 'INTERMEDIATE').toUpperCase()] ?? 2))
      .slice(0, 15);

    await prisma.skillGap.deleteMany({ where: { userId: req.userId } });

    const savedGaps = [];
    for (const gap of cleanedGaps) {
      const saved = await prisma.skillGap.create({
        data: {
          userId: req.userId!,
          targetRole: targetRole || null,
          skillName: gap.skillName,
          currentLevel: gap.currentLevel,
          requiredLevel: gap.requiredLevel,
          gap: gap.gap,
          priority: gap.priority,
          category: gap.category,
        },
      });
      savedGaps.push(saved);
    }

    res.json(savedGaps);
  } catch (error) {
    next(error);
  }
}

export async function updateSkillGap(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { isBeingAddressed } = req.body;
    const existing = await prisma.skillGap.findFirst({ where: { id, userId: req.userId } });
    if (!existing) return res.status(404).json({ error: 'Skill gap not found' });

    const gap = await prisma.skillGap.update({
      where: { id },
      data: { isBeingAddressed },
    });
    res.json(gap);
  } catch (error) {
    next(error);
  }
}
