import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, AlertTriangle, CheckCircle, Zap, Brain, Sparkles, BookOpen, Route, X, ListChecks } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { getSkillGaps, analyzeSkillGaps, updateSkillGap } from '../services/skillGap';
import { SkillGap } from '../types';
import toast from 'react-hot-toast';

function gapSeverity(gapValue: number): { text: string; bar: string } {
  if (gapValue >= 50) return { text: 'text-red-400', bar: 'bg-red-500' };
  if (gapValue >= 25) return { text: 'text-yellow-400', bar: 'bg-yellow-500' };
  return { text: 'text-green-400', bar: 'bg-green-500' };
}

const skillTopics: Record<string, string[]> = {
  JavaScript: ['Variables & Scope', 'Closures & Hoisting', 'Promises & Async/Await', 'DOM Manipulation', 'ES6+ Features', 'Event Loop', 'Prototypes & Inheritance'],
  Python: ['Data Types & Structures', 'Functions & Decorators', 'OOP in Python', 'File I/O & Modules', 'Error Handling', 'List Comprehensions & Generators', 'Popular Libraries (NumPy, Pandas)'],
  React: ['JSX & Components', 'State & Props', 'Hooks (useState, useEffect)', 'Context API', 'React Router', 'Performance Optimization', 'Testing with Jest/RTL'],
  TypeScript: ['Basic Types & Interfaces', 'Generics & Enums', 'Advanced Types', 'Type Guards', 'Modules & Namespaces', 'Declaration Files', 'React + TypeScript'],
  'Node.js': ['Event Loop & Callbacks', 'Express.js', 'RESTful APIs', 'Middleware', 'File System & Streams', 'Authentication (JWT)', 'Database Integration'],
  SQL: ['SELECT & Joins', 'Subqueries', 'Aggregation & Grouping', 'Indexes & Performance', 'Normalization', 'Transactions & ACID', 'Stored Procedures'],
  AWS: ['EC2 & Compute', 'S3 & Storage', 'Lambda & Serverless', 'RDS & Databases', 'VPC & Networking', 'IAM & Security', 'CloudFormation & IaC'],
  Docker: ['Images & Containers', 'Dockerfile Best Practices', 'Docker Compose', 'Volumes & Networks', 'Multi-stage Builds', 'Registry & Deployment', 'Docker Swarm'],
  Kubernetes: ['Pods & Deployments', 'Services & Networking', 'ConfigMaps & Secrets', 'Persistent Volumes', 'Helm Charts', 'Monitoring & Logging', 'RBAC & Security'],
  'Machine Learning': ['Supervised Learning', 'Unsupervised Learning', 'Feature Engineering', 'Model Evaluation', 'Neural Networks', 'NLP Basics', 'ML Pipeline & Deployment'],
  'Data Science': ['Data Wrangling', 'Exploratory Data Analysis', 'Statistical Methods', 'Data Visualization', 'A/B Testing', 'Feature Selection', 'Model Interpretation'],
  Git: ['Repository Management', 'Branching Strategies', 'Merging & Rebasing', 'Pull Requests', 'Conflict Resolution', 'Git Hooks', 'GitHub Actions'],
  DevOps: ['CI/CD Pipelines', 'Infrastructure as Code', 'Configuration Management', 'Monitoring & Alerting', 'Log Management', 'Container Orchestration', 'Cloud Services'],
  CSS: ['Flexbox & Grid', 'Responsive Design', 'Animations & Transitions', 'Preprocessors (Sass)', 'CSS-in-JS', 'Tailwind CSS', 'Custom Properties'],
  Java: ['OOP Concepts', 'Collections Framework', 'Streams & Lambdas', 'Multithreading', 'JVM Internals', 'Spring Boot', 'Unit Testing (JUnit)'],
  'C++': ['Pointers & Memory', 'STL Containers', 'OOP & Templates', 'Move Semantics', 'Multithreading', 'File I/O', 'Design Patterns'],
  Go: ['Goroutines & Channels', 'Interfaces & Structs', 'Error Handling', 'Packages & Modules', 'Testing & Benchmarking', 'HTTP Servers', 'Concurrency Patterns'],
};

