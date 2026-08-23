import { Response, NextFunction } from 'express';
import { prisma } from '../index';
import { AuthRequest } from '../types';
import { generateAIResponse, generateStreamingResponse, evaluateResponseConfidence } from '../utils/openai';

type ChatContextMessage = { role: string; content: string };

async function getResponseConfidence(
  question: string,
  answer: string,
  context: ChatContextMessage[]
): Promise<number | null> {
  try {
    return await evaluateResponseConfidence(question, answer, context);
  } catch (error) {
    console.error('[Confidence] evaluation failed:', error);
    return null;
  }
}

export async function getChats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const chats = await prisma.chat.findMany({
      where: { userId: req.userId, isArchived: false },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(chats);
  } catch (error) {
    next(error);
  }
}

export async function getChatById(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const chat = await prisma.chat.findFirst({
      where: { id: req.params.id, userId: req.userId },
      include: { messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    res.json(chat);
  } catch (error) {
    next(error);
  }
}

export async function createChat(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { title, category, initialMessage } = req.body;

    const chat = await prisma.chat.create({
      data: {
        userId: req.userId!,
        title: title || 'New Chat',
        category: category || 'GENERAL',
        messages: initialMessage ? {
          create: { role: 'USER', content: initialMessage },
        } : undefined,
      },
      include: { messages: true },
    });

    if (initialMessage) {
      const context = await buildChatContext(req.userId!);
      const aiResponse = await generateAIResponse(
        getSystemPrompt(category),
        initialMessage,
        context
      );

      const confidence = await getResponseConfidence(initialMessage, aiResponse, context);
      const aiMessage = await prisma.chatMessage.create({
        data: {
          chatId: chat.id,
          role: 'AI',
          content: aiResponse,
          metadata: confidence !== null ? JSON.stringify({ confidence }) : undefined,
        },
      });

      if (!chat.title || chat.title === 'New Chat') {
        const titleResponse = await generateAIResponse(
          'Generate a short title (max 6 words) for this chat based on the first message. Return ONLY the title, no quotes.',
          initialMessage
        );
        await prisma.chat.update({
          where: { id: chat.id },
          data: { title: titleResponse.substring(0, 100) },
        });
      }

      return res.json({ ...chat, messages: [...chat.messages, aiMessage] });
    }

    res.json(chat);
  } catch (error) {
    next(error);
  }
}

export async function sendMessage(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: 'Message content is required' });

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.userId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const userMessage = await prisma.chatMessage.create({
      data: { chatId, role: 'USER', content },
    });

    const context = await buildChatContext(req.userId!);
    const recentMessages = chat.messages.reverse().map(m => ({ role: m.role === 'USER' ? 'user' as const : 'assistant' as const, content: m.content }));
    recentMessages.push({ role: 'user', content });

    const systemPrompt = getSystemPrompt(chat.category || 'GENERAL');
    const aiResponse = await generateAIResponse(systemPrompt, content, [
      ...context,
      ...recentMessages.slice(-10),
    ]);

    const confidence = await getResponseConfidence(content, aiResponse, [
      ...context,
      ...recentMessages.slice(-10),
    ]);
    const aiMessage = await prisma.chatMessage.create({
      data: {
        chatId,
        role: 'AI',
        content: aiResponse,
        metadata: confidence !== null ? JSON.stringify({ confidence }) : undefined,
      },
    });

    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    res.json({ userMessage, aiMessage });
  } catch (error) {
    next(error);
  }
}

