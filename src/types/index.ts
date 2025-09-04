export interface WebhookSegment {
  end_time: number;
  initial_time: number;
  speaker: string;
  text: string;
}

export interface SentimentAnalysis {
  label: string;
  score: number;
  timestamp: string;
  fragment: string;
}

export interface TopicDetection {
  label: string;
  confidence: number;
  timestamp: string;
  fragment: string;
}

export interface UsageDetails {
  type?: string;
  unit?: string;
  amount?: {
    value?: number;
    token?: number;
  };
  total_price?: {
    value?: number;
    token?: number;
  };
  unit_price?: {
    value?: number;
    token?: number;
  };
}

export interface Usage {
  cost: number;
  currency: string;
  cost_details: UsageDetails[];
  performance: {
    delay: number;
    execution_time: number;
    relative_execution_time: number;
    relative_execution_time_unit: string;
  };
}

export interface TalkIntelWebhook {
  id: string;
  timestamp: string;
  segments: WebhookSegment[];
  text: string;
  usage: Usage;
  summarization: string;
  sentiment_analysis: SentimentAnalysis[];
  topic_detection: TopicDetection[];
  resolution: string | boolean;
  call_type: 'human-human' | 'human-bot';
  duration: number;
  participants: string[];
  agent_name?: string;
  customer_name?: string;
}

export interface CallAnalysis {
  id: string;
  timestamp: string;
  duration: number;
  callType: 'human-human' | 'human-bot';
  agentId: string;
  agentName: string;
  agentType: 'human' | 'ai';
  customerSatisfaction: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  resolutionRate: number;
  responseTime: number;
  callQuality: number;
  tags: string[];
  summary: string;
  keyInsights: string[];
  cost: number;
  currency: string;
  topics: string[];
  resolved: boolean;
  transcription?: string;
  segments?: WebhookSegment[];
  sentimentAnalysis?: SentimentAnalysis[];
}

export interface AgentMetrics {
  id: string;
  name: string;
  type: 'human' | 'ai';
  totalCalls: number;
  averageDuration: number;
  satisfactionScore: number;
  resolutionRate: number;
  averageResponseTime: number;
  callQuality: number;
  topTags: string[];
  trend: 'up' | 'down' | 'stable';
  trendValue: number;
  topTopics: string[];
  sentimentDistribution?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  sentimentCounts?: {
    positive: number;
    neutral: number;
    negative: number;
  };
  averageSentimentScore?: number;
}

export interface DashboardStats {
  totalCalls: number;
  averageSatisfaction: number;
  resolutionRate: number;
  averageCallDuration: number;
  humanAgentCount: number;
  aiAgentCount: number;
  callsToday: number;
  callsThisWeek: number;
  topTopics: string[];
  sentimentDistribution: {
    positive: number;
    neutral: number;
    negative: number;
  };
}

export interface WebhookProcessor {
  processWebhook: (webhook: TalkIntelWebhook) => CallAnalysis;
  extractSentiment: (sentimentAnalysis: SentimentAnalysis[]) => 'positive' | 'neutral' | 'negative';
  calculateSatisfactionScore: (sentimentAnalysis: SentimentAnalysis[]) => number;
  extractTopics: (topicDetection: TopicDetection[]) => string[];
  determineAgentType: (segments: WebhookSegment[]) => 'human' | 'ai';
  identifyAgents: (segments: WebhookSegment[]) => { id: string; name: string; type: 'human' | 'ai' }[];
}