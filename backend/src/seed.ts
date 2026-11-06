import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  const skills = ['JavaScript', 'Python', 'TypeScript', 'React', 'Node.js', 'SQL', 'Machine Learning',
    'Data Science', 'Cloud Computing', 'DevOps', 'Docker', 'Kubernetes', 'AWS', 'Django', 'Flutter',
    'Go', 'Rust', 'System Design', 'DSA', 'Blockchain', 'AI', 'Deep Learning', 'NLP', 'Computer Vision',
    'Cybersecurity', 'React Native', 'GraphQL', 'Redis', 'MongoDB', 'PostgreSQL', 'Kafka'];

  for (const skill of skills) {
    const existing = await prisma.marketInsight.findFirst({ where: { skill, category: 'TRENDING_SKILL' } });
    if (!existing) {
      await prisma.marketInsight.create({
        data: {
          skill,
          category: 'TRENDING_SKILL',
          trend: Math.random() > 0.3 ? 'UP' : 'STABLE',
          percentage: Math.floor(Math.random() * 60) + 40,
          description: `${skill} is in high demand across the industry`,
        },
      });
    }
  }

  const futureSkills = ['Quantum Computing', 'Edge AI', 'Web Assembly', 'Bioinformatics',
    'AR/VR Development', 'Autonomous Systems', 'Generative AI', 'Cellular Agriculture',
    'Space Tech', 'Neuromorphic Computing'];

  for (const skill of futureSkills) {
    const existing = await prisma.marketInsight.findFirst({ where: { skill, category: 'FUTURE_SKILL' } });
    if (!existing) {
      await prisma.marketInsight.create({
        data: {
          skill,
          category: 'FUTURE_SKILL',
          trend: 'UP',
          percentage: Math.floor(Math.random() * 40) + 60,
          description: `${skill} is emerging as a future-critical skill`,
        },
      });
    }
  }

  const companies = ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Netflix', 'Tesla',
    'Adobe', 'Salesforce', 'Uber', 'Stripe', 'Atlassian', 'LinkedIn', 'Twitter', 'Spotify'];

  for (const company of companies) {
    const existing = await prisma.marketInsight.findFirst({ where: { title: company, category: 'TOP_COMPANY' } });
    if (!existing) {
      await prisma.marketInsight.create({
        data: {
          title: company,
          category: 'TOP_COMPANY',
          trend: 'UP',
          percentage: Math.floor(Math.random() * 30) + 70,
          description: `${company} is a top hiring company for tech talent`,
        },
      });
    }
  }

  const salaryTrends = [
    { title: 'Software Engineer', percentage: 82, description: 'Average salary up 12% year over year' },
    { title: 'Data Scientist', percentage: 88, description: 'Premium compensation driven by AI adoption' },
    { title: 'DevOps Engineer', percentage: 79, description: 'Strong demand keeps salaries competitive' },
    { title: 'Product Manager', percentage: 75, description: 'Total compensation rising with tech growth' },
    { title: 'Cybersecurity Analyst', percentage: 84, description: 'Talent shortage driving salary growth' },
    { title: 'Cloud Architect', percentage: 90, description: 'Highest-paying infrastructure role' },
  ];

  for (const item of salaryTrends) {
    const existing = await prisma.marketInsight.findFirst({ where: { title: item.title, category: 'SALARY_TREND' } });
    if (!existing) {
      await prisma.marketInsight.create({
        data: {
          title: item.title,
          category: 'SALARY_TREND',
          trend: 'UP',
          percentage: item.percentage,
          description: item.description,
        },
      });
    }
  }

  const industryDemand = [
    { title: 'FinTech', percentage: 86, description: 'Rapid hiring across payments and banking tech' },
    { title: 'Healthcare Tech', percentage: 81, description: 'Digital health and telemedicine expansion' },
    { title: 'E-Commerce', percentage: 78, description: 'Sustained demand for platform engineers' },
    { title: 'EdTech', percentage: 72, description: 'Growing need for scalable learning platforms' },
    { title: 'Green Energy', percentage: 83, description: 'Climate tech investment driving hiring' },
    { title: 'Logistics Tech', percentage: 76, description: 'Supply chain digitization creates new roles' },
  ];

  for (const item of industryDemand) {
    const existing = await prisma.marketInsight.findFirst({ where: { title: item.title, category: 'INDUSTRY_DEMAND' } });
    if (!existing) {
      await prisma.marketInsight.create({
        data: {
          title: item.title,
          category: 'INDUSTRY_DEMAND',
          trend: 'UP',
          percentage: item.percentage,
          description: item.description,
        },
      });
    }
  }

  console.log('Seed data created successfully!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
