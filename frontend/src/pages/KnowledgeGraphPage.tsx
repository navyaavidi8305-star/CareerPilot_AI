import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BookOpen, Briefcase, CheckCircle, GraduationCap, Microscope, Network,
  RefreshCw, Target, X,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Progress } from '../components/ui/progress';
import { getKnowledgeGraph } from '../services/graph';
import { KnowledgeGraphData, KnowledgeGraphNode } from '../types';
import { getScoreColor } from '../lib/utils';
import * as d3 from 'd3';
import toast from 'react-hot-toast';

export default function KnowledgeGraphPage() {
  const navigate = useNavigate();
  const svgRef = useRef<SVGSVGElement>(null);
  const [data, setData] = useState<KnowledgeGraphData | null>(null);
  const [selected, setSelected] = useState<KnowledgeGraphNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setError('');
    try {
      const result = await getKnowledgeGraph();
      setData(result);
    } catch {
      setError('Failed to load your knowledge graph.');
      toast.error('Failed to load knowledge graph');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!data || !svgRef.current) return;
    const svgElement = svgRef.current;
    const width = svgElement.clientWidth || 900;
    const height = 620;
    const nodes: any[] = data.nodes.map(node => ({ ...node }));
    const links: any[] = data.links.map(link => ({ ...link }));

    const svg = d3.select(svgElement);
    svg.selectAll('*').remove();
    const root = svg.append('g');

    const radiusFor = (node: any) => {
      if (node.type === 'profile') return 16;
      if (node.type === 'career') return 12;
      if (node.type === 'learning') return 7;
      if (node.type === 'skill') return 9;
      return 7;
    };

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance((link: any) => link.type === 'HAS_SKILL' ? 80 : 120).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-260))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius((d: any) => radiusFor(d) + 18));

    const link = root.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', 'hsl(var(--border))')
      .attr('stroke-width', (d: any) => d.type === 'AIMS_FOR' ? 2 : 1)
      .attr('stroke-opacity', 0.35);

    const node = root.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .style('cursor', 'pointer')
      .on('click', (_event: any, d: any) => setSelected(d))
      .call(
        d3.drag<any, any>()
          .on('start', (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
          })
          .on('drag', (event: any, d: any) => {
            d.fx = event.x;
            d.fy = event.y;
          })
          .on('end', (event: any, d: any) => {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
          }) as any
      );

    node.append('circle')
      .attr('r', (d: any) => radiusFor(d))
      .attr('fill', (d: any) => d.color || '#6366f1')
      .attr('stroke', 'hsl(var(--background))')
      .attr('stroke-width', 2)
      .attr('opacity', (d: any) => d.type === 'gap' ? 0.9 : 0.85);

    node.append('text')
      .text((d: any) => d.label)
      .attr('x', (d: any) => radiusFor(d) + 4)
      .attr('y', 4)
      .attr('font-size', (d: any) => d.type === 'profile' || d.type === 'career' ? 11 : 9)
      .attr('font-weight', (d: any) => d.type === 'profile' || d.type === 'career' ? 600 : 400)
      .attr('fill', 'hsl(var(--foreground))')
      .attr('opacity', 0.85)
      .style('pointer-events', 'none');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    const zoom = d3.zoom().scaleExtent([0.25, 3]).on('zoom', event => {
      root.attr('transform', event.transform);
    });
    svg.call(zoom as any);

    return () => { simulation.stop(); };
  }, [data]);

  const role = data?.targetRole || null;
  const categories = data?.categories || [];

  return (
    <div className="space-y-6 animate-in">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Microscope className="w-6 h-6 text-primary" /> Knowledge Graph
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Your skills, gaps, target role, learning paths and roadmap in one connected map</p>
        </div>
        <Button variant="outline" onClick={fetchData} disabled={loading} className="gap-2">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
        </Button>
      </div>

      {data && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {[
            { label: 'Nodes', value: data.stats.nodes },
            { label: 'Skills', value: data.stats.skills },
            { label: 'Gaps', value: data.stats.gaps },
            { label: 'Careers', value: data.stats.careers },
            { label: 'Learning paths', value: data.stats.learningPaths },
            { label: 'Connections', value: data.stats.links },
          ].map(stat => (
            <Card key={stat.label}>
              <CardContent className="p-3 text-center">
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {role && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" /> Target role: {role.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${getScoreColor(role.matchPercentage)}`}>{role.matchPercentage}%</span>
                <span className="text-xs text-muted-foreground">match</span>
              </div>
              <Badge variant="outline">{role.category || 'Career'}</Badge>
              {role.salaryRange && <Badge variant="secondary">{role.salaryRange}</Badge>}
              {role.demand && <Badge variant="warning">Demand: {role.demand}</Badge>}
              {role.growth && <Badge variant="success">Growth: {role.growth}</Badge>}
            </div>
            <Progress value={role.matchPercentage} className="h-2" />
            <p className="text-sm text-muted-foreground">{role.description}</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/10">
                <p className="text-xs font-medium text-green-400 mb-2 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> Matching skills ({role.matchingSkills.length})</p>
                <div className="flex flex-wrap gap-1">
                  {role.matchingSkills.length > 0
                    ? role.matchingSkills.map(skill => <Badge key={skill} variant="success" className="text-[10px]">{skill}</Badge>)
                    : <span className="text-xs text-muted-foreground">None yet</span>}
                </div>
              </div>
              <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/10">
                <p className="text-xs font-medium text-red-400 mb-2 flex items-center gap-1"><Target className="w-3 h-3" /> Missing skills ({role.missingSkills.length})</p>
                <div className="flex flex-wrap gap-1">
                  {role.missingSkills.length > 0
                    ? role.missingSkills.map(skill => <Badge key={skill} variant="destructive" className="text-[10px]">{skill}</Badge>)
                    : <span className="text-xs text-muted-foreground">No gaps</span>}
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {role.learningPaths.slice(0, 6).map(path => (
                <Badge key={path.key} variant="secondary" className="text-[10px]">{path.title}</Badge>
              ))}
              <Button size="sm" variant="outline" onClick={() => navigate('/learning')} className="gap-1 ml-auto">
                <BookOpen className="w-3 h-3" /> Open learning hub
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="relative">
        <CardContent className="p-0">
          {error ? (
            <div className="py-16 text-center">
              <Network className="w-14 h-14 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">{error}</p>
              <Button variant="outline" className="mt-3" onClick={fetchData}>Try again</Button>
            </div>
          ) : (data?.nodes.length || 0) <= 1 ? (
            <div className="py-16 text-center">
              <Network className="w-14 h-14 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-medium">Your graph is still empty</p>
              <p className="text-xs text-muted-foreground mt-1">Add skills, run a skill-gap analysis, or generate recommendations to populate it.</p>
            </div>
          ) : (
            <svg ref={svgRef} className="w-full" style={{ height: '620px' }} />
          )}
          {loading && (
            <div className="absolute inset-0 flex items-center justify-center bg-card/60">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
          )}
        </CardContent>
      </Card>

      {categories.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {categories.map(category => (
            <div key={category.id} className="flex items-center gap-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: category.color }} />
              {category.label} ({category.count})
            </div>
          ))}
        </div>
      )}

      {selected && (
        <Card>
          <CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 rounded-full mt-1.5" style={{ backgroundColor: selected.color }} />
                <div>
                  <p className="font-medium text-sm">{selected.label}</p>
                  <div className="flex flex-wrap items-center gap-2 mt-1">
                    <Badge variant="outline" className="text-[10px]">{selected.type}</Badge>
                    <Badge variant="secondary" className="text-[10px]">{selected.group}</Badge>
                    {selected.level && <Badge variant="secondary" className="text-[10px]">{selected.level}</Badge>}
                    {selected.match != null && <span className={`text-xs ${getScoreColor(selected.match)}`}>Match: {selected.match}%</span>}
                    {selected.priority && <Badge variant="destructive" className="text-[10px]">{selected.priority}</Badge>}
                  </div>
                  {selected.meta && Object.keys(selected.meta).length > 0 && (
                    <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground">
                      {Object.entries(selected.meta)
                        .filter(([, value]) => value != null && value !== '' && typeof value !== 'object')
                        .slice(0, 10)
                        .map(([key, value]) => (
                          <p key={key}><span className="capitalize text-foreground/70">{key.replace(/([A-Z])/g, ' $1')}:</span> {String(value)}</p>
                        ))}
                    </div>
                  )}
                  {selected.meta?.topics && Array.isArray(selected.meta.topics) && (
                    <div className="flex flex-wrap gap-1 mt-3">
                      {selected.meta.topics.slice(0, 10).map((topic: string) => <Badge key={topic} variant="secondary" className="text-[10px]">{topic}</Badge>)}
                    </div>
                  )}
                  {selected.meta?.learningSubjectKey && (
                    <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => navigate('/learning')}>
                      <GraduationCap className="w-3 h-3" /> Learn {selected.meta.learningSubjectTitle || 'this skill'}
                    </Button>
                  )}
                  {selected.type === 'career' && (
                    <Button size="sm" variant="outline" className="mt-3 gap-1" onClick={() => navigate('/recommendations')}>
                      <Briefcase className="w-3 h-3" /> View recommendations
                    </Button>
                  )}
                </div>
              </div>
              <button onClick={() => setSelected(null)} className="p-1 hover:bg-secondary rounded"><X className="w-4 h-4" /></button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
