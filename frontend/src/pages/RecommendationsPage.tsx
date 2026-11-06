import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Brain, Sparkles, CheckCircle, AlertTriangle, Shield, TrendingUp, IndianRupee, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Badge } from '../components/ui/badge';
import { getRecommendations, generateRecommendations, acceptRecommendation } from '../services/recommendation';
import { Recommendation } from '../types';
import { getScoreColor, formatDate } from '../lib/utils';
import toast from 'react-hot-toast';

export default function RecommendationsPage() {
  const navigate = useNavigate();
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const data = await getRecommendations();
      setRecommendations(data);
    } catch (error) {
      console.error('Failed to fetch recommendations:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const data = await generateRecommendations();
      setRecommendations(data);
      toast.success('Recommendations generated!');
    } catch {
      toast.error('Generation failed');
    } finally {
      setGenerating(false);
    }
  };

  const handleAccept = async (rec: Recommendation) => {
    if (rec.isAccepted) {
      navigate('/roadmap');
      return;
    }
    setAcceptingId(rec.id);
    try {
      await acceptRecommendation(rec.id);
      toast.success('Roadmap created!');
      navigate('/roadmap');
    } catch {
      toast.error('Failed to create roadmap');
    } finally {
      setAcceptingId(null);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  return (
    <div className="space-y-6 animate-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Career Recommendations</h1>
          <p className="text-muted-foreground text-sm mt-1">AI-powered career paths based on your profile and market data</p>
        </div>
        <Button onClick={handleGenerate} disabled={generating} className="gap-2">
          <Sparkles className="w-4 h-4" /> {generating ? 'Generating...' : 'Generate New'}
        </Button>
      </div>

      {recommendations.length === 0 ? (
        <Card>
          <CardContent className="text-center py-12">
            <Brain className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Recommendations Yet</h3>
            <p className="text-muted-foreground mb-6">Generate AI-powered career recommendations based on your skills, education, and market trends.</p>
            <Button onClick={handleGenerate} disabled={generating}>
              <Sparkles className="w-4 h-4 mr-2" /> Generate Recommendations
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {recommendations.map((rec) => (
            <Card key={rec.id} className={cn('glass-hover', selected === rec.id ? 'ring-2 ring-primary' : '')}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">{rec.careerTitle}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge variant={rec.isVerified ? 'success' : 'warning'}>
                        <Shield className="w-3 h-3 mr-1" />
                        {rec.isVerified ? 'Verified' : 'Low Confidence'}
                      </Badge>
                      {rec.isAccepted && <Badge variant="default">Accepted</Badge>}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-2xl font-bold ${getScoreColor(rec.matchPercentage)}`}>{rec.matchPercentage}%</p>
                    <p className="text-xs text-muted-foreground">Match</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <Brain className="w-3 h-3" /> Confidence
                    </div>
                    <p className={`text-sm font-semibold ${getScoreColor(rec.confidenceScore)}`}>{rec.confidenceScore}%</p>
                  </div>
                  <div className="p-3 rounded-lg bg-secondary/30">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                      <TrendingUp className="w-3 h-3" /> Demand
                    </div>
                    <p className="text-sm font-semibold">{rec.industryDemand || 'High'}</p>
                  </div>
                </div>

                <Progress value={rec.matchPercentage} className="h-1.5 mb-4" />

                {rec.reasons && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Why this is recommended:</p>
                    <div className="space-y-1">
                      {JSON.parse(rec.reasons).map((reason: string, i: number) => (
                        <p key={i} className="text-sm flex items-start gap-2">
                          <CheckCircle className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                          {reason}
                        </p>
                      ))}
                    </div>
                  </div>
                )}

                {rec.requiredSkills && (
                  <div className="mb-4">
                    <p className="text-xs text-muted-foreground mb-2 font-medium">Required Skills:</p>
                    <div className="flex flex-wrap gap-1.5">
                      {JSON.parse(rec.requiredSkills).map((skill: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs">{skill}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {rec.salaryInsights && (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                    <IndianRupee className="w-3 h-3" />
                    {JSON.parse(rec.salaryInsights)?.entry || 'N/A'} - {JSON.parse(rec.salaryInsights)?.senior || 'N/A'}
                  </div>
                )}

                {rec.isAccepted ? (
                  <Button variant="outline" className="w-full" onClick={() => handleAccept(rec)}>
                    <CheckCircle className="w-4 h-4 mr-2" /> View Roadmap
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    onClick={() => handleAccept(rec)}
                    disabled={acceptingId !== null}
                  >
                    {acceptingId === rec.id ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating roadmap...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" /> Accept & Create Roadmap
                      </>
                    )}
                  </Button>
                )}

                {!rec.isVerified && (
                  <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mt-3">
                    <p className="text-xs text-yellow-400 flex items-start gap-2">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                      {rec.verificationSource || 'Low confidence recommendation. Upload your resume or provide more information for better accuracy.'}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function cn(...classes: any[]) { return classes.filter(Boolean).join(' '); }
