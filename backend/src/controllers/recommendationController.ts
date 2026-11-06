import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import { generateCareerRecommendations, generateRoadmap, getRoleSkillSet } from '../utils/openai';
import { canonicalSkillName, isDuplicateKey, normalizeUserSkillLevel, skillKey } from '../utils/skillGapUtils';
import { getRoleRequirement } from '../utils/careerCatalog';

export async function getRecommendations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const all = await prisma.recommendation.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    const seen = new Set<string>();
    const deduped: typeof all = [];
    const toDelete: string[] = [];
    for (const rec of all) {
      const key = rec.careerTitle.toLowerCase();
      if (seen.has(key)) {
        toDelete.push(rec.id);
      } else {
        seen.add(key);
        deduped.push(rec);
      }
    }
    if (toDelete.length > 0) {
      await prisma.recommendation.deleteMany({ where: { id: { in: toDelete } } });
    }
    res.json(deduped);
  } catch (error) {
    next(error);
  }
}

export async function generateRecommendations(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [profile, marketTrends] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: req.userId },
        include: { skills: true },
      }),
      prisma.marketInsight.findMany({ orderBy: { createdAt: 'desc' }, take: 20 }),
    ]);

    const userSkills = profile?.skills?.map(s => s.name) || [];
    const userGoals = profile?.careerGoals || '';
    const interests = profile?.interests || '';

    const aiRecommendations = await generateCareerRecommendations(profile, userSkills, userGoals || interests, marketTrends);

    await prisma.recommendation.deleteMany({ where: { userId: req.userId } });

    let savedRecommendations = [];
    for (const rec of aiRecommendations) {
      const saved = await prisma.recommendation.create({
        data: {
          userId: req.userId!,
          careerTitle: rec.careerTitle,
          matchPercentage: rec.matchPercentage,
          confidenceScore: rec.confidenceScore,
          salaryInsights: JSON.stringify(rec.salaryInsights || {}),
          industryDemand: rec.industryDemand,
          growthPotential: rec.growthPotential,
          requiredSkills: JSON.stringify(rec.requiredSkills || []),
          reasons: JSON.stringify(rec.reasons || []),
          influencingSkills: JSON.stringify(rec.influencingSkills || []),
          influencingGoals: JSON.stringify(rec.influencingGoals || []),
          isVerified: rec.confidenceScore >= 60,
          verificationSource: rec.confidenceScore >= 60 ? 'AI Analysis + Market Validation' : 'Low confidence - needs more data',
        },
      });
      savedRecommendations.push(saved);
    }

    if (savedRecommendations.length === 0) {
      return res.status(500).json({ error: 'Could not generate recommendations' });
    }

    res.json(savedRecommendations);
  } catch (error) {
    next(error);
  }
}

