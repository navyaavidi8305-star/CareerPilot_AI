import { Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import {
  analyzeResumeWithAI,
  generateCareerRecommendations,
  generateLocalSkillGaps,
  generateRoadmap,
  getRoleSkillSet,
} from '../utils/openai';
import { canonicalSkillName, isDuplicateKey, skillKey } from '../utils/skillGapUtils';

export const uploadsDir = path.resolve(__dirname, '../../uploads');
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadsDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

export const upload = multer({
  storage,
  fileFilter: (_req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc', '.txt', '.rtf'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, DOCX, DOC, TXT, and RTF files are allowed'));
    }
  },
  limits: { fileSize: 10 * 1024 * 1024 },
});

export async function uploadResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

    const filePath = req.file.path;
    const fileName = req.file.originalname;
    const ext = path.extname(fileName).toLowerCase();
    const fileType = ext === '.pdf' ? 'PDF' : ext === '.docx' ? 'DOCX' : ext === '.doc' ? 'DOC' : 'TXT';

    let resumeText = '';
    try {
      if (fileType === 'PDF') {
        const pdf = require('pdf-parse');
        const dataBuffer = fs.readFileSync(filePath);
        const pdfData = await pdf(dataBuffer);
        resumeText = pdfData.text || '';
      } else if (fileType === 'DOCX' || fileType === 'DOC') {
        const mammoth = require('mammoth');
        const result = await mammoth.extractRawText({ path: filePath });
        resumeText = result.value || '';
      } else {
        resumeText = fs.readFileSync(filePath, 'utf-8');
      }
    } catch (parseErr) {
      console.error('File parsing error:', parseErr);
      resumeText = 'Could not parse resume file content.';
    }

    const analysis = await analyzeResumeWithAI(resumeText);

    const profile = await prisma.profile.findUnique({ where: { userId: req.userId } });

    await prisma.resume.updateMany({
      where: { userId: req.userId, isActive: true },
      data: { isActive: false },
    });

    const resume = await prisma.resume.create({
      data: {
        userId: req.userId!,
        fileName,
        filePath,
        fileType,
        parsedData: JSON.stringify(analysis),
        resumeScore: analysis.resumeScore,
        atsScore: analysis.atsScore,
        careerReadiness: analysis.careerReadiness,
        employabilityScore: analysis.employabilityScore,
        strengths: JSON.stringify(analysis.strengths || []),
        weaknesses: JSON.stringify(analysis.weaknesses || []),
      },
    });

    if (analysis.education && profile) {
      await prisma.profile.update({
        where: { id: profile.id },
        data: { education: analysis.education },
      });
    }

    if (analysis.skills && profile) {
      const existingSkills = await prisma.skill.findMany({
        where: { profileId: profile.id },
        select: { name: true },
      });
      const existingKeys = existingSkills.map(s => skillKey(canonicalSkillName(s.name)));
      for (const rawSkill of analysis.skills) {
        const skillName = canonicalSkillName(typeof rawSkill === 'string' ? rawSkill : rawSkill?.name);
        const key = skillKey(skillName);
        if (!key || existingKeys.some(existing => isDuplicateKey(existing, key))) continue;
        await prisma.skill.create({
          data: {
            profileId: profile.id,
            name: skillName,
            category: typeof rawSkill === 'object' ? rawSkill?.category : undefined,
          },
        });
        existingKeys.push(key);
      }
    }

    if (analysis.projects && profile) {
      for (const proj of analysis.projects) {
        await prisma.project.create({
          data: {
            profileId: profile.id,
            title: proj.title || 'Project',
            description: proj.description,
            technologies: Array.isArray(proj.technologies) ? proj.technologies.join(', ') : '',
          },
        });
      }
    }

    if (analysis.internships && profile) {
      for (const intern of analysis.internships) {
        await prisma.internship.create({
          data: {
            profileId: profile.id,
            company: intern.company || 'Company',
            position: intern.position || 'Position',
            description: intern.description,
          },
        });
      }
    }

    res.json(resume);

    processResumeAnalysis(req.userId!, resume.id, analysis);
  } catch (error) {
    next(error);
  }
}

export async function getResumes(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const resumes = await prisma.resume.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(resumes);
  } catch (error) {
    next(error);
  }
}

