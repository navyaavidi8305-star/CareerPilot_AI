import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import { profileSchema } from '../utils/validators';

export async function getProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      include: {
        skills: true,
        certifications: true,
        projects: true,
        internships: true,
      },
    });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function updateProfile(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const data = profileSchema.parse(req.body);
    const profile = await prisma.profile.update({
      where: { userId: req.userId },
      data,
    });
    res.json(profile);
  } catch (error) {
    next(error);
  }
}

export async function getUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.userId },
      select: {
        id: true, fullName: true, email: true, mobile: true,
        role: true, isVerified: true, avatar: true, createdAt: true,
      },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function updateUser(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { fullName, mobile } = req.body;
    const user = await prisma.user.update({
      where: { id: req.userId },
      data: { fullName, mobile },
      select: {
        id: true, fullName: true, email: true, mobile: true,
        role: true, isVerified: true, avatar: true,
      },
    });
    res.json(user);
  } catch (error) {
    next(error);
  }
}

export async function addSkill(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { name, category, level } = req.body;
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const skill = await prisma.skill.create({
      data: { profileId: profile.id, name, category, level },
    });

    await prisma.skillProgress.create({
      data: { skillId: skill.id, userId: req.userId! },
    });

    res.json(skill);
  } catch (error) {
    next(error);
  }
}

export async function updateSkill(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { level, category } = req.body;
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const existing = await prisma.skill.findFirst({ where: { id, profileId: profile.id } });
    if (!existing) return res.status(404).json({ error: 'Skill not found' });

    const skill = await prisma.skill.update({
      where: { id },
      data: { level, category },
    });
    res.json(skill);
  } catch (error) {
    next(error);
  }
}

export async function deleteSkill(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const existing = await prisma.skill.findFirst({ where: { id, profileId: profile.id } });
    if (!existing) return res.status(404).json({ error: 'Skill not found' });

    await prisma.skill.delete({ where: { id } });
    res.json({ message: 'Skill deleted' });
  } catch (error) {
    next(error);
  }
}

function parseOptionalDate(value: any): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}

function stringifyOptionalList(value: any): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value === 'string') return value;
  try {
    return JSON.stringify(value);
  } catch {
    return undefined;
  }
}

export async function addCertification(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { name, issuer, issueDate, expiryDate, credentialId, url } = req.body;
    if (!name) return res.status(400).json({ error: 'Certification name is required' });

    const cert = await prisma.certification.create({
      data: {
        profileId: profile.id,
        name,
        issuer,
        issueDate: parseOptionalDate(issueDate),
        expiryDate: parseOptionalDate(expiryDate),
        credentialId,
        url,
      },
    });
    res.json(cert);
  } catch (error) {
    next(error);
  }
}

export async function addProject(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { title, description, technologies, url, startDate, endDate } = req.body;
    if (!title) return res.status(400).json({ error: 'Project title is required' });

    const project = await prisma.project.create({
      data: {
        profileId: profile.id,
        title,
        description,
        technologies: stringifyOptionalList(technologies),
        url,
        startDate: parseOptionalDate(startDate),
        endDate: parseOptionalDate(endDate),
      },
    });
    res.json(project);
  } catch (error) {
    next(error);
  }
}

export async function addInternship(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });
    if (!profile) return res.status(404).json({ error: 'Profile not found' });

    const { company, position, description, startDate, endDate, skills } = req.body;
    if (!company || !position) return res.status(400).json({ error: 'Company and position are required' });

    const internship = await prisma.internship.create({
      data: {
        profileId: profile.id,
        company,
        position,
        description,
        startDate: parseOptionalDate(startDate),
        endDate: parseOptionalDate(endDate),
        skills: stringifyOptionalList(skills),
      },
    });
    res.json(internship);
  } catch (error) {
    next(error);
  }
}

export async function getDashboard(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const userId = req.userId!;

    const [profile, resumes, recommendations, roadmaps, skillGaps, interviews] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId },
        include: { skills: true },
      }),
      prisma.resume.findMany({ where: { userId, isActive: true }, orderBy: { createdAt: 'desc' } }),
      prisma.recommendation.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
      prisma.roadmap.findMany({ where: { userId, isCurrent: true }, include: { tasks: true } }),
      prisma.skillGap.findMany({ where: { userId } }),
      prisma.interview.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const latestResume = resumes[0];
    const activeRoadmap = roadmaps[0];
    const totalTasks = activeRoadmap?.tasks?.length || 0;
    const completedTasks = activeRoadmap?.tasks?.filter(t => t.status === 'COMPLETED')?.length || 0;

    const skillsCount = profile?.skills?.length || 0;
    const skillGapsCount = skillGaps.filter(sg => sg.priority === 'CRITICAL').length;
    const interviewAvg = interviews
      .filter(i => i.overallScore)
      .reduce((acc, i) => acc + (i.overallScore || 0), 0) / (interviews.filter(i => i.overallScore).length || 1);

    const dashboard = {
      careerReadinessScore: latestResume?.careerReadiness || (profile?.skills?.length ? Math.min(profile.skills.length * 10, 100) : 0),
      placementReadinessScore: latestResume?.employabilityScore || 0,
      resumeScore: latestResume?.resumeScore || 0,
      atsScore: latestResume?.atsScore || 0,
      interviewReadiness: Math.round(interviewAvg) || 0,
      skillReadiness: skillsCount > 0 ? Math.min(Math.round((skillsCount / (skillsCount + skillGapsCount)) * 100), 100) : 0,
      learningProgress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      roadmapProgress: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      missingSkills: skillGapsCount,
      learningStreak: 0,
      marketAlignmentScore: recommendations[0]?.matchPercentage || 0,
      skillsCount,
      totalTasks,
      completedTasks,
      recommendationsCount: recommendations.length,
      interviewsCompleted: interviews.filter(i => i.status === 'COMPLETED').length,
    };

    res.json(dashboard);
  } catch (error) {
    next(error);
  }
}