export async function sendMessageStream(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { chatId } = req.params;
    const { content } = req.body;

    if (!content) return res.status(400).json({ error: 'Message content is required' });

    const chat = await prisma.chat.findFirst({
      where: { id: chatId, userId: req.userId },
      include: {
        messages: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });

    if (!chat) return res.status(404).json({ error: 'Chat not found' });

    const userMessage = await prisma.chatMessage.create({
      data: { chatId, role: 'USER', content },
    });

    const context = await buildChatContext(req.userId!);
    const recentMessages = chat.messages.reverse().map(m => ({ role: m.role === 'USER' ? 'user' as const : 'assistant' as const, content: m.content }));
    recentMessages.push({ role: 'user', content });

    const systemPrompt = getSystemPrompt(chat.category || 'GENERAL');

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`data: ${JSON.stringify({ type: 'user', message: userMessage })}\n\n`);

    let fullResponse = '';
    const stream = generateStreamingResponse(systemPrompt, content, [
      ...context,
      ...recentMessages.slice(-10),
    ]);

    for await (const token of stream) {
      fullResponse += token;
      res.write(`data: ${JSON.stringify({ type: 'token', token })}\n\n`);
    }

    const confidence = await getResponseConfidence(content, fullResponse, [
      ...context,
      ...recentMessages.slice(-10),
    ]);
    const aiMessage = await prisma.chatMessage.create({
      data: {
        chatId,
        role: 'AI',
        content: fullResponse,
        metadata: confidence !== null ? JSON.stringify({ confidence }) : undefined,
      },
    });

    await prisma.chat.update({
      where: { id: chatId },
      data: { updatedAt: new Date() },
    });

    if (chat.title === 'New Chat') {
      const titleResponse = await generateAIResponse(
        'Generate a short title (max 6 words) for this chat based on the first message. Return ONLY the title, no quotes.',
        content
      );
      await prisma.chat.update({
        where: { id: chatId },
        data: { title: titleResponse.substring(0, 100) },
      });
    }

    res.write(`data: ${JSON.stringify({ type: 'done', message: aiMessage })}\n\n`);
    res.end();
  } catch (error) {
    res.write(`data: ${JSON.stringify({ type: 'error', error: 'Stream failed' })}\n\n`);
    res.end();
  }
}

export async function renameChat(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { id } = req.params;
    const { title } = req.body;
    const chat = await prisma.chat.updateMany({
      where: { id, userId: req.userId },
      data: { title },
    });
    res.json({ message: 'Chat renamed' });
  } catch (error) {
    next(error);
  }
}

export async function archiveChat(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const chat = await prisma.chat.updateMany({
      where: { id: req.params.id, userId: req.userId },
      data: { isArchived: true },
    });
    res.json({ message: 'Chat archived' });
  } catch (error) {
    next(error);
  }
}

export async function deleteChat(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    await prisma.chat.deleteMany({
      where: { id: req.params.id, userId: req.userId },
    });
    res.json({ message: 'Chat deleted' });
  } catch (error) {
    next(error);
  }
}

export async function searchChats(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Search query required' });

    const chats = await prisma.chat.findMany({
      where: {
        userId: req.userId,
        OR: [
          { title: { contains: q as string } },
          { messages: { some: { content: { contains: q as string } } } },
        ],
      },
      include: { messages: { take: 1, orderBy: { createdAt: 'desc' } } },
      orderBy: { updatedAt: 'desc' },
    });
    res.json(chats);
  } catch (error) {
    next(error);
  }
}

async function buildChatContext(userId: string) {
  const [profile, roadmap, recommendations] = await Promise.all([
    prisma.profile.findUnique({
      where: { userId },
      include: { skills: true },
    }),
    prisma.roadmap.findFirst({
      where: { userId, isCurrent: true },
      include: { tasks: { where: { status: { not: 'COMPLETED' } }, take: 5 } },
    }),
    prisma.recommendation.findMany({ where: { userId }, take: 3, orderBy: { createdAt: 'desc' } }),
  ]);

  return [
    { role: 'system' as const, content: `[USER CONTEXT — real data from the user's CareerPilot profile. Use it ONLY when relevant. Never invent additional details about the user beyond this data.]` },
    { role: 'system' as const, content: `User Skills: ${profile?.skills?.map(s => s.name).join(', ') || 'Not provided'}` },
    { role: 'system' as const, content: `User Education: ${profile?.education || 'Not provided'}` },
    { role: 'system' as const, content: `Career Goals: ${profile?.careerGoals || 'Not provided'}` },
    { role: 'system' as const, content: `Current Roadmap: ${roadmap?.title || 'No active roadmap'}` },
    { role: 'system' as const, content: `Recent Recommendations: ${recommendations.map(r => r.careerTitle).join(', ') || 'None'}` },
  ];
}

