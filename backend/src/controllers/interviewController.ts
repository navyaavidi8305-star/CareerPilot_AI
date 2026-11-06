import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import {
  InterviewQuestionBankItem,
  evaluateInterviewAnswerDetailed,
  generateInterviewQuestionBank,
} from '../utils/openai';

function parseJsonList(raw: string | null | undefined): any[] {
  try {
    const parsed = JSON.parse(raw || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getQuestionBank(interview: any): InterviewQuestionBankItem[] {
  const bank = parseJsonList(interview.questionBank);
  if (bank.length > 0) {
    return bank
      .map((item: any) => ({
        question: String(item?.question || '').trim(),
        expectedAnswer: String(item?.expectedAnswer || '').trim(),
        difficulty: (String(item?.difficulty || 'INTERMEDIATE').toUpperCase() as InterviewQuestionBankItem['difficulty']),
        topic: String(item?.topic || 'Role Knowledge'),
      }))
      .filter(item => !!item.question);
  }
  return parseJsonList(interview.questions)
    .filter((question: any) => typeof question === 'string')
    .map((question: string, index: number) => ({
      question,
      expectedAnswer: '',
      difficulty: (index < 3 ? 'EASY' : index < 7 ? 'INTERMEDIATE' : 'HARD') as InterviewQuestionBankItem['difficulty'],
      topic: interview.role || 'Role Knowledge',
    }));
}

function sanitizeInterview(interview: any, includeReport = false) {
  const bank = getQuestionBank(interview);
  const answers = parseJsonList(interview.answers);
  const safe: any = {
    ...interview,
    questions: bank.map(item => item.question),
    answeredCount: answers.length,
    totalQuestions: bank.length,
    questionBank: undefined,
    answers: undefined,
  };
  if (!includeReport) safe.report = undefined;
  if (includeReport && interview.report) {
    try {
      safe.report = JSON.parse(interview.report);
    } catch {
      safe.report = null;
    }
  }
  return safe;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function buildReport(interview: any, answers: any[]) {
  const scoreOf = (key: string) => average(answers.map(answer => Number(answer?.evaluation?.[key]) || 0));
  const correctness = scoreOf('correctnessScore');
  const relevance = scoreOf('relevanceScore');
  const clarity = scoreOf('clarityScore');
  const confidence = scoreOf('confidenceScore');
  const communication = scoreOf('communicationScore');
  const problemSolving = scoreOf('problemSolvingScore');
  const overall = scoreOf('overallScore');
  const strengths = Array.from(new Set(answers.flatMap(answer => answer?.evaluation?.strengths || []))).slice(0, 8);
  const weakAreas = Array.from(new Set(answers.flatMap(answer => answer?.evaluation?.weakAreas || []))).slice(0, 8);
  const mistakes = Array.from(new Set(answers.flatMap(answer => answer?.evaluation?.mistakes || []))).slice(0, 8);
  const improvements = Array.from(new Set(answers.flatMap(answer => answer?.evaluation?.improvements || []))).slice(0, 8);
  const byDifficulty = answers.reduce((acc: Record<string, number[]>, answer) => {
    const key = String(answer?.difficulty || 'INTERMEDIATE').toUpperCase();
    acc[key] = acc[key] || [];
    acc[key].push(Number(answer?.evaluation?.overallScore) || 0);
    return acc;
  }, {});
  const recommendations = [
    overall >= 80
      ? 'You are interview-ready. Keep practising hard questions and refine your storytelling.'
      : overall >= 60
        ? 'You have a solid foundation. Focus on the weak areas below and practice two more mock interviews.'
        : 'Build your fundamentals first, then re-attempt this interview after revising the key topics.',
    clarity < 65 ? 'Structure answers with Situation → Task → Action → Result and keep them under two minutes.' : '',
    correctness < 65 ? 'Revise the role-specific concepts listed in the weak areas and add concrete examples.' : '',
    confidence < 65 ? 'Practice speaking your answers aloud and avoid hedging language.' : '',
    relevance < 65 ? 'Answer the exact question first, then add context — do not drift into unrelated topics.' : '',
  ].filter(Boolean);

  return {
    overallScore: overall,
    scores: {
      correctness,
      relevance,
      clarity,
      confidence,
      communication,
      problemSolving,
      technicalAccuracy: scoreOf('technicalAccuracy'),
    },
    byDifficulty: Object.entries(byDifficulty).map(([difficulty, scores]) => ({
      difficulty,
      questions: scores.length,
      averageScore: average(scores),
    })),
    questionsAnswered: answers.length,
    strengths,
    weakAreas,
    mistakes,
    improvements,
    recommendations,
    summary: `You answered ${answers.length} question(s) with an overall score of ${overall}/100. Correctness was ${correctness}/100 and communication was ${communication}/100.`,
    generatedAt: new Date().toISOString(),
  };
}

export async function startInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { type, role, company, experienceLevel, difficulty } = req.body;
    if (!type || !role) return res.status(400).json({ error: 'Interview type and role are required' });

    const profile = await prisma.profile.findUnique({
      where: { userId: req.userId },
      include: { skills: true },
    });

    const skills = profile?.skills?.map(skill => skill.name) || [];
    const roleKey = String(role).trim().toLowerCase();
    const previousInterviews = await prisma.interview.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
      take: 25,
    });
    const previousQuestions = previousInterviews
      .filter(interview =>
        String(interview.type || '').toUpperCase() === String(type).toUpperCase() &&
        String(interview.role || '').trim().toLowerCase() === roleKey
      )
      .flatMap(interview => [
        ...parseJsonList(interview.questions).filter((q: any) => typeof q === 'string'),
        ...parseJsonList(interview.questionBank).map((q: any) => q?.question).filter((q: any) => typeof q === 'string'),
      ])
      .slice(0, 80);

    const bank = await generateInterviewQuestionBank(type, role, skills, {
      company,
      previousQuestions,
      experienceLevel,
      difficulty,
    });
    const questionBank = bank.questions.length > 0 ? bank.questions : [{
      question: `Tell me about your experience relevant to the ${role} role and why you are a strong fit.`,
      expectedAnswer: 'Connect your experience, skills and motivation to the role requirements using a specific example.',
      difficulty: 'EASY' as const,
      topic: String(role),
    }];
    const requestedDifficulty = String(difficulty || '').toUpperCase();
    const typeText = String(type || '').toUpperCase();
    const prefersBehavioral = /HR|BEHAVIOUR|BEHAVIOR|MOCK/.test(typeText);
    const preferredIndex = ['EASY', 'INTERMEDIATE', 'HARD'].includes(requestedDifficulty)
      ? questionBank.findIndex(item =>
          item.difficulty === requestedDifficulty &&
          (prefersBehavioral || !/behavioral/i.test(item.topic))
        )
      : -1;
    if (preferredIndex > 0) {
      const [preferred] = questionBank.splice(preferredIndex, 1);
      questionBank.unshift(preferred);
    }
    const firstDifficulty = String(questionBank[0]?.difficulty || requestedDifficulty || 'INTERMEDIATE').toUpperCase();

    const interview = await prisma.interview.create({
      data: {
        userId: req.userId!,
        type,
        role,
        company,
        experienceLevel: experienceLevel || 'Fresher',
        difficulty: firstDifficulty,
        questions: JSON.stringify(questionBank.map(item => item.question)),
        questionBank: JSON.stringify(questionBank),
      },
    });

    res.json({
      interview: sanitizeInterview(interview),
      question: questionBank[0].question,
      questionNumber: 1,
      totalQuestions: questionBank.length,
      difficulty: questionBank[0].difficulty,
      topic: questionBank[0].topic,
    });
  } catch (error) {
    next(error);
  }
}

