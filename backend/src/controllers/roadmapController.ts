import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import { generateRoadmap } from '../utils/openai';

export async function getRoadmaps(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roadmaps = await prisma.roadmap.findMany({
      where: { userId: req.userId },
      include: { tasks: { orderBy: { order: 'asc' } } },
      orderBy: { createdAt: 'desc' },
    });
    res.json(roadmaps);
  } catch (error) {
    next(error);
  }
}

export async function getCurrentRoadmap(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const roadmap = await prisma.roadmap.findFirst({
      where: { userId: req.userId, isCurrent: true },
      include: { tasks: { orderBy: { order: 'asc' } } },
    });
    if (!roadmap) return res.status(404).json({ error: 'No active roadmap' });
    res.json(roadmap);
  } catch (error) {
    next(error);
  }
}

export async function generateNewRoadmap(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { careerGoal, learningSpeed, availableTime, salaryGoal, preferredCompany, domain, months } = req.body;

    if (!careerGoal) return res.status(400).json({ error: 'Career goal is required' });

    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      include: { skills: true },
    });

    const userSkills = profile?.skills?.map(s => s.name) || [];

    const aiRoadmap = await generateRoadmap(careerGoal, userSkills, {
      learningSpeed,
      availableTime,
      salaryGoal,
      preferredCompany,
      domain: domain || undefined,
      months: months ? Number(months) : undefined,
    });

    await prisma.roadmap.updateMany({
      where: { userId: req.userId, isCurrent: true },
      data: { isCurrent: false },
    });

    const roadmap = await prisma.roadmap.create({
      data: {
        userId: req.userId!,
        title: aiRoadmap.title || `Roadmap to ${careerGoal}`,
        description: aiRoadmap.description || '',
        careerGoal,
        duration: months ? `${months} months` : aiRoadmap.duration || '6 months',
        learningSpeed: learningSpeed || 'MODERATE',
        availableTime: availableTime || '2 hours per day',
        salaryGoal,
        preferredCompany,
        domainPreference: domain,
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
      include: { tasks: { orderBy: { order: 'asc' } } },
    });

    const requiredSkills = aiRoadmap.tasks
      ?.filter((t: any) => t.type === 'CERTIFICATION' || t.type === 'PROJECT')
      .map((t: any) => t.title) || [];

    await prisma.notification.create({
      data: {
        userId: req.userId!,
        title: 'New Roadmap Generated',
        message: `Your roadmap for ${careerGoal} has been created with ${aiRoadmap.tasks?.length || 0} tasks.`,
        type: 'ROADMAP_UPDATED',
      },
    });

    res.json(roadmap);
  } catch (error) {
    next(error);
  }
}

export async function updateTaskStatus(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    const existing = await prisma.task.findFirst({
      where: { id: taskId, roadmap: { userId: req.userId } },
    });
    if (!existing) return res.status(404).json({ error: 'Task not found' });

    const task = await prisma.task.update({
      where: { id: taskId },
      data: {
        status,
        completedAt: status === 'COMPLETED' ? new Date() : undefined,
      },
    });

    if (status === 'COMPLETED') {
      await prisma.notification.create({
        data: {
          userId: req.userId!,
          title: 'Task Completed',
          message: `You completed: ${task.title}`,
          type: 'MILESTONE',
        },
      });
    }

    res.json(task);
  } catch (error) {
    next(error);
  }
}

export async function regenerateRoadmap(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { roadmapId } = req.params;
    const modifications = req.body;

    const existing = await prisma.roadmap.findFirst({
      where: { id: roadmapId, userId: req.userId },
      include: { tasks: true },
    });

    if (!existing) return res.status(404).json({ error: 'Roadmap not found' });

    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      include: { skills: true },
    });

    const userSkills = profile?.skills?.map(s => s.name) || [];
    const mergedPreferences = {
      learningSpeed: modifications.learningSpeed || existing.learningSpeed,
      availableTime: modifications.availableTime || existing.availableTime,
      salaryGoal: modifications.salaryGoal || existing.salaryGoal,
      preferredCompany: modifications.preferredCompany || existing.preferredCompany,
      domain: modifications.domain || existing.domainPreference,
      months: modifications.months ? Number(modifications.months) : undefined,
    };

    const aiRoadmap = await generateRoadmap(
      modifications.careerGoal || existing.careerGoal || '',
      userSkills,
      mergedPreferences
    );

    await prisma.task.deleteMany({ where: { roadmapId } });

    const updated = await prisma.roadmap.update({
      where: { id: roadmapId },
      data: {
        title: aiRoadmap.title || existing.title,
        description: aiRoadmap.description || existing.description,
        careerGoal: modifications.careerGoal || existing.careerGoal,
        learningSpeed: mergedPreferences.learningSpeed,
        availableTime: mergedPreferences.availableTime,
        salaryGoal: mergedPreferences.salaryGoal,
        preferredCompany: mergedPreferences.preferredCompany,
        domainPreference: mergedPreferences.domain || existing.domainPreference,
        duration: modifications.months ? `${modifications.months} months` : existing.duration,
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
      include: { tasks: { orderBy: { order: 'asc' } } },
    });

    await prisma.notification.create({
      data: {
        userId: req.userId!,
        title: 'Roadmap Updated',
        message: `Your roadmap has been regenerated based on your preferences.`,
        type: 'ROADMAP_UPDATED',
      },
    });

    res.json(updated);
  } catch (error) {
    next(error);
  }
}
