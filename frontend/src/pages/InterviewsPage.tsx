import React, { useEffect, useState } from 'react';
import {
  AlertCircle, ArrowLeft, BarChart3, Briefcase, CheckCircle, ChevronRight,
  Clock, Mic, Play, ThumbsDown, ThumbsUp, TrendingUp, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import {
  completeInterview, getInterviewById, getInterviews, startInterview, submitAnswer,
  StartInterviewResponse, SubmitAnswerResponse,
} from '../services/interview';
import { getProfile } from '../services/user';
import { Interview, InterviewReport } from '../types';
import { formatDate, getScoreColor } from '../lib/utils';
import toast from 'react-hot-toast';

interface PracticeQuestion {
  question: string;
  number: number;
  difficulty: string;
  topic: string;
}

interface PracticeSession {
  interview: Interview;
  question: PracticeQuestion;
  totalQuestions: number;
}

function verdictFor(score?: number) {
  if (score == null) return null;
  if (score >= 70) return { label: 'Strong answer', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: <ThumbsUp className="w-4 h-4" /> };
  if (score >= 45) return { label: 'Partially correct', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: <AlertCircle className="w-4 h-4" /> };
  return { label: 'Needs improvement', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: <ThumbsDown className="w-4 h-4" /> };
}

function ScorePill({ label, value }: { label: string; value?: number }) {
  return (
    <div className="p-3 rounded-lg bg-secondary/30 text-center">
      <p className={`text-lg font-bold ${getScoreColor(value || 0)}`}>{Math.round(value || 0)}%</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </div>
  );
}

function ReportPanel({ report, onBack }: { report: InterviewReport; onBack: () => void }) {
  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground">Interview report</p>
              <p className="text-3xl font-bold mt-1">
                <span className={getScoreColor(report.overallScore)}>{report.overallScore}%</span>
              </p>
            </div>
            <Button variant="outline" onClick={onBack} className="gap-2"><ArrowLeft className="w-4 h-4" /> Back</Button>
          </div>
          <p className="text-sm text-muted-foreground">{report.summary}</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        <ScorePill label="Correctness" value={report.scores.correctness} />
        <ScorePill label="Relevance" value={report.scores.relevance} />
        <ScorePill label="Clarity" value={report.scores.clarity} />
        <ScorePill label="Confidence" value={report.scores.confidence} />
        <ScorePill label="Communication" value={report.scores.communication} />
        <ScorePill label="Problem Solving" value={report.scores.problemSolving} />
        <ScorePill label="Technical" value={report.scores.technicalAccuracy} />
      </div>

      {report.byDifficulty.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Performance by difficulty</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {report.byDifficulty.map(item => (
              <div key={item.difficulty}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="flex items-center gap-2"><Badge variant="outline" className="text-[10px]">{item.difficulty}</Badge>{item.questions} question(s)</span>
                  <span className={getScoreColor(item.averageScore)}>{item.averageScore}%</span>
                </div>
                <Progress value={item.averageScore} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-green-400 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Strengths</CardTitle></CardHeader>
          <CardContent>
            {report.strengths.length > 0 ? (
              <ul className="space-y-1">
                {report.strengths.map((item, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-green-400">+</span>{item}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">Keep practising to build clear strengths.</p>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-red-400 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> Weak areas</CardTitle></CardHeader>
          <CardContent>
            {report.weakAreas.length > 0 ? (
              <ul className="space-y-1">
                {report.weakAreas.map((item, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-red-400">-</span>{item}</li>)}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No major weak areas identified.</p>}
          </CardContent>
        </Card>
      </div>

      {report.mistakes.length > 0 && (
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm">Mistakes to fix</CardTitle></CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {report.mistakes.map((item, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-yellow-400">•</span>{item}</li>)}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm text-primary flex items-center gap-2"><TrendingUp className="w-4 h-4" /> Recommendations</CardTitle></CardHeader>
        <CardContent>
          <ul className="space-y-2">
            {report.recommendations.map((item, i) => (
              <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">→</span>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'start'>('list');
  const [form, setForm] = useState({
    type: 'TECHNICAL',
    role: '',
    company: '',
    experienceLevel: 'Fresher',
    difficulty: 'INTERMEDIATE',
  });
  const [session, setSession] = useState<PracticeSession | null>(null);
  const [pendingNext, setPendingNext] = useState<PracticeQuestion | null>(null);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [evaluation, setEvaluation] = useState<SubmitAnswerResponse['evaluation']>(null);
  const [report, setReport] = useState<InterviewReport | null>(null);
  const [resumeTarget, setResumeTarget] = useState<Interview | null>(null);
  const [resuming, setResuming] = useState(false);
  const [historyReport, setHistoryReport] = useState<InterviewReport | null>(null);

  const fetchData = async () => {
    try {
      setInterviews(await getInterviews());
    } catch {
      console.error('Failed to fetch interviews');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const [profile] = await Promise.all([getProfile().catch(() => null)]);
      if (profile?.targetRole) {
        setForm(prev => ({ ...prev, role: prev.role || profile.targetRole || '' }));
      }
      await fetchData();
    };
    load();
  }, []);

  const resetQuestionState = () => {
    setAnswer('');
    setEvaluation(null);
    setPendingNext(null);
  };

  const handleStart = async () => {
    if (!form.role.trim()) { toast.error('Target role is required'); return; }
    try {
      const data: StartInterviewResponse = await startInterview(form);
      setSession({
        interview: data.interview,
        question: {
          question: data.question,
          number: data.questionNumber,
          difficulty: data.difficulty,
          topic: data.topic,
        },
        totalQuestions: data.totalQuestions,
      });
      resetQuestionState();
      setReport(null);
      setActiveView('list');
      toast.success('Interview started');
    } catch {
      toast.error('Failed to start interview');
    }
  };

  const handleResume = async () => {
    if (!resumeTarget) return;
    setResuming(true);
    try {
      const data = await getInterviewById(resumeTarget.id);
      if (data.report) {
        setHistoryReport(data.report);
        setResumeTarget(null);
        return;
      }
      if (!data.currentQuestion) {
        toast.error('This interview has no pending questions.');
        setResumeTarget(null);
        return;
      }
      setSession({
        interview: data,
        question: data.currentQuestion,
        totalQuestions: data.totalQuestions || (data.questions ? JSON.parse(data.questions).length : 8),
      });
      resetQuestionState();
      setReport(null);
      setResumeTarget(null);
    } catch {
      toast.error('Failed to load interview');
    } finally {
      setResuming(false);
    }
  };

  const handleSubmit = async () => {
    if (!session) return;
    if (!answer.trim()) { toast.error('Please provide an answer'); return; }
    setSubmitting(true);
    try {
      const result = await submitAnswer(session.interview.id, {
        answer,
        questionIndex: session.question.number - 1,
      });
      setEvaluation(result.evaluation);
      setPendingNext(result.nextQuestion);
      if (result.isComplete) {
        setReport(result.report);
      }
      setSession(prev => prev ? {
        ...prev,
        interview: result.interview,
        totalQuestions: result.totalQuestions || prev.totalQuestions,
      } : prev);
      fetchData();
    } catch {
      toast.error('Failed to submit answer');
    } finally {
      setSubmitting(false);
    }
  };

  const handleNext = () => {
    if (!session || !pendingNext) return;
    setSession(prev => prev ? { ...prev, question: pendingNext } : prev);
    resetQuestionState();
  };

  const handleFinishEarly = async () => {
    if (!session) return;
    try {
      const data = await completeInterview(session.interview.id);
      setReport(data.report || null);
      setSession(prev => prev ? { ...prev, interview: data } : prev);
      fetchData();
    } catch {
      toast.error('Failed to complete interview');
    }
  };

  const backToList = () => {
    setSession(null);
    setReport(null);
    setHistoryReport(null);
    resetQuestionState();
    setActiveView('list');
    fetchData();
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (historyReport) {
    return (
      <div className="space-y-6 animate-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interview Report</h1>
          <p className="text-muted-foreground text-sm mt-1">Detailed feedback from your completed interview</p>
        </div>
        <ReportPanel report={historyReport} onBack={() => setHistoryReport(null)} />
      </div>
    );
  }

  if (session && report) {
    return (
      <div className="space-y-6 animate-in">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Interview Complete</h1>
          <p className="text-muted-foreground text-sm mt-1">{session.interview.role} · {session.interview.type}</p>
        </div>
        <ReportPanel report={report} onBack={backToList} />
      </div>
    );
  }

  if (session) {
    const progress = ((session.question.number - 1) + (evaluation ? 1 : 0)) / Math.max(1, session.totalQuestions);
    const verdict = evaluation ? verdictFor(evaluation.overallScore) : null;
    return (
      <div className="space-y-6 animate-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{session.interview.role} Interview</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Question {session.question.number} of {session.totalQuestions}
              {session.interview.company ? ` · ${session.interview.company}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{session.interview.type}</Badge>
            <Badge variant="secondary">{session.question.difficulty}</Badge>
            <Button variant="outline" size="sm" onClick={handleFinishEarly} className="gap-1"><Clock className="w-3 h-3" /> End early</Button>
          </div>
        </div>

        <Progress value={Math.min(100, progress * 100)} className="h-2" />

        <Card>
          <CardContent className="p-6">
            <div className="p-4 rounded-lg bg-secondary/30 mb-5">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="secondary" className="text-[10px]">{session.question.topic}</Badge>
                <Badge variant="outline" className="text-[10px]">{session.question.difficulty}</Badge>
              </div>
              <p className="font-medium">{session.question.question}</p>
            </div>

            {!evaluation ? (
              <>
                <div className="space-y-2 mb-4">
                  <Label>Your answer</Label>
                  <textarea
                    className="w-full min-h-[150px] rounded-lg border border-input bg-background p-3 text-sm resize-none"
                    placeholder="Type your answer here. Use a clear structure: direct answer, key concepts, example, result."
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                  />
                  <p className="text-[11px] text-muted-foreground">{answer.trim().split(/\s+/).filter(Boolean).length} words</p>
                </div>
                <Button onClick={handleSubmit} disabled={submitting || !answer.trim()}>
                  {submitting ? 'Evaluating...' : 'Submit answer'}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${verdict?.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-semibold">{verdict?.icon} {verdict?.label}</div>
                    <span className="text-2xl font-bold">{Math.round(evaluation.overallScore || 0)}%</span>
                  </div>
                  {evaluation.feedback && <p className="text-sm opacity-90">{evaluation.feedback}</p>}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <ScorePill label="Correctness" value={evaluation.correctnessScore} />
                  <ScorePill label="Relevance" value={evaluation.relevanceScore} />
                  <ScorePill label="Clarity" value={evaluation.clarityScore} />
                  <ScorePill label="Confidence" value={evaluation.confidenceScore} />
                  <ScorePill label="Communication" value={evaluation.communicationScore} />
                </div>

                {evaluation.strengths?.length > 0 && (
                  <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                    <p className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Strengths</p>
                    <ul className="space-y-1">
                      {evaluation.strengths.map((item, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-green-400">+</span>{item}</li>)}
                    </ul>
                  </div>
                )}

                {evaluation.mistakes?.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Mistakes / weak areas</p>
                    <ul className="space-y-1">
                      {evaluation.mistakes.map((item, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-red-400">-</span>{item}</li>)}
                    </ul>
                  </div>
                )}

                {evaluation.improvements?.length > 0 && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm font-medium text-primary mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> What to improve</p>
                    <ul className="space-y-1">
                      {evaluation.improvements.map((item, i) => <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-primary">→</span>{item}</li>)}
                    </ul>
                  </div>
                )}

                {evaluation.improvementPlan && (
                  <div className="p-4 rounded-lg bg-secondary/30">
                    <p className="text-sm font-medium mb-1">Improvement plan</p>
                    <p className="text-sm text-muted-foreground">{evaluation.improvementPlan}</p>
                  </div>
                )}

                {evaluation.sampleAnswer && (
                  <div className="p-4 rounded-lg bg-blue-500/5 border border-blue-500/10">
                    <p className="text-sm font-medium text-blue-400 mb-1">Model answer</p>
                    <p className="text-sm text-muted-foreground">{evaluation.sampleAnswer}</p>
                  </div>
                )}

                {pendingNext ? (
                  <Button onClick={handleNext} className="gap-2 w-full">Next question <ChevronRight className="w-4 h-4" /></Button>
                ) : (
                  <div className="flex gap-2">
                    <Button onClick={handleFinishEarly} className="gap-2 flex-1"><CheckCircle className="w-4 h-4" /> View report</Button>
                    <Button onClick={backToList} variant="outline">Back to interviews</Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Interview Coach</h1>
          <p className="text-muted-foreground text-sm mt-1">Role-specific interviews with correctness, relevance, clarity and confidence scoring</p>
        </div>
        <Button onClick={() => setActiveView('start')} className="gap-2"><Mic className="w-4 h-4" /> Start interview</Button>
      </div>

      {activeView === 'start' && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Configure interview</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Interview type</Label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="TECHNICAL">Technical</option>
                  <option value="HR">HR / Behavioral</option>
                  <option value="CODING">Coding</option>
                  <option value="MOCK">Mock interview</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Target role</Label>
                <Input placeholder="e.g., Software Engineer" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Company (optional)</Label>
                <Input placeholder="e.g., Google" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Experience level</Label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.experienceLevel} onChange={e => setForm(p => ({ ...p, experienceLevel: e.target.value }))}>
                  <option value="Fresher">Fresher</option>
                  <option value="1-2 years">1-2 years</option>
                  <option value="3-5 years">3-5 years</option>
                  <option value="5+ years">5+ years</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Starting difficulty</Label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.difficulty} onChange={e => setForm(p => ({ ...p, difficulty: e.target.value }))}>
                  <option value="EASY">Easy</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="HARD">Hard</option>
                </select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleStart}><Play className="w-4 h-4 mr-2" /> Start</Button>
              <Button variant="outline" onClick={() => setActiveView('list')}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2"><BarChart3 className="w-4 h-4 text-primary" /> Interview history</CardTitle>
        </CardHeader>
        <CardContent>
          {interviews.length > 0 ? (
            <div className="space-y-3">
              {interviews.map(iv => (
                <button
                  key={iv.id}
                  onClick={async () => {
                    if (iv.status === 'IN_PROGRESS') setResumeTarget(iv);
                    else if (iv.status === 'COMPLETED') {
                      if (iv.report) setHistoryReport(iv.report);
                      else {
                        const data = await getInterviewById(iv.id);
                        if (data.report) setHistoryReport(data.report);
                        else toast.error('No report available');
                      }
                    }
                  }}
                  className="w-full flex items-center justify-between p-3 rounded-lg glass-hover text-left hover:border-primary/40 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center"><Briefcase className="w-5 h-5 text-primary" /></div>
                    <div>
                      <p className="text-sm font-medium">{iv.role || 'Interview'} <span className="text-xs text-muted-foreground">({iv.type})</span></p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(iv.createdAt)} · {iv.company || 'General'}
                        {iv.experienceLevel ? ` · ${iv.experienceLevel}` : ''}
                        {iv.answeredCount != null && iv.totalQuestions ? ` · ${iv.answeredCount}/${iv.totalQuestions} answered` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {iv.overallScore != null && (
                      <div className="text-right">
                        <p className={`text-lg font-bold ${getScoreColor(iv.overallScore)}`}>{Math.round(iv.overallScore)}%</p>
                        <p className="text-[10px] text-muted-foreground">Score</p>
                      </div>
                    )}
                    <Badge variant={iv.status === 'COMPLETED' ? 'success' : 'warning'}>{iv.status}</Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Mic className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No interviews yet</h3>
              <p className="text-muted-foreground mb-6">Practice with role-specific questions and get detailed feedback.</p>
              <Button onClick={() => setActiveView('start')}><Play className="w-4 h-4 mr-2" /> Start first interview</Button>
            </div>
          )}
        </CardContent>
      </Card>

      {resumeTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !resuming && setResumeTarget(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2"><Briefcase className="w-5 h-5 text-primary" /><h3 className="font-semibold">{resumeTarget.role || 'Interview'} · In progress</h3></div>
              <button onClick={() => setResumeTarget(null)} className="p-1 hover:bg-secondary rounded-lg"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                You answered {resumeTarget.answeredCount || 0} of {resumeTarget.totalQuestions || '?'} questions
                {resumeTarget.company ? ` for ${resumeTarget.company}` : ''}. Continue where you left off?
              </p>
              <div className="space-y-2">
                <Button onClick={handleResume} disabled={resuming} className="w-full gap-2"><Play className="w-4 h-4" /> {resuming ? 'Loading...' : 'Continue interview'}</Button>
                <Button onClick={() => { setResumeTarget(null); setActiveView('start'); }} variant="outline" className="w-full gap-2"><Mic className="w-4 h-4" /> Start new interview</Button>
                <Button onClick={() => setResumeTarget(null)} variant="ghost" className="w-full">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