export async function submitAnswer(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { interviewId } = req.params;
    const { answer, questionIndex } = req.body;
    if (typeof answer !== 'string' || !answer.trim()) {
      return res.status(400).json({ error: 'An answer is required' });
    }

    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, userId: req.userId },
    });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    if (interview.status === 'COMPLETED') {
      return res.status(400).json({ error: 'This interview is already completed' });
    }

    const bank = getQuestionBank(interview);
    if (bank.length === 0) return res.status(400).json({ error: 'This interview has no questions' });

    const existingAnswers = parseJsonList(interview.answers);
    const requestedIndex = Number(questionIndex);
    let index = Number.isInteger(requestedIndex) && requestedIndex >= 0 && requestedIndex < bank.length
      ? requestedIndex
      : existingAnswers.length;
    const alreadyAnswered = new Set(existingAnswers.map((item: any) => Number(item?.questionIndex)));
    while (index < bank.length && alreadyAnswered.has(index)) index += 1;
    if (index >= bank.length) {
      const report = buildReport(interview, existingAnswers);
      await prisma.interview.update({
        where: { id: interviewId },
        data: { status: 'COMPLETED', completedAt: new Date(), report: JSON.stringify(report) },
      });
      return res.json({ evaluation: null, isComplete: true, report, message: 'All questions have been answered.' });
    }

    const current = bank[index];
    const evaluation = await evaluateInterviewAnswerDetailed(current.question, answer, {
      expectedAnswer: current.expectedAnswer,
      role: interview.role || undefined,
      company: interview.company || undefined,
      difficulty: current.difficulty,
      experienceLevel: interview.experienceLevel || undefined,
    });

    existingAnswers.push({
      question: current.question,
      questionIndex: index,
      difficulty: current.difficulty,
      topic: current.topic,
      answer,
      evaluation,
      submittedAt: new Date().toISOString(),
    });
    existingAnswers.sort((a, b) => Number(a.questionIndex) - Number(b.questionIndex));

    const scoreOf = (key: string) => average(existingAnswers.map(item => Number(item?.evaluation?.[key]) || 0));
    const overallScore = scoreOf('overallScore');
    const answeredIndices = new Set(existingAnswers.map((item: any) => Number(item?.questionIndex)));
    const answeredCount = answeredIndices.size;
    const isComplete = answeredCount >= bank.length;

    // Adapt the next question difficulty to the latest performance.
    let nextDifficulty: 'EASY' | 'INTERMEDIATE' | 'HARD' =
      overallScore >= 75 ? 'HARD' : overallScore <= 45 ? 'EASY' : 'INTERMEDIATE';
    const unanswered = bank
      .map((item, i) => ({ item, i }))
      .filter(({ i }) => !answeredIndices.has(i));
    const nextEntry = unanswered.find(({ item }) => item.difficulty === nextDifficulty) || unanswered[0];
    if (!nextEntry) nextDifficulty = current.difficulty;

    const report = isComplete ? buildReport(interview, existingAnswers) : null;

    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        answers: JSON.stringify(existingAnswers),
        overallScore,
        communicationScore: scoreOf('communicationScore'),
        confidenceScore: scoreOf('confidenceScore'),
        technicalAccuracy: scoreOf('technicalAccuracy'),
        problemSolvingScore: scoreOf('problemSolvingScore'),
        relevanceScore: scoreOf('relevanceScore'),
        clarityScore: scoreOf('clarityScore'),
        difficulty: nextEntry ? nextEntry.item.difficulty : current.difficulty,
        status: isComplete ? 'COMPLETED' : 'IN_PROGRESS',
        completedAt: isComplete ? new Date() : undefined,
        report: report ? JSON.stringify(report) : undefined,
        strengths: JSON.stringify(Array.from(new Set(existingAnswers.flatMap(item => item?.evaluation?.strengths || []))).slice(0, 8)),
        weakAreas: JSON.stringify(Array.from(new Set(existingAnswers.flatMap(item => item?.evaluation?.weakAreas || []))).slice(0, 8)),
        improvementPlan: evaluation.improvementPlan || null,
        feedback: evaluation.feedback || null,
      },
    });

    res.json({
      evaluation: {
        ...evaluation,
        // Revealed only after the candidate has attempted this question.
        sampleAnswer: evaluation.sampleAnswer,
      },
      answeredCount,
      totalQuestions: bank.length,
      isComplete,
      report,
      nextQuestion: nextEntry && !isComplete
        ? {
            question: nextEntry.item.question,
            number: nextEntry.i + 1,
            difficulty: nextEntry.item.difficulty,
            topic: nextEntry.item.topic,
          }
        : null,
      interview: sanitizeInterview(updated),
    });
  } catch (error) {
    next(error);
  }
}