export async function acceptRecommendation(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const existingRec = await prisma.recommendation.findFirst({
      where: { id, userId: req.userId },
    });
    if (!existingRec) return res.status(404).json({ error: 'Recommendation not found' });

    if (existingRec.isAccepted) {
      const existingRoadmap = await prisma.roadmap.findFirst({
        where: { userId: req.userId, careerGoal: existingRec.careerTitle },
        orderBy: { createdAt: 'desc' },
      });
      if (existingRoadmap) {
        return res.json({ recommendation: existingRec, roadmapId: existingRoadmap.id });
      }
    }

    const rec = await prisma.recommendation.update({
      where: { id },
      data: { isAccepted: true },
    });

    const requiredSkills: string[] = JSON.parse(rec.requiredSkills || '[]');
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      include: { skills: true },
    });
    const existingSkills = profile?.skills?.map(s => s.name) || [];
    const existingSkillKeys = existingSkills
      .map(name => skillKey(canonicalSkillName(name)))
      .filter(Boolean);
    const isUserSkill = (name: string) => {
      const key = skillKey(canonicalSkillName(name));
      return existingSkillKeys.some(existingKey => isDuplicateKey(existingKey, key));
    };

    const roleSkills = getRoleSkillSet(rec.careerTitle);
    const roleBaseline = [...roleSkills.core, ...roleSkills.advanced];
    const baselineSkills = roleBaseline.length > 0 ? roleBaseline : requiredSkills;

    const userSkillByName = new Map<string, { level: string; category?: string | null }>();
    for (const item of profile?.skills || []) {
      userSkillByName.set(skillKey(canonicalSkillName(item.name)), {
        level: normalizeUserSkillLevel(item.level),
        category: item.category,
      });
    }
    const levelRank: Record<string, number> = {
      NONE: 0, BEGINNER: 1, INTERMEDIATE: 2, ADVANCED: 3, EXPERT: 4,
    };

    const gapKeys: string[] = [];
    const gapRecords: {
      skillName: string;
      currentLevel: string;
      requiredLevel: string;
      gap: number;
      priority: string;
      category: string;
    }[] = [];

    for (const rawSkill of baselineSkills) {
      const skillName = canonicalSkillName(rawSkill);
      const key = skillKey(skillName);
      if (!key) continue;
      if (gapKeys.some(existing => isDuplicateKey(existing, key))) continue;
      gapKeys.push(key);

      const requirement = getRoleRequirement(rec.careerTitle, skillName);
      const isAdvancedRoleSkill = roleSkills.advanced.some(
        s => isDuplicateKey(skillKey(s), key)
      );
      const requiredLevel = requirement?.level || (isAdvancedRoleSkill ? 'ADVANCED' : 'INTERMEDIATE');
      const currentLevel = isUserSkill(skillName)
        ? (userSkillByName.get(key)?.level || 'INTERMEDIATE')
        : 'NONE';
      if ((levelRank[currentLevel] ?? 0) >= (levelRank[requiredLevel] ?? 2)) continue;

      const gap = Math.max(0, Math.min(100,
        ((levelRank[requiredLevel] ?? 2) - (levelRank[currentLevel] ?? 0)) * 25
      ));
      gapRecords.push({
        skillName,
        currentLevel,
        requiredLevel,
        gap,
        priority: requirement && (requirement.level === 'ADVANCED')
          ? 'RECOMMENDED'
          : gapRecords.length < 5 ? 'CRITICAL' : 'RECOMMENDED',
        category: userSkillByName.get(key)?.category || requirement?.category || 'TECHNICAL',
      });
    }

    await prisma.skillGap.deleteMany({ where: { userId: req.userId } });
    for (const gap of gapRecords.slice(0, 15)) {
      await prisma.skillGap.create({
        data: {
          userId: req.userId!,
          targetRole: rec.careerTitle,
          ...gap,
        },
      });
    }

    await prisma.profile.update({
      where: { userId: req.userId },
      data: { targetRole: rec.careerTitle },
    }).catch(() => undefined);

    const userSkills = existingSkills;
    const aiRoadmap = await generateRoadmap(rec.careerTitle, userSkills, {});
    await prisma.roadmap.updateMany({
      where: { userId: req.userId, isCurrent: true },
      data: { isCurrent: false },
    });
    const roadmap = await prisma.roadmap.create({
      data: {
        userId: req.userId!,
        title: aiRoadmap.title || `Roadmap to ${rec.careerTitle}`,
        description: aiRoadmap.description || '',
        careerGoal: rec.careerTitle,
        duration: aiRoadmap.duration || '6 months',
        isCurrent: true,
        tasks: {
          create: (aiRoadmap.tasks || []).map((task: any, index: number) => ({
            title: task.title || `Task ${index + 1}`,
            description: task.description || '',
            type: task.type || 'DAILY',
            priority: task.priority || 'MEDIUM',
            order: index + 1,
            resources: JSON.stringify(task.resources || []),
            subtopics: JSON.stringify(task.subtopics || []),
            dueDate: new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000),
          })),
        },
      },
    });
    await prisma.notification.create({
      data: {
        userId: req.userId!,
        title: 'Roadmap Created',
        message: `Your roadmap for ${rec.careerTitle} is ready.`,
        type: 'ROADMAP_UPDATED',
      },
    });

    res.json({ recommendation: rec, roadmapId: roadmap.id });
  } catch (error) {
    next(error);
  }
}

export async function getRecommendationById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const rec = await prisma.recommendation.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!rec) return res.status(404).json({ error: 'Recommendation not found' });
    res.json(rec);
  } catch (error) {
    next(error);
  }
}
