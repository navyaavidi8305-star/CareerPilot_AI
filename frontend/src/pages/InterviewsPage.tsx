import React, { useEffect, useState } from 'react';
import { Briefcase, Mic, Play, CheckCircle, BarChart3, ChevronRight, X, AlertCircle, ThumbsUp, ThumbsDown, TrendingUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { getInterviews, getInterviewById, startInterview, submitAnswer, completeInterview } from '../services/interview';
import { Interview } from '../types';
import { getScoreColor, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

function verdictFor(score?: number) {
  if (!score && score !== 0) return null;
  if (score >= 70) return { label: 'Good answer!', color: 'text-green-400 bg-green-500/10 border-green-500/20', icon: <ThumbsUp className="w-4 h-4" /> };
  if (score >= 40) return { label: 'Partially correct', color: 'text-yellow-400 bg-yellow-500/10 border-yellow-500/20', icon: <AlertCircle className="w-4 h-4" /> };
  return { label: 'Needs improvement', color: 'text-red-400 bg-red-500/10 border-red-500/20', icon: <ThumbsDown className="w-4 h-4" /> };
}

export default function InterviewsPage() {
  const [interviews, setInterviews] = useState<Interview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeView, setActiveView] = useState<'list' | 'start' | 'practice'>('list');
  const [form, setForm] = useState({ type: 'TECHNICAL', role: '', company: '' });
  const [currentInterview, setCurrentInterview] = useState<any>(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastEvaluation, setLastEvaluation] = useState<any>(null);
  const [isCompleteFlag, setIsCompleteFlag] = useState(false);
  const [resumeTarget, setResumeTarget] = useState<Interview | null>(null);
  const [resuming, setResuming] = useState(false);

  const fetchData = async () => {
    try {
      const data = await getInterviews();
      setInterviews(data);
    } catch { console.error('Failed to fetch interviews'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const resetPracticeState = () => {
    setAnswer('');
    setLastEvaluation(null);
    setIsCompleteFlag(false);
  };

  const handleStart = async () => {
    if (!form.role) { toast.error('Role is required'); return; }
    try {
      const data = await startInterview(form);
      setCurrentInterview(data);
      setCurrentQIndex(0);
      resetPracticeState();
      setActiveView('practice');
      toast.success('Interview started!');
    } catch { toast.error('Failed to start interview'); }
  };

  const handleContinue = async () => {
    if (!resumeTarget) return;
    setResuming(true);
    try {
      const data = await getInterviewById(resumeTarget.id);
      const questions: string[] = JSON.parse(data.questions || '[]');
      const answered: any[] = JSON.parse(data.answers || '[]');
      if (questions.length === 0) {
        toast.error('This interview has no questions. Start a new one.');
        setResumeTarget(null);
        return;
      }
      setCurrentInterview({ interview: data, questions });
      setCurrentQIndex(Math.min(answered.length, questions.length - 1));
      resetPracticeState();
      setResumeTarget(null);
      setActiveView('practice');
    } catch {
      toast.error('Failed to load interview');
    } finally {
      setResuming(false);
    }
  };

  const handleStartNewFromModal = () => {
    setResumeTarget(null);
    setActiveView('start');
  };

  const handleSubmitAnswer = async () => {
    if (!answer.trim()) { toast.error('Please provide an answer'); return; }
    setSubmitting(true);
    try {
      const result = await submitAnswer(currentInterview.interview.id, {
        question: currentInterview.questions[currentQIndex],
        answer,
        questionIndex: currentQIndex,
      });
      setLastEvaluation(result.evaluation || {});
      setIsCompleteFlag(result.isComplete);
      fetchData();
    } catch { toast.error('Failed to submit answer'); }
    finally { setSubmitting(false); }
  };

  const handleNextQuestion = () => {
    setCurrentQIndex(prev => prev + 1);
    resetPracticeState();
  };

  const handleFinish = async () => {
    try {
      await completeInterview(currentInterview.interview.id);
      toast.success('Interview completed!');
      setActiveView('list');
      setCurrentInterview(null);
      resetPracticeState();
      fetchData();
    } catch { toast.error('Failed to complete interview'); }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  const evaluation = lastEvaluation ? verdictFor(lastEvaluation.overallScore) : null;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Interview Coach</h1>
          <p className="text-muted-foreground text-sm mt-1">Practice interviews with AI-powered evaluation</p>
        </div>
        <Button onClick={() => setActiveView('start')} className="gap-2">
          <Mic className="w-4 h-4" /> Start Interview
        </Button>
      </div>

      {activeView === 'start' && (
        <Card>
          <CardContent className="p-6">
            <h3 className="font-semibold mb-4">Configure Interview</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="space-y-2">
                <Label>Interview Type</Label>
                <select className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm" value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}>
                  <option value="TECHNICAL">Technical</option>
                  <option value="HR">HR / Behavioral</option>
                  <option value="CODING">Coding</option>
                  <option value="MOCK">Mock Interview</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label>Target Role</Label>
                <Input placeholder="e.g., Software Engineer" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Company (optional)</Label>
                <Input placeholder="e.g., Google" value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleStart}><Play className="w-4 h-4 mr-2" /> Start</Button>
              <Button variant="outline" onClick={() => setActiveView('list')}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {activeView === 'practice' && currentInterview && (
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-semibold">{currentInterview.interview.role} Interview</h3>
                <p className="text-sm text-muted-foreground">Question {currentQIndex + 1} of {currentInterview.questions.length}</p>
              </div>
              <Badge>{currentInterview.interview.type}</Badge>
            </div>
            <Progress value={((currentQIndex + (lastEvaluation ? 1 : 0)) / currentInterview.questions.length) * 100} className="mb-6" />

            {!lastEvaluation ? (
              <>
                <div className="p-4 rounded-lg bg-secondary/30 mb-4">
                  <p className="font-medium mb-2">Question:</p>
                  <p>{currentInterview.questions[currentQIndex]}</p>
                </div>
                <div className="space-y-2 mb-4">
                  <Label>Your Answer</Label>
                  <textarea
                    className="w-full min-h-[120px] rounded-lg border border-input bg-background p-3 text-sm resize-none"
                    placeholder="Type your answer here..."
                    value={answer}
                    onChange={e => setAnswer(e.target.value)}
                  />
                </div>
                <Button onClick={handleSubmitAnswer} disabled={submitting || !answer.trim()}>
                  {submitting ? 'Evaluating...' : 'Submit Answer'}
                </Button>
              </>
            ) : (
              <div className="space-y-4">
                <div className={`p-4 rounded-lg border ${evaluation?.color}`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 font-semibold">
                      {evaluation?.icon} {evaluation?.label}
                    </div>
                    <span className="text-2xl font-bold">{Math.round(lastEvaluation.overallScore || 0)}%</span>
                  </div>
                  {lastEvaluation.feedback && (
                    <p className="text-sm opacity-90">{lastEvaluation.feedback}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: 'Communication', value: lastEvaluation.communicationScore },
                    { label: 'Confidence', value: lastEvaluation.confidenceScore },
                    { label: 'Technical Accuracy', value: lastEvaluation.technicalAccuracy },
                    { label: 'Problem Solving', value: lastEvaluation.problemSolvingScore },
                  ].map(m => (
                    <div key={m.label} className="p-3 rounded-lg bg-secondary/30 text-center">
                      <p className={`text-lg font-bold ${getScoreColor(m.value || 0)}`}>{Math.round(m.value || 0)}%</p>
                      <p className="text-[10px] text-muted-foreground">{m.label}</p>
                    </div>
                  ))}
                </div>

                {Array.isArray(lastEvaluation.strengths) && lastEvaluation.strengths.length > 0 && (
                  <div className="p-4 rounded-lg bg-green-500/5 border border-green-500/10">
                    <p className="text-sm font-medium text-green-400 mb-2 flex items-center gap-1"><CheckCircle className="w-4 h-4" /> Strengths</p>
                    <ul className="space-y-1">
                      {lastEvaluation.strengths.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-green-400">+</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {Array.isArray(lastEvaluation.weakAreas) && lastEvaluation.weakAreas.length > 0 && (
                  <div className="p-4 rounded-lg bg-red-500/5 border border-red-500/10">
                    <p className="text-sm font-medium text-red-400 mb-2 flex items-center gap-1"><AlertCircle className="w-4 h-4" /> Weak Areas</p>
                    <ul className="space-y-1">
                      {lastEvaluation.weakAreas.map((s: string, i: number) => (
                        <li key={i} className="text-sm text-muted-foreground flex gap-2"><span className="text-red-400">-</span>{s}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {lastEvaluation.improvementPlan && (
                  <div className="p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <p className="text-sm font-medium text-primary mb-2 flex items-center gap-1"><TrendingUp className="w-4 h-4" /> Improvement Plan</p>
                    <p className="text-sm text-muted-foreground">{lastEvaluation.improvementPlan}</p>
                  </div>
                )}

                {isCompleteFlag ? (
                  <Button onClick={handleFinish} className="gap-2 w-full">
                    <CheckCircle className="w-4 h-4" /> Finish Interview & View Results
                  </Button>
                ) : (
                  <Button onClick={handleNextQuestion} className="gap-2 w-full">
                    Next Question <ChevronRight className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {interviews.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" /> Interview History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {interviews.map(iv => (
                <div
                  key={iv.id}
                  onClick={() => iv.status === 'IN_PROGRESS' && setResumeTarget(iv)}
                  className={`flex items-center justify-between p-3 rounded-lg glass-hover ${iv.status === 'IN_PROGRESS' ? 'cursor-pointer hover:border-primary/40 transition-colors' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Briefcase className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">{iv.role || 'Interview'} <span className="text-xs text-muted-foreground">({iv.type})</span></p>
                      <p className="text-xs text-muted-foreground">{formatDate(iv.createdAt)} · {iv.company || 'General'}</p>
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
                    {iv.status === 'IN_PROGRESS' && <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : activeView === 'list' && (
        <Card>
          <CardContent className="text-center py-12">
            <Mic className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Interviews Yet</h3>
            <p className="text-muted-foreground mb-6">Practice interviews with AI-powered evaluation and feedback.</p>
            <Button onClick={() => setActiveView('start')}><Play className="w-4 h-4 mr-2" /> Start First Interview</Button>
          </CardContent>
        </Card>
      )}

      {resumeTarget && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !resuming && setResumeTarget(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Briefcase className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{resumeTarget.role || 'Interview'} — In Progress</h3>
              </div>
              <button onClick={() => setResumeTarget(null)} className="p-1 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <p className="text-sm text-muted-foreground">
                You have an unfinished <span className="text-foreground font-medium">{resumeTarget.type}</span> interview
                {resumeTarget.company ? ` for ${resumeTarget.company}` : ''}. What would you like to do?
              </p>
              <div className="space-y-2">
                <Button onClick={handleContinue} disabled={resuming} className="w-full gap-2">
                  <Play className="w-4 h-4" /> {resuming ? 'Loading...' : 'Continue Interview'}
                </Button>
                <Button onClick={handleStartNewFromModal} variant="outline" className="w-full gap-2">
                  <Mic className="w-4 h-4" /> Start New Interview
                </Button>
                <Button onClick={() => setResumeTarget(null)} variant="ghost" className="w-full">Cancel</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