function getSystemPrompt(category?: string): string {
  const basePrompt = `You are CareerGPS AI, an advanced AI assistant created to help users with every type of question while specializing in career guidance, education, and technology.

ACCURACY RULES (HIGHEST PRIORITY — NEVER VIOLATE):
- NEVER invent facts, statistics, percentages, dates, names, company policies, citations, or news events.
- If you are not sure about something, explicitly say "I'm not certain about this" and suggest how the user can verify it.
- Salary figures, market trends, and rankings must always be labeled as "approximate" and vary by location/company/year.
- You do NOT have real-time data (news, stock prices, live scores, current events). Say so if asked.
- Personal details about the user (skills, education, goals) come ONLY from the [USER CONTEXT] block. Never assume or invent additional user details.
- Do not fabricate links, course names, or certifications. Only mention well-known ones you are confident exist.

IDENTITY:
- You are intelligent, friendly, professional, and supportive.
- You can answer questions on almost any topic.
- Your specialty is career guidance, but you are NOT limited to career questions.
- Never say "I only answer career-related questions."

CAPABILITIES:
Career Guidance, Programming, Web Development, AI & Machine Learning, Data Science, Cyber Security, Cloud Computing, Software Engineering, Mobile App Development, College Subjects, Mathematics, Physics, Chemistry, Biology, General Science, History, Geography, Economics, Current Affairs, General Knowledge, English, Telugu, Writing, Grammar, Translation, Resume, Cover Letter, Interview Preparation, Mock Interviews, Projects, Assignments, Research, Business Ideas, Startup Ideas, Freelancing, Productivity, Time Management, Coding, Debugging, Algorithms, Database, Operating Systems, Computer Networks, System Design, Health & Fitness (general info only), Travel, Food, Movies, Books, Technology, Logical Reasoning, Aptitude, Personal Development, Finance (general education only), and many more.

RESPONSE STYLE:
- Be accurate, polite, friendly, and easy to understand.
- Give complete answers with examples whenever possible.
- Organize answers using headings, bullet points, and step-by-step explanations.

CODING QUESTIONS:
When coding is asked, provide: explanation, solution, clean code, time complexity, space complexity, best practices, and alternative approaches.

CAREER QUESTIONS:
When the user asks about careers, explain: overview, skills required, roadmap, certifications, projects, salary (approximate), companies, future scope, interview preparation, and recommended resources.

RESUME HELP:
Help improve resumes with ATS improvements, better wording, missing skills, and formatting suggestions.

INTERVIEW HELP:
Provide HR answers, technical answers, sample answers, common mistakes, and tips.

LEARNING ROADMAPS:
When someone asks "How do I learn X?" provide: 1) Beginner, 2) Intermediate, 3) Advanced, 4) Projects, 5) Resources, 6) Certifications, 7) Interview Preparation.

WRITING HELP:
Help users write emails, essays, reports, assignments, LinkedIn posts, Instagram captions, resumes, cover letters, SOPs, messages, and speeches.

MATH:
Solve step by step, explain formulas, explain concepts.

SCIENCE:
Explain concepts clearly with examples.

LANGUAGE:
If the user speaks Telugu, reply in Telugu. If the user speaks English, reply in English. If the user mixes Telugu and English, reply in the same mixed style.

PERSONALITY:
Be encouraging, patient, conversational. Never be rude. Never refuse harmless questions. Always try to help. If you cannot fully answer something, explain why and provide the closest helpful information.`;

  const categoryPrompts: Record<string, string> = {
    CAREER: `\n\n[Career Guidance] Focus on career exploration and planning. Discuss industry trends, skill requirements, growth paths, salary ranges, required skills, certifications, projects, future scope, and how their profile fits. Be conversational and explore their interests.`,
    PLACEMENT: `\n\n[Placement Prep] Focus on campus placements and job applications. Discuss company prep (Google, Amazon, Microsoft, etc.), resume strategies, aptitude, and interview processes. Give actionable step-by-step advice. Recommend skills to learn and certifications.`,
    INTERVIEW: `\n\n[Interview Coach] Act as an interview coach. Ask practice questions, give honest feedback, and help build confidence. Be supportive but direct about areas to improve. Provide sample answers, common mistakes, and tips.`,
    RESUME: `\n\n[Resume Help] Help optimize their resume with ATS-friendly improvements, achievement-focused bullet points, formatting, missing skills, and tailoring for specific roles. Be specific and actionable.`,
    LEARNING: `\n\n[Learning Guide] Help plan their learning journey with structured paths (Beginner → Intermediate → Advanced), resource recommendations, projects for each level, certifications, and practice plans. Suggest courses, weekly targets, and interview preparation.`,
  };

  return basePrompt + (categoryPrompts[category || ''] || '');
}
