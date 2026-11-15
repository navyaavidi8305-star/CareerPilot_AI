import React, { useEffect, useState } from 'react';
import { TrendingUp, Building2, IndianRupee, Zap, ArrowUp, ArrowDown, Minus } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { getMarketInsights, getTrendingSkills, getTopCompanies } from '../services/market';
import { MarketInsight } from '../types';
import { getScoreColor } from '../lib/utils';

export default function MarketPage() {
  const [insights, setInsights] = useState<MarketInsight[]>([]);
  const [trendingSkills, setTrendingSkills] = useState<MarketInsight[]>([]);
  const [companies, setCompanies] = useState<MarketInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [all, skills, comps] = await Promise.all([
          getMarketInsights(),
          getTrendingSkills(),
          getTopCompanies(),
        ]);
        setInsights(all);
        setTrendingSkills(skills);
        setCompanies(comps);
      } catch {
        setError(true);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const futureSkills = insights.filter(i => i.category === 'FUTURE_SKILL');

  const TrendIcon = ({ trend }: { trend?: string }) => {
    if (trend === 'UP') return <ArrowUp className="w-3 h-3 text-green-400" />;
    if (trend === 'DOWN') return <ArrowDown className="w-3 h-3 text-red-400" />;
    return <Minus className="w-3 h-3 text-yellow-400" />;
  };

  if (loading) return <div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" /></div>;

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
        <p className="text-sm font-medium text-foreground">Could not load market intelligence</p>
        <p className="text-xs text-muted-foreground">Please refresh the page or try again later.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Market Intelligence</h1>
        <p className="text-muted-foreground text-sm mt-1">Real-time insights into skills, salaries, and industry trends</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" /> Trending Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {trendingSkills.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No trending skills available yet.</p>
              )}
              {trendingSkills.slice(0, 10).map(skill => (
                <div key={skill.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendIcon trend={skill.trend} />
                    <span className="text-sm">{skill.skill}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Progress value={skill.percentage || 0} className="w-20 h-1.5" />
                    <span className={`text-xs font-medium ${getScoreColor(skill.percentage || 0)}`}>{skill.percentage}%</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" /> Top Hiring Companies
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {companies.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">No company data available yet.</p>
              )}
              {companies.slice(0, 10).map(company => (
                <div key={company.id} className="flex items-center justify-between p-2 rounded-lg glass-hover">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-xs font-bold">
                      {company.title?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{company.title}</p>
                      <p className="text-xs text-muted-foreground">{company.description}</p>
                    </div>
                  </div>
                  <Badge variant={company.trend === 'UP' ? 'success' : 'secondary'}>
                    {company.percentage}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {futureSkills.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" /> Future Skills
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {futureSkills.map(skill => (
                <div key={skill.id} className="p-3 rounded-lg border border-border bg-card/50 text-center">
                  <p className="text-sm font-medium">{skill.skill}</p>
                  <p className={`text-lg font-bold mt-1 ${getScoreColor(skill.percentage || 0)}`}>{skill.percentage}%</p>
                  <p className="text-[10px] text-muted-foreground">Emerging potential</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <IndianRupee className="w-4 h-4 text-primary" /> Market Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {insights.filter(i => i.category === 'SALARY_TREND' || i.category === 'INDUSTRY_DEMAND').length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 md:col-span-2 lg:col-span-3">No market overview data available yet.</p>
            )}
            {insights.filter(i => i.category === 'SALARY_TREND' || i.category === 'INDUSTRY_DEMAND').slice(0, 6).map(insight => (
              <div key={insight.id} className="p-4 rounded-lg border border-border glass-hover">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-muted-foreground">{insight.category?.replace('_', ' ')}</span>
                  <TrendIcon trend={insight.trend} />
                </div>
                <p className="text-sm font-medium">{insight.title || insight.skill}</p>
                {insight.percentage && (
                  <div className="flex items-center gap-2 mt-2">
                    <Progress value={insight.percentage} className="h-1.5 flex-1" />
                    <span className="text-xs font-medium">{insight.percentage}%</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
