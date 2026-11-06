import React, { useEffect, useState } from 'react';
import {
  ArrowLeft, BarChart3, BookOpen, CheckCircle, ChevronRight, Circle, Clock,
  ExternalLink, GraduationCap, Languages, Play, RefreshCw, Sparkles,
  Target, Video,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { Label } from '../components/ui/label';
import {
  getLearningSubject, getLearningSubjects, toggleTopic, updateLearningPreferences,
} from '../services/learning';
import { getProfile } from '../services/user';
import { getRecommendations } from '../services/recommendation';
import {
  LearningLanguage, LearningLevel, LearningSubjectDetail, LearningSubjectsResponse, LearningVideo,
} from '../types';
import { cn } from '../lib/utils';
import toast from 'react-hot-toast';

const LANGUAGES: LearningLanguage[] = ['English', 'Telugu', 'Hindi'];
const LEVELS: LearningLevel[] = ['Beginner', 'Intermediate', 'Advanced'];

export default function LearningPage() {
  const [data, setData] = useState<LearningSubjectsResponse | null>(null);
  const [roleOptions, setRoleOptions] = useState<string[]>([]);
  const [role, setRole] = useState('');
  const [language, setLanguage] = useState<LearningLanguage>('English');
  const [level, setLevel] = useState<LearningLevel>('Beginner');
  const [loading, setLoading] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [detail, setDetail] = useState<LearningSubjectDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedVideo, setSelectedVideo] = useState<LearningVideo | null>(null);

  const fetchSubjects = async (overrides?: {
    targetRole?: string;
    language?: LearningLanguage;
    level?: LearningLevel;
    silent?: boolean;
  }) => {
    if (!overrides?.silent) setLoadingSubjects(true);
    try {
      const result = await getLearningSubjects({
        targetRole: overrides?.targetRole ?? role ?? undefined,
        language: overrides?.language ?? language,
        level: overrides?.level ?? level,
      });
      setData(result);
      setLanguage(result.preferences.language);
      setLevel(result.preferences.level);
      setRole(result.preferences.targetRole || '');
    } catch {
      toast.error('Failed to load learning subjects');
    } finally {
      setLoadingSubjects(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    const load = async () => {
      const [profile, recommendations] = await Promise.all([
        getProfile().catch(() => null),
        getRecommendations().catch(() => []),
      ]);
      const roles = Array.from(new Set([
        profile?.targetRole,
        ...recommendations.map(rec => rec.careerTitle),
      ].filter((value): value is string => !!value && !!value.trim())));
      setRoleOptions(roles);
      const initialRole = profile?.targetRole || roles[0] || '';
      setRole(initialRole);
      if (profile?.preferredLanguage) setLanguage(profile.preferredLanguage as LearningLanguage);
      if (profile?.learningLevel) setLevel(profile.learningLevel as LearningLevel);
      await fetchSubjects({
        targetRole: initialRole,
        language: (profile?.preferredLanguage as LearningLanguage) || 'English',
        level: (profile?.learningLevel as LearningLevel) || 'Beginner',
      });
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreferenceChange = async (next: {
    targetRole?: string;
    language?: LearningLanguage;
    level?: LearningLevel;
  }) => {
    const nextRole = next.targetRole ?? role;
    const nextLanguage = next.language ?? language;
    const nextLevel = next.level ?? level;
    setRole(nextRole);
    setLanguage(nextLanguage);
    setLevel(nextLevel);
    try {
      await updateLearningPreferences({
        targetRole: nextRole,
        preferredLanguage: nextLanguage,
        learningLevel: nextLevel,
      });
    } catch {
      toast.error('Failed to save learning preferences');
    }
    await fetchSubjects({
      targetRole: nextRole,
      language: nextLanguage,
      level: nextLevel,
      silent: true,
    });
  };

  const openSubject = async (key: string) => {
    setDetailLoading(true);
    setDetail(null);
    setSelectedVideo(null);
    try {
      const result = await getLearningSubject(key, { language, level, targetRole: role });
      setDetail(result);
      setSelectedVideo(result.videos[0] || null);
    } catch {
      toast.error('Failed to load subject');
    } finally {
      setDetailLoading(false);
    }
  };

  const refreshDetail = async (key: string) => {
    const result = await getLearningSubject(key, { language, level, targetRole: role });
    setDetail(result);
  };

  const handleToggleTopic = async (topic: string, completed: boolean) => {
    if (!detail) return;
    try {
      const result = await toggleTopic(detail.subject.key, topic, completed, {
        language: detail.preferences.language,
        level: detail.preferences.level,
      });
      setDetail(prev => prev ? {
        ...prev,
        completedTopics: result.completedTopics,
        progress: result.progress,
        nextTopics: prev.subject.topics.filter(item => !result.completedTopics.includes(item)).slice(0, 3),
      } : prev);
      setData(prev => prev ? {
        ...prev,
        subjects: prev.subjects.map(subject => subject.key === detail.subject.key
          ? { ...subject, completedTopics: result.completedTopics, progress: result.progress }
          : subject),
        recommendedSubjects: prev.recommendedSubjects.map(subject => subject.key === detail.subject.key
          ? { ...subject, completedTopics: result.completedTopics, progress: result.progress }
          : subject),
      } : prev);
    } catch {
      toast.error('Failed to update progress');
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;
  }

  if (detail) {
    const activeVideo = selectedVideo || detail.videos[0] || null;
    return (
      <div className="space-y-6 animate-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setDetail(null)} className="gap-2">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">{detail.subject.title}</h1>
              <p className="text-sm text-muted-foreground">{detail.subject.category} · {detail.subject.level} · {detail.preferences.language}</p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => refreshDetail(detail.subject.key)} className="gap-2">
            <RefreshCw className="w-4 h-4" /> Refresh videos
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <Card className="overflow-hidden">
              {activeVideo ? (
                <>
                  <div className="aspect-video w-full bg-black">
                    <iframe
                      key={activeVideo.videoId}
                      src={`https://www.youtube-nocookie.com/embed/${activeVideo.videoId}?rel=0`}
                      title={activeVideo.title}
                      className="w-full h-full"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-sm">{activeVideo.title}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {activeVideo.channel}{activeVideo.duration ? ` · ${activeVideo.duration}` : ''} · {activeVideo.language || detail.preferences.language}
                        </p>
                      </div>
                      <a href={activeVideo.url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline shrink-0 flex items-center gap-1">
                        YouTube <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                    {activeVideo.description && <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{activeVideo.description}</p>}
                    {activeVideo.isFallback && <p className="text-[10px] text-yellow-400 mt-2">Showing a fallback video. Add a YOUTUBE_API_KEY on the backend for fresher results.</p>}
                  </CardContent>
                </>
              ) : (
                <CardContent className="p-8 text-center">
                  <Video className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium">No video available yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Try refreshing, changing the language, or searching YouTube for this topic.</p>
                  <a
                    href={`https://www.youtube.com/results?search_query=${encodeURIComponent(detail.subject.title + ' ' + detail.preferences.language + ' ' + detail.preferences.level)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-3"
                  >
                    Search on YouTube <ExternalLink className="w-3 h-3" />
                  </a>
                </CardContent>
              )}
            </Card>

            {detail.videos.length > 1 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><Video className="w-4 h-4 text-primary" /> More videos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {detail.videos.slice(0, 8).map(video => (
                    <button
                      key={video.videoId}
                      onClick={() => setSelectedVideo(video)}
                      className={cn(
                        'w-full flex items-center gap-3 p-2 rounded-lg text-left transition-colors',
                        activeVideo?.videoId === video.videoId ? 'bg-primary/10 border border-primary/20' : 'hover:bg-secondary/50'
                      )}
                    >
                      <img src={video.thumbnail} alt="" className="w-20 h-12 rounded object-cover shrink-0" loading="lazy" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium line-clamp-2">{video.title}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{video.channel}{video.duration ? ` · ${video.duration}` : ''}</p>
                      </div>
                    </button>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-medium">Progress</p>
                  <span className="text-sm font-bold text-primary">{detail.progress}%</span>
                </div>
                <Progress value={detail.progress} className="h-2" />
                <p className="text-xs text-muted-foreground mt-2">{detail.completedTopics.length}/{detail.subject.topics.length} topics completed</p>
                <p className="text-xs text-muted-foreground mt-3">{detail.subject.description}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {detail.subject.skills.map(skill => <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> Topics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {detail.subject.topics.map(topic => {
                  const done = detail.completedTopics.some(item => item.toLowerCase() === topic.toLowerCase());
                  return (
                    <button
                      key={topic}
                      onClick={() => handleToggleTopic(topic, !done)}
                      className="w-full flex items-center gap-2 p-2 rounded-lg text-left hover:bg-secondary/50 transition-colors"
                    >
                      {done
                        ? <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                        : <Circle className="w-4 h-4 text-muted-foreground shrink-0" />}
                      <span className={cn('text-sm', done && 'line-through text-muted-foreground')}>{topic}</span>
                    </button>
                  );
                })}
              </CardContent>
            </Card>

            {detail.subject && (detail as any).nextTopics?.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm flex items-center gap-2"><ChevronRight className="w-4 h-4 text-primary" /> Learn next</CardTitle>
                </CardHeader>
                <CardContent className="space-y-1">
                  {(detail as any).nextTopics.map((topic: string) => (
                    <p key={topic} className="text-sm text-muted-foreground flex items-center gap-2"><span className="w-1.5 h-1.5 rounded-full bg-primary/60" />{topic}</p>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    );
  }

  const subjects = data?.subjects || [];
  const recommended = data?.recommendedSubjects || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <GraduationCap className="w-6 h-6 text-primary" /> Learning Hub
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Role-aware topics and curated YouTube videos in your preferred language</p>
        </div>
        <Button variant="outline" onClick={() => fetchSubjects({ silent: false })} disabled={loadingSubjects} className="gap-2">
          <RefreshCw className={cn('w-4 h-4', loadingSubjects && 'animate-spin')} /> Refresh
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Target className="w-3 h-3" /> Target role</Label>
            <input
              list="learning-role-options"
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              placeholder="All role paths — type a target role"
              value={role}
              onChange={e => setRole(e.target.value)}
              onBlur={() => handlePreferenceChange({ targetRole: role })}
              onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            />
            <datalist id="learning-role-options">
              {roleOptions.map(option => <option key={option} value={option} />)}
            </datalist>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><Languages className="w-3 h-3" /> Language</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={language}
              onChange={e => handlePreferenceChange({ language: e.target.value as LearningLanguage })}
            >
              {LANGUAGES.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
          <div className="space-y-2">
            <Label className="flex items-center gap-1"><BarChart3 className="w-3 h-3" /> Level</Label>
            <select
              className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={level}
              onChange={e => handlePreferenceChange({ level: e.target.value as LearningLevel })}
            >
              {LEVELS.map(item => <option key={item} value={item}>{item}</option>)}
            </select>
          </div>
        </CardContent>
      </Card>

      {data?.gapSkills && data.gapSkills.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Recommended from your skill gaps</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {data.gapSkills.map(gap => (
                <Badge key={`${gap.skillName}-${gap.priority}`} variant={gap.priority === 'CRITICAL' ? 'destructive' : 'warning'} className="text-xs py-1">
                  {gap.skillName}{gap.requiredLevel ? ` · ${gap.currentLevel || 'NONE'} → ${gap.requiredLevel}` : ''}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {recommended.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Sparkles className="w-4 h-4 text-primary" /> Recommended for {role || 'you'}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommended.map(subject => <SubjectCard key={subject.key} subject={subject} onOpen={openSubject} language={language} level={level} />)}
          </div>
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2"><BookOpen className="w-4 h-4 text-primary" /> All subjects ({subjects.length})</h2>
          {loadingSubjects && <span className="text-xs text-muted-foreground">Updating…</span>}
        </div>
        {subjects.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <GraduationCap className="w-14 h-14 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">No subjects found</p>
              <p className="text-xs text-muted-foreground mt-1">Set a target role or refresh to load learning paths.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {subjects.map(subject => <SubjectCard key={subject.key} subject={subject} onOpen={openSubject} language={language} level={level} />)}
          </div>
        )}
      </div>

      {detailLoading && (
        <div className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      )}
    </div>
  );
}

function SubjectCard({
  subject, onOpen, language, level,
}: {
  subject: LearningSubjectsResponse['subjects'][number];
  onOpen: (key: string) => void;
  language: LearningLanguage;
  level: LearningLevel;
}) {
  return (
    <Card className={cn('glass-hover flex flex-col', subject.isRecommended && 'ring-1 ring-primary/20')}>
      <CardContent className="p-4 flex flex-col flex-1">
        <div className="flex items-center justify-between mb-2 gap-2">
          <Badge variant="outline" className="text-[10px]">{subject.category}</Badge>
          <div className="flex items-center gap-1">
            {subject.isRoleSubject && <Badge className="text-[10px] bg-primary/10 text-primary">Role</Badge>}
            {subject.isRecommended && <Badge className="text-[10px] bg-yellow-500/10 text-yellow-400">Recommended</Badge>}
          </div>
        </div>
        <h3 className="font-medium text-sm mb-1">{subject.title}</h3>
        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{subject.description}</p>
        <div className="flex flex-wrap gap-1 mb-3">
          {subject.skills.slice(0, 3).map(skill => <Badge key={skill} variant="secondary" className="text-[10px]">{skill}</Badge>)}
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3 mt-auto">
          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {subject.topics.length} topics</span>
          <span className="flex items-center gap-1"><Play className="w-3 h-3" /> {subject.hasVideo ? 'Curated video' : 'YouTube'}</span>
        </div>
        {subject.progress > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">{subject.progress}% complete</span>
              <span className="text-muted-foreground">{subject.completedTopics.length}/{subject.topics.length}</span>
            </div>
            <Progress value={subject.progress} className="h-1.5" />
          </div>
        )}
        <Button size="sm" className="w-full gap-1" onClick={() => onOpen(subject.key)}>
          <Play className="w-3 h-3" /> {subject.progress > 0 ? 'Continue' : 'Start learning'}
        </Button>
        <p className="text-[10px] text-muted-foreground mt-2 text-center">{language} · {level}</p>
      </CardContent>
    </Card>
  );
}