export async function getLatestResume(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const resume = await prisma.resume.findFirst({
      where: { userId: req.userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    if (!resume) return res.status(404).json({ error: 'No resume found' });
    res.json(resume);
  } catch (error) {
    next(error);
  }
}

async function processResumeAnalysis(userId: string, resumeId: string, analysis: any) {
  try {
    const profile = await prisma.profile.findUnique({
      where: { userId },
      include: { skills: true },
    });
    const profileSkills = profile?.skills?.map(s => s.name) || [];
    const resumeSkills = (Array.isArray(analysis.skills) ? analysis.skills : [])
      .map((s: any) => (typeof s === 'string' ? s : s?.name))
      .filter(Boolean);
    const userSkills: string[] = [...new Set([...profileSkills, ...resumeSkills])];
    const marketTrends = await prisma.marketInsight.findMany({ orderBy: { createdAt: 'desc' }, take: 20 });

    const aiRecommendations = await generateCareerRecommendations(
      { education: analysis.education, experience: analysis.experience, interests: '' },
      userSkills,
      '',
      marketTrends
    );

    for (const rec of aiRecommendations.slice(0, 3)) {
      await prisma.recommendation.create({
        data: {
          userId,
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
          verificationSource: rec.confidenceScore >= 60 ? 'AI Analysis + Resume Validation' : 'Low confidence based on resume',
        },
      });
    }

    const topRecForGaps = aiRecommendations[0];
    if (topRecForGaps) {
      const roleSkills = getRoleSkillSet(topRecForGaps.careerTitle);
      const roleBaseline = [...roleSkills.core, ...roleSkills.advanced];
      const baselineSkills = roleBaseline.length > 0 ? roleBaseline : (topRecForGaps.requiredSkills || []);

      const userSkillKeys = userSkills
        .map(name => skillKey(canonicalSkillName(name)))
        .filter(Boolean);
      const targetKeys: string[] = [];
      const targetSkills: string[] = [];
      for (const rawSkill of baselineSkills) {
        const skillName = canonicalSkillName(rawSkill);
        const key = skillKey(skillName);
        if (!key) continue;
        if (userSkillKeys.some(existing => isDuplicateKey(existing, key))) continue;
        if (targetKeys.some(existing => isDuplicateKey(existing, key))) continue;
        targetKeys.push(key);
        targetSkills.push(skillName);
      }

      await prisma.skillGap.deleteMany({ where: { userId } });

      const gaps = generateLocalSkillGaps(userSkills, targetSkills, topRecForGaps.careerTitle).slice(0, 15);
      for (const gap of gaps) {
        await prisma.skillGap.create({
          data: {
            userId,
            skillName: gap.skillName,
            currentLevel: gap.currentLevel,
            requiredLevel: gap.requiredLevel,
            gap: gap.gap,
            priority: gap.priority,
            category: gap.category,
          },
        });
      }
    }

    const topRec = aiRecommendations[0];
    if (topRec) {
      const aiRoadmap = await generateRoadmap(topRec.careerTitle, userSkills, { learningSpeed: 'MODERATE', availableTime: '2 hours per day' });

      await prisma.roadmap.updateMany({
        where: { userId, isCurrent: true },
        data: { isCurrent: false },
      });

      await prisma.roadmap.create({
        data: {
          userId,
          title: aiRoadmap.title || `Roadmap to ${topRec.careerTitle}`,
          description: aiRoadmap.description || 'Auto-generated from resume analysis',
          careerGoal: topRec.careerTitle,
          duration: aiRoadmap.duration || '6 months',
          isCurrent: true,
          tasks: {
            create: (aiRoadmap.tasks || []).map((task: any, index: number) => ({
              title: task.title || `Step ${index + 1}`,
              description: task.description || '',
              type: task.type || 'DAILY',
              priority: task.priority || 'MEDIUM',
              order: index + 1,
              resources: JSON.stringify(task.resources || []),
              dueDate: new Date(Date.now() + (index + 1) * 7 * 24 * 60 * 60 * 1000),
            })),
          },
        },
      });
    }

    await prisma.notification.create({
      data: {
        userId,
        title: 'Resume Analysis Complete',
        message: `Your resume has been analyzed. Score: ${analysis.resumeScore || 0}%. ${aiRecommendations.length} career paths identified.`,
        type: 'MILESTONE',
      },
    });
  } catch (err) {
    console.error('Background resume processing failed:', err);
  }
}