export async function getInterviews(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const interviews = await prisma.interview.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: 'desc' },
    });
    res.json(interviews.map(interview => sanitizeInterview(interview, true)));
  } catch (error) {
    next(error);
  }
}

export async function getInterviewById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const interview = await prisma.interview.findFirst({
      where: { id: req.params.id, userId: req.userId },
    });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });
    const bank = getQuestionBank(interview);
    const answers = parseJsonList(interview.answers);
    const answeredIndices = new Set(answers.map((item: any) => Number(item?.questionIndex)));
    const nextIndex = bank.findIndex((_item, index) => !answeredIndices.has(index));
    const safe = sanitizeInterview(interview, true);
    res.json({
      ...safe,
      currentQuestion: nextIndex >= 0
        ? {
            question: bank[nextIndex].question,
            number: nextIndex + 1,
            difficulty: bank[nextIndex].difficulty,
            topic: bank[nextIndex].topic,
          }
        : null,
      answeredCount: answers.length,
    });
  } catch (error) {
    next(error);
  }
}

export async function completeInterview(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { interviewId } = req.params;
    const interview = await prisma.interview.findFirst({
      where: { id: interviewId, userId: req.userId },
    });
    if (!interview) return res.status(404).json({ error: 'Interview not found' });

    const answers = parseJsonList(interview.answers);
    const report = buildReport(interview, answers);
    const updated = await prisma.interview.update({
      where: { id: interviewId },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        overallScore: report.overallScore,
        communicationScore: report.scores.communication,
        confidenceScore: report.scores.confidence,
        technicalAccuracy: report.scores.technicalAccuracy,
        problemSolvingScore: report.scores.problemSolving,
        relevanceScore: report.scores.relevance,
        clarityScore: report.scores.clarity,
        strengths: JSON.stringify(report.strengths),
        weakAreas: JSON.stringify(report.weakAreas),
        improvementPlan: report.recommendations.join(' '),
        report: JSON.stringify(report),
      },
    });

    res.json({ ...sanitizeInterview(updated, true), report });
  } catch (error) {
    next(error);
  }
}