function getSkillTopics(skillName: string): string[] {
  const normalized = skillName.toLowerCase().replace(/[^a-z0-9]/g, '');

  const keys = Object.keys(skillTopics).sort((a, b) => b.length - a.length);
  for (const key of keys) {
    const keyNorm = key.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (keyNorm === normalized || normalized.startsWith(keyNorm)) return skillTopics[key];
  }

  const unique: string[] = [];
  const seen = new Set<string>();
  for (const t of [`${skillName} Fundamentals`, `${skillName} Best Practices`, `${skillName} Tools & Frameworks`, `Advanced ${skillName}`, `${skillName} Projects & Portfolio`]) {
    const lower = t.toLowerCase();
    if (!seen.has(lower)) { seen.add(lower); unique.push(t); }
  }
  return unique;
}

export default function SkillGapsPage() {
  const navigate = useNavigate();
  const [gaps, setGaps] = useState<SkillGap[]>([]);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [learningSkill, setLearningSkill] = useState<SkillGap | null>(null);

  const fetchData = async () => {
    try {
      const data = await getSkillGaps();
      setGaps(data);
    } catch { console.error('Failed to fetch skill gaps'); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const data = await analyzeSkillGaps();
      setGaps(data);
      toast.success('Skill gap analysis complete!');
    } catch { toast.error('Analysis failed'); }
    finally { setAnalyzing(false); }
  };

  const handleToggleAddress = async (id: string, current: boolean) => {
    try {
      await updateSkillGap(id, { isBeingAddressed: !current });
      fetchData();
    } catch { toast.error('Update failed'); }
  };

  const priorityOrder = { CRITICAL: 0, RECOMMENDED: 1, OPTIONAL: 2 };
  const sortedGaps = [...gaps].sort((a, b) => (priorityOrder[a.priority as keyof typeof priorityOrder] || 99) - (priorityOrder[b.priority as keyof typeof priorityOrder] || 99));

  const criticalCount = gaps.filter(g => g.priority === 'CRITICAL').length;
  const recommendedCount = gaps.filter(g => g.priority === 'RECOMMENDED').length;
  const addressedCount = gaps.filter(g => g.isBeingAddressed).length;

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Skill Gap Analysis</h1>
          <p className="text-muted-foreground text-sm mt-1">Identify and bridge the gap between your skills and industry requirements</p>
        </div>
        <Button onClick={handleAnalyze} disabled={analyzing} className="gap-2">
          <Brain className="w-4 h-4" /> {analyzing ? 'Analyzing...' : 'Analyze Gaps'}
        </Button>
      </div>

      {gaps.length > 0 && (
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-400">{criticalCount}</p>
              <p className="text-xs text-muted-foreground">Critical Gaps</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-yellow-400">{recommendedCount}</p>
              <p className="text-xs text-muted-foreground">Recommended</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-400">{addressedCount}</p>
              <p className="text-xs text-muted-foreground">Being Addressed</p>
            </CardContent>
          </Card>
        </div>
      )}

      {sortedGaps.length > 0 ? (
        <div className="space-y-3">
          {sortedGaps.map(gap => (
            <Card key={gap.id} className={`glass-hover ${gap.isBeingAddressed ? 'border-green-500/20' : gap.priority === 'CRITICAL' ? 'border-red-500/20' : ''}`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  gap.priority === 'CRITICAL' ? 'bg-red-500/10' : gap.priority === 'RECOMMENDED' ? 'bg-yellow-500/10' : 'bg-secondary'
                }`}>
                  {gap.priority === 'CRITICAL' ? <AlertTriangle className="w-5 h-5 text-red-400" /> :
                   gap.priority === 'RECOMMENDED' ? <Zap className="w-5 h-5 text-yellow-400" /> :
                   <CheckCircle className="w-5 h-5 text-muted-foreground" />}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{gap.skillName}</span>
                    <Badge className={`text-[10px] ${gap.priority === 'CRITICAL' ? 'bg-red-500/10 text-red-400' : gap.priority === 'RECOMMENDED' ? 'bg-yellow-500/10 text-yellow-400' : 'bg-secondary text-muted-foreground'}`}>
                      {gap.priority}
                    </Badge>
                    {gap.isBeingAddressed && <Badge variant="success" className="text-[10px]">In Progress</Badge>}
                  </div>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-xs text-muted-foreground">
                      You: {gap.currentLevel || 'NONE'} → Need: {gap.requiredLevel || 'ADVANCED'}
                    </span>
                  </div>
                  {(() => {
                    const gapValue = Math.min(100, Math.max(0, gap.gap ?? 0));
                    const sev = gapSeverity(gapValue);
                    return (
                      <>
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Skill missing</span>
                          <span className={`text-xs font-medium ${sev.text}`}>{gapValue}% missing</span>
                        </div>
                        <Progress value={gapValue} indicatorClassName={sev.bar} className="mt-1 h-1.5" />
                      </>
                    );
                  })()}
                </div>
                <Button variant="outline" size="sm" onClick={() => setLearningSkill(gap)} className="gap-1">
                  <BookOpen className="w-3 h-3" /> {gap.isBeingAddressed ? 'Continue' : 'Start Learning'}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="text-center py-12">
            <Target className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Skill Gaps Identified</h3>
            <p className="text-muted-foreground mb-6">Run a skill gap analysis to identify areas for improvement.</p>
            <Button onClick={handleAnalyze} disabled={analyzing}>
              <Brain className="w-4 h-4 mr-2" /> Analyze Now
            </Button>
          </CardContent>
        </Card>
      )}

      {learningSkill && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setLearningSkill(null)}>
          <div className="bg-card border border-border rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{learningSkill.skillName}</h3>
                <Badge className={`text-[10px] ${learningSkill.priority === 'CRITICAL' ? 'bg-red-500/10 text-red-400' : 'bg-yellow-500/10 text-yellow-400'}`}>
                  {learningSkill.priority}
                </Badge>
              </div>
              <button onClick={() => setLearningSkill(null)} className="p-1 hover:bg-secondary rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  You: {learningSkill.currentLevel || 'NONE'} → Need: {learningSkill.requiredLevel || 'ADVANCED'}
                </p>
                {(() => {
                  const gapValue = Math.min(100, Math.max(0, learningSkill.gap ?? 0));
                  const sev = gapSeverity(gapValue);
                  return (
                    <>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Skill missing</span>
                        <span className={`text-xs font-medium ${sev.text}`}>{gapValue}% missing</span>
                      </div>
                      <Progress value={gapValue} indicatorClassName={sev.bar} className="h-1.5" />
                    </>
                  );
                })()}
              </div>
              <div>
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <ListChecks className="w-4 h-4 text-primary" /> Focus Topics
                </h4>
                <div className="grid grid-cols-1 gap-2">
                  {getSkillTopics(learningSkill.skillName).map((topic, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/30 rounded-lg px-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary/60 shrink-0" />
                      {topic}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <Button className="flex-1 gap-2" onClick={() => {
                  handleToggleAddress(learningSkill.id, learningSkill.isBeingAddressed);
                  navigate(`/roadmap?skill=${encodeURIComponent(learningSkill.skillName)}`);
                  setLearningSkill(null);
                }}>
                  <Route className="w-4 h-4" /> Create Roadmap for {learningSkill.skillName}
                </Button>
                <Button variant="outline" onClick={() => setLearningSkill(null)}>Close</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
