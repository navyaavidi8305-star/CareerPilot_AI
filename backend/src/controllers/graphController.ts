import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import {
  getRoleDetails,
  getRoleMatchDetails,
  getRoleRequiredSkills,
  resolveRole,
} from '../utils/careerCatalog';
import { canonicalSkillName, isDuplicateKey, skillKey } from '../utils/skillGapUtils';
import { subjectsForSkills } from '../utils/learningCatalog';

const COLORS: Record<string, string> = {
  profile: '#94a3b8',
  education: '#f59e0b',
  goal: '#8b5cf6',
  skill: '#6366f1',
  gap: '#ef4444',
  career: '#22c55e',
  learning: '#ec4899',
  roadmap: '#06b6d4',
  project: '#14b8a6',
};

function parseStringList(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed.filter((s: any) => typeof s === 'string') : [];
  } catch {
    return [];
  }
}

function nodeId(prefix: string, value: string): string {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

export async function getKnowledgeGraph(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const [profile, gaps, recommendations, roadmaps] = await Promise.all([
      prisma.profile.findUnique({
        where: { userId: req.userId },
        include: { skills: true, certifications: true, projects: true },
      }),
      prisma.skillGap.findMany({ where: { userId: req.userId } }),
      prisma.recommendation.findMany({
        where: { userId: req.userId },
        orderBy: [{ isAccepted: 'desc' }, { matchPercentage: 'desc' }],
      }),
      prisma.roadmap.findMany({
        where: { userId: req.userId, isCurrent: true },
        include: { tasks: true },
        orderBy: { updatedAt: 'desc' },
        take: 1,
      }),
    ]);

    const nodes: any[] = [];
    const links: any[] = [];
    const seenNodes = new Set<string>();
    const seenLinks = new Set<string>();

    const addNode = (node: any) => {
      if (!node?.id || seenNodes.has(node.id)) return;
      seenNodes.add(node.id);
      nodes.push({ ...node, color: node.color || COLORS[node.type] || '#6366f1' });
    };
    const addLink = (source: string, target: string, type: string, label?: string) => {
      if (!source || !target || source === target) return;
      const key = source < target ? `${source}|${target}|${type}` : `${target}|${source}|${type}`;
      if (seenLinks.has(key)) return;
      seenLinks.add(key);
      links.push({ source, target, type, label: label || type });
    };

    const profileNode = 'profile-you';
    addNode({
      id: profileNode,
      label: profile?.currentPosition || 'You',
      type: 'profile',
      group: 'Profile',
      meta: {
        title: profile?.currentPosition || 'Your profile',
        bio: profile?.bio || '',
        experience: profile?.experience || '',
        targetRole: profile?.targetRole || '',
      },
    });

    const skillKeySet = new Set<string>();
    const skillNodeByKey = new Map<string, string>();
    for (const skill of profile?.skills || []) {
      const key = skillKey(canonicalSkillName(skill.name));
      if (!key || skillKeySet.has(key)) continue;
      skillKeySet.add(key);
      const id = `skill-${skill.id}`;
      skillNodeByKey.set(key, id);
      addNode({
        id,
        label: skill.name,
        type: 'skill',
        group: 'Your Skills',
        level: skill.level || 'INTERMEDIATE',
        meta: {
          skillName: skill.name,
          level: skill.level || 'INTERMEDIATE',
          category: skill.category || 'TECHNICAL',
          isVerified: skill.isVerified,
        },
      });
      addLink(profileNode, id, 'HAS_SKILL', 'has skill');
    }

    const gapNodeByKey = new Map<string, string>();
    for (const gap of gaps) {
      const key = skillKey(canonicalSkillName(gap.skillName));
      if (!key || gapNodeByKey.has(key)) continue;
      const subjects = subjectsForSkills([gap.skillName]);
      const id = `gap-${gap.id}`;
      gapNodeByKey.set(key, id);
      const existingSkillNode = skillNodeByKey.get(key);
      addNode({
        id,
        label: gap.skillName,
        type: 'gap',
        group: 'Missing Skills',
        priority: gap.priority,
        meta: {
          skillName: gap.skillName,
          currentLevel: gap.currentLevel || 'NONE',
          requiredLevel: gap.requiredLevel || 'INTERMEDIATE',
          gap: gap.gap ?? 0,
          priority: gap.priority || 'RECOMMENDED',
          targetRole: gap.targetRole || '',
          learningSubjectKey: subjects[0]?.key || null,
          learningSubjectTitle: subjects[0]?.title || null,
        },
      });
      if (existingSkillNode) addLink(existingSkillNode, id, 'BELOW_REQUIRED', 'below required level');
      else addLink(profileNode, id, 'NEEDS_SKILL', 'needs skill');
    }

    const addLearningNode = (subject: any, parentId: string) => {
      const id = `learning-${subject.key}`;
      addNode({
        id,
        label: subject.title,
        type: 'learning',
        group: 'Learning Paths',
        meta: {
          subjectKey: subject.key,
          description: subject.description,
          topics: subject.topics,
          skills: subject.skills,
          level: subject.level,
        },
      });
      addLink(parentId, id, 'LEARN_WITH', 'learn with');
      return id;
    };

    const education = (profile?.education || '').trim();
    const goal = (profile?.careerGoals || '').trim();
    let goalId: string | null = null;
    if (education) {
      const id = 'education';
      addNode({
        id,
        label: education.slice(0, 42),
        type: 'education',
        group: 'Education',
        meta: { education, institution: profile?.institution || '' },
      });
      addLink(id, profileNode, 'EDUCATED_AT', 'education');
    }
    if (goal) {
      goalId = 'goal';
      addNode({
        id: goalId,
        label: goal.slice(0, 42),
        type: 'goal',
        group: 'Career Goal',
        meta: { goal, targetRole: profile?.targetRole || '' },
      });
      addLink(profileNode, goalId, 'AIMS_FOR', 'goal');
    }

    const accepted = recommendations.find(rec => rec.isAccepted);
    const targetRole = profile?.targetRole || accepted?.careerTitle ||
      roadmaps[0]?.careerGoal || goal || recommendations[0]?.careerTitle || '';
    const roleDetails = targetRole ? getRoleDetails(targetRole) : null;
    const roleResolution = targetRole ? resolveRole(targetRole) : null;
    const targetRoleTitle = roleDetails?.title || targetRole;

    const careerNodeByTitle = new Map<string, string>();
    const careerNodes: any[] = [];
    const addCareerNode = (title: string, source: any, isTarget: boolean) => {
      const resolved = resolveRole(title);
      const canonicalTitle = resolved?.title || title;
      const titleKey = skillKey(canonicalTitle);
      if (!titleKey || careerNodeByTitle.has(titleKey)) return careerNodeByTitle.get(titleKey) || null;
      const id = `career-${titleKey}`;
      const details = getRoleDetails(canonicalTitle);
      const required = getRoleRequiredSkills(canonicalTitle);
      const match = getRoleMatchDetails(canonicalTitle, (profile?.skills || []).map(s => s.name));
      const subjects = subjectsForSkills([...required, ...(profile?.skills || []).map(s => s.name)]);
      const node = {
        id,
        label: canonicalTitle,
        type: 'career',
        group: 'Careers',
        match: source?.matchPercentage ?? match.matchPercentage,
        meta: {
          careerTitle: canonicalTitle,
          description: details?.description || '',
          category: details?.category || '',
          salaryRange: details?.salaryRange || '',
          demand: details?.demand || source?.industryDemand || '',
          growth: details?.growth || source?.growthPotential || '',
          requiredSkills: required,
          matchingSkills: match.matchingSkills,
          missingSkills: match.missingSkills,
          matchPercentage: source?.matchPercentage ?? match.matchPercentage,
          certifications: details?.certifications || [],
          interviewTopics: details?.interviewTopics || [],
          learningPaths: subjects.slice(0, 6).map(subject => ({
            key: subject.key,
            title: subject.title,
            description: subject.description,
            topics: subject.topics,
            skills: subject.skills,
            level: subject.level,
          })),
          isTarget,
        },
      };
      careerNodeByTitle.set(titleKey, id);
      careerNodes.push(node);
      addNode(node);
      return id;
    };

    for (const rec of recommendations) {
      const id = addCareerNode(rec.careerTitle, rec, !!rec.isAccepted || rec.careerTitle === targetRoleTitle);
      if (id && goalId) addLink(goalId, id, 'CAREER_PATH', 'career path');
    }
    if (targetRoleTitle && !careerNodeByTitle.has(skillKey(targetRoleTitle))) {
      addCareerNode(targetRoleTitle, accepted, true);
    }

    for (const career of careerNodes) {
      for (const required of career.meta.requiredSkills) {
        const key = skillKey(canonicalSkillName(required));
        const skillId = skillNodeByKey.get(key);
        const gapId = gapNodeByKey.get(key);
        if (skillId) addLink(skillId, career.id, 'MATCHES_REQUIREMENT', 'matches requirement');
        if (gapId) addLink(gapId, career.id, 'BLOCKS_ROLE', 'missing requirement');
      }
      for (const subject of career.meta.learningPaths || []) {
        addLearningNode(subject, career.id);
      }
    }

    for (const [key, gapId] of gapNodeByKey.entries()) {
      const matchingSubject = subjectsForSkills([key])[0] || subjectsForSkills([gaps.find(g => gapNodeByKey.get(skillKey(canonicalSkillName(g.skillName))) === gapId)?.skillName || key])[0];
      if (matchingSubject) addLearningNode(matchingSubject, gapId);
    }

    const roadmap = roadmaps[0];
    if (roadmap) {
      const roadmapId = `roadmap-${roadmap.id}`;
      addNode({
        id: roadmapId,
        label: roadmap.title,
        type: 'roadmap',
        group: 'Roadmap',
        meta: {
          title: roadmap.title,
          description: roadmap.description,
          duration: roadmap.duration,
          careerGoal: roadmap.careerGoal,
          totalTasks: roadmap.tasks.length,
          completedTasks: roadmap.tasks.filter(task => task.status === 'COMPLETED').length,
        },
      });
      addLink(profileNode, roadmapId, 'FOLLOWS_PLAN', 'learning plan');
      const careerId = roadmap.careerGoal ? careerNodeByTitle.get(skillKey(resolveRole(roadmap.careerGoal)?.title || roadmap.careerGoal)) : null;
      if (careerId) addLink(roadmapId, careerId, 'TARGETS', 'targets');
      for (const task of roadmap.tasks) {
        const match = roleResolution ? [...roleResolution.core, ...roleResolution.advanced].find(item =>
          task.title.toLowerCase().includes(item.name.toLowerCase()) ||
          task.description?.toLowerCase().includes(item.name.toLowerCase())
        ) : null;
        if (!match) continue;
        const key = skillKey(canonicalSkillName(match.name));
        const skillId = skillNodeByKey.get(key) || gapNodeByKey.get(key);
        if (skillId) addLink(roadmapId, skillId, 'DEVELOPS', 'develops');
      }
    }

    for (const certification of profile?.certifications || []) {
      const id = `cert-${certification.id}`;
      addNode({
        id,
        label: certification.name,
        type: 'project',
        group: 'Credentials',
        meta: { title: certification.name, issuer: certification.issuer || '', url: certification.url || '' },
      });
      addLink(profileNode, id, 'HAS_CERTIFICATION', 'certification');
    }

    for (const project of profile?.projects || []) {
      const id = `project-${project.id}`;
      addNode({
        id,
        label: project.title,
        type: 'project',
        group: 'Projects',
        meta: {
          title: project.title,
          description: project.description || '',
          technologies: parseStringList(project.technologies),
          url: project.url || '',
        },
      });
      addLink(profileNode, id, 'BUILT', 'project');
      for (const tech of parseStringList(project.technologies)) {
        const key = skillKey(canonicalSkillName(tech));
        const skillId = skillNodeByKey.get(key);
        if (skillId) addLink(id, skillId, 'USES_SKILL', 'uses');
      }
    }

    const categoryCounts = nodes.reduce((acc: Record<string, number>, node) => {
      acc[node.type] = (acc[node.type] || 0) + 1;
      return acc;
    }, {});
    const categories = Object.entries(COLORS).map(([type, color]) => ({
      id: type,
      label: type === 'profile' ? 'Profile' : type === 'gap' ? 'Missing Skills' :
        type === 'learning' ? 'Learning Paths' : type === 'career' ? 'Careers' :
        type === 'roadmap' ? 'Roadmap' : type === 'skill' ? 'Your Skills' :
        type === 'education' ? 'Education' : type === 'goal' ? 'Career Goal' : 'Projects',
      color,
      count: categoryCounts[type] || 0,
    })).filter(category => category.count > 0);

    res.json({
      nodes,
      links,
      categories,
      targetRole: roleDetails
        ? {
            ...roleDetails,
            matchingSkills: getRoleMatchDetails(targetRole, (profile?.skills || []).map(s => s.name)).matchingSkills,
            missingSkills: getRoleMatchDetails(targetRole, (profile?.skills || []).map(s => s.name)).missingSkills,
            matchPercentage: getRoleMatchDetails(targetRole, (profile?.skills || []).map(s => s.name)).matchPercentage,
            learningPaths: subjectsForSkills([...roleDetails.requiredSkills, ...(profile?.skills || []).map(s => s.name)]).slice(0, 8),
          }
        : null,
      stats: {
        nodes: nodes.length,
        links: links.length,
        skills: (profile?.skills || []).length,
        gaps: gaps.length,
        careers: careerNodes.length,
        learningPaths: nodes.filter(node => node.type === 'learning').length,
      },
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    next(error);
  }
}
