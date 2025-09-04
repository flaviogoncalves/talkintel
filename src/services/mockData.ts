import { CallAnalysis, AgentMetrics, DashboardStats } from '../types';

// Minimal mock data - only for agents (since we don't have agent management yet)
export const mockAgentMetrics: AgentMetrics[] = [
  {
    id: 'agent-1',
    name: 'Nicolas (Agente)',
    type: 'human',
    totalCalls: 0, // Will be calculated from real data
    averageDuration: 0,
    satisfactionScore: 0,
    resolutionRate: 0,
    averageResponseTime: 0,
    callQuality: 0,
    topTags: [],
    trend: 'stable',
    trendValue: 0,
    totalCost: 0,
    averageCost: 0,
    topTopics: []
  },
  {
    id: 'agent-2',
    name: 'Ana Silva',
    type: 'human',
    totalCalls: 0,
    averageDuration: 0,
    satisfactionScore: 0,
    resolutionRate: 0,
    averageResponseTime: 0,
    callQuality: 0,
    topTags: [],
    trend: 'stable',
    trendValue: 0,
    totalCost: 0,
    averageCost: 0,
    topTopics: []
  },
  {
    id: 'ai-bot-1',
    name: 'TalkIntel Assistant',
    type: 'ai',
    totalCalls: 0,
    averageDuration: 0,
    satisfactionScore: 0,
    resolutionRate: 0,
    averageResponseTime: 0,
    callQuality: 0,
    topTags: [],
    trend: 'stable',
    trendValue: 0,
    totalCost: 0,
    averageCost: 0,
    topTopics: []
  }
];

// Default dashboard stats - will be overridden by real data
export const defaultDashboardStats: DashboardStats = {
  totalCalls: 0,
  averageSatisfaction: 0,
  resolutionRate: 0,
  averageCallDuration: 0,
  humanAgentCount: 2,
  aiAgentCount: 1,
  callsToday: 0,
  callsThisWeek: 0,
  totalCost: 0,
  averageCost: 0,
  topTopics: [],
  sentimentDistribution: {
    positive: 0,
    neutral: 0,
    negative: 0
  }
};