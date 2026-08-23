import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import { generateSkillGapAnalysis } from '../utils/openai';
import { skillKey, isDuplicateKey, sanitizeGaps } from '../utils/skillGapUtils';

export async function getSkillGaps(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const gaps = await prisma.skillGap.findMany({
      where: { userId: req.userId },
      orderBy: [{ priority: 'asc' }, { gap: 'desc' }],
    });
    res.json(gaps);
  } catch (error) {
    next(error);
  }
}

export async function analyzeSkillGaps(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      include: { skills: true },
    });

    const userSkills = profile?.skills || [];
    const currentSkills = userSkills.map(s =>
      s.level ? `${s.name} (${String(s.level).toUpperCase()})` : s.name
    );

    const recommendations = await prisma.recommendation.findMany({
      where: { userId: req.userId },
      orderBy: { matchPercentage: 'desc' },
      take: 3,
    });

    const targetSkillsSet = new Set<string>();
    for (const rec of recommendations) {
      const skills = JSON.parse(rec.requiredSkills || '[]');
      for (const s of skills) targetSkillsSet.add(s);
    }

    let targetSkills = [...targetSkillsSet];
    const normalized = new Set<string>();
    targetSkills = targetSkills.filter(s => {
      const norm = skillKey(s);
      if (!norm || [...normalized].some(n => isDuplicateKey(n, norm))) return false;
      normalized.add(norm);
      return true;
    });
    if (targetSkills.length === 0) {
      targetSkills = ['JavaScript', 'Python', 'SQL', 'Data Structures', 'Algorithms', 'Communication'];
    }

    const aiGaps = await generateSkillGapAnalysis(currentSkills, targetSkills);

    const cleanedGaps = sanitizeGaps(aiGaps, userSkills);

    await prisma.skillGap.deleteMany({ where: { userId: req.userId } });

    const savedGaps = [];
    for (const gap of cleanedGaps.slice(0, 15)) {
      const saved = await prisma.skillGap.create({
        data: {
          userId: req.userId!,
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
    const gap = await prisma.skillGap.update({
      where: { id },
      data: { isBeingAddressed },
    });
    res.json(gap);
  } catch (error) {
    next(error);
  }
}
