// Fixed SipPulse AI Webhook Processor - Extracts ALL data properly
import { v4 as uuidv4 } from 'uuid';

class WebhookProcessorFixed {
  
  // Main processing method for SipPulse AI webhooks
  static processWebhook(rawWebhook) {
    console.log('📊 Processing SipPulse AI webhook with complete data extraction...');
    
    // Handle nested SipPulse format (event -> payload -> transcription)
    let data = rawWebhook;
    if (rawWebhook.event === 'stt.transcription' && rawWebhook.payload?.transcription) {
      console.log('📦 Extracting from nested format');
      data = rawWebhook.payload.transcription;
    }
    
    // Validate required fields
    if (!data.segments || !data.text) {
      throw new Error('Invalid SipPulse format - missing segments or text');
    }
    
    console.log('✅ Found all required SipPulse fields');
    
    // Extract duration from segments
    const duration = this.calculateDuration(data.segments);
    
    // Calculate time-weighted sentiment average (0-1 scale)
    const weightedSentiment = this.calculateTimeWeightedSentiment(data.sentiment_analysis);
    
    // Calculate recovery rate (0-100 scale)
    const recoveryRate = this.calculateRecoveryRate(data.sentiment_analysis);
    
    // Extract overall sentiment category
    const sentiment = this.extractSentiment(data.sentiment_analysis);
    
    // Extract topics
    const topics = data.topic_detection?.map(t => t.label) || [];
    
    // Extract participants - use direct fields if available, otherwise extract from segments
    const agentName = data.agent || this.extractAgentFromSegments(data.segments) || 'Agente';
    const customerName = data.client || this.extractCustomerFromSegments(data.segments) || 'Cliente';
    
    // Extract cost from usage
    const cost = data.usage?.cost || 0;
    const currency = data.usage?.currency || 'BRL';
    
    const processedData = {
      id: data.id || rawWebhook.id || uuidv4(),
      timestamp: new Date(data.timestamp || rawWebhook.timestamp || new Date()).toISOString(),
      call_type: 'customer-service',
      
      // Participant information
      participants: [agentName, customerName],
      agent_name: agentName,
      customer_name: customerName,
      
      // Call metrics
      duration: duration,
      sentiment_score: Math.round(weightedSentiment * 100), // 0-100 scale for time-weighted sentiment
      recovery_rate: Math.round(recoveryRate), // 0-100 scale for sentiment recovery
      satisfaction_score: data.satisfaction || 50, // Actual satisfaction if available, default 50
      sentiment: sentiment,
      resolved: data.resolution === true,
      response_time: 0,
      call_quality: data.quality || 0,
      
      // Cost information  
      cost: cost,
      currency: currency,
      
      // Content
      text: data.text || '',
      transcription: data.text || '',
      summary: data.summarization || '',
      summarization: data.summarization || '',
      
      // Analysis results
      topics: topics,
      topic_detection: data.topic_detection || [],
      sentiment_analysis: data.sentiment_analysis || [],
      
      // Additional data
      tags: ['sippulse_ai'],
      key_insights: [
        `Duração: ${duration}s`,
        `Sentimento Médio: ${Math.round(weightedSentiment * 100)}%`,
        `Taxa de Recuperação: ${Math.round(recoveryRate)}%`,
        `Satisfação: ${data.satisfaction || 50}%`,
        `Qualidade: ${data.quality || 0}`,
        `Resolução: ${data.resolution ? 'Sim' : 'Não'}`,
        `Tópicos: ${topics.length}`
      ],
      
      raw_data: rawWebhook,
      segments: data.segments
    };
    
    console.log('✅ Extracted webhook data:', {
      id: processedData.id,
      agent_name: processedData.agent_name,
      customer_name: processedData.customer_name,
      duration: processedData.duration,
      satisfaction_score: processedData.satisfaction_score,
      sentiment: processedData.sentiment,
      cost: processedData.cost,
      transcription_length: processedData.transcription.length,
      summary_length: processedData.summary.length,
      topics_count: processedData.topics.length,
      resolved: processedData.resolved
    });
    
    return processedData;
  }
  
  // Calculate call duration from segments
  static calculateDuration(segments) {
    if (!segments || segments.length === 0) return 0;
    const lastSegment = segments[segments.length - 1];
    return Math.round(lastSegment.end_time || 0);
  }
  
  // Calculate time-weighted sentiment average 
  static calculateTimeWeightedSentiment(sentimentAnalysis) {
    if (!sentimentAnalysis || sentimentAnalysis.length === 0) return 0.5; // neutral
    
    let totalWeightedScore = 0;
    let totalDuration = 0;
    
    sentimentAnalysis.forEach(item => {
      if (typeof item.score === 'number' && item.timestamp) {
        // Parse timestamp like "00:32-00:36" to get duration
        const duration = this.parseTimestampDuration(item.timestamp);
        totalWeightedScore += item.score * duration;
        totalDuration += duration;
      }
    });
    
    if (totalDuration === 0) {
      // Fallback to simple average if no timestamps
      const average = sentimentAnalysis.reduce((sum, item) => sum + (item.score || 0.5), 0) / sentimentAnalysis.length;
      return Math.max(0, Math.min(1, average));
    }
    
    const weightedAverage = totalWeightedScore / totalDuration;
    return Math.max(0, Math.min(1, weightedAverage));
  }
  
  // Parse timestamp duration like "00:32-00:36" -> 4 seconds
  static parseTimestampDuration(timestamp) {
    if (!timestamp || typeof timestamp !== 'string') return 1;
    
    const match = timestamp.match(/(\d+):(\d+)-(\d+):(\d+)/);
    if (!match) return 1;
    
    const [, startMin, startSec, endMin, endSec] = match.map(Number);
    const startTime = startMin * 60 + startSec;
    const endTime = endMin * 60 + endSec;
    
    return Math.max(1, endTime - startTime); // At least 1 second
  }
  
  // Calculate recovery rate (ability to recover from negative to positive)
  static calculateRecoveryRate(sentimentAnalysis) {
    if (!sentimentAnalysis || sentimentAnalysis.length < 2) return 0;
    
    // Sort by timestamp to ensure chronological order
    const sortedSentiments = [...sentimentAnalysis].sort((a, b) => {
      const aTime = this.parseTimestampToSeconds(a.timestamp);
      const bTime = this.parseTimestampToSeconds(b.timestamp);
      return aTime - bTime;
    });
    
    let recoveryEvents = 0;
    let negativeSegments = 0;
    
    for (let i = 0; i < sortedSentiments.length - 1; i++) {
      const current = sortedSentiments[i];
      const next = sortedSentiments[i + 1];
      
      // Check if current sentiment is negative/problematic
      const isCurrentNegative = current.score < 0.4 || 
        ['desconfiança', 'frustração', 'raiva', 'confusion', 'negative'].includes(current.label?.toLowerCase());
      
      if (isCurrentNegative) {
        negativeSegments++;
        
        // Check if next sentiment shows recovery
        const isNextPositive = next.score > 0.6 || 
          ['cortesia', 'determinação', 'satisfação', 'positive', 'gratitude'].includes(next.label?.toLowerCase());
        
        if (isNextPositive) {
          recoveryEvents++;
        }
      }
    }
    
    return negativeSegments > 0 ? (recoveryEvents / negativeSegments) * 100 : 100;
  }
  
  // Convert timestamp to seconds for sorting
  static parseTimestampToSeconds(timestamp) {
    if (!timestamp || typeof timestamp !== 'string') return 0;
    
    const match = timestamp.match(/(\d+):(\d+)/);
    if (!match) return 0;
    
    const [, min, sec] = match.map(Number);
    return min * 60 + sec;
  }
  
  // Extract overall sentiment
  static extractSentiment(sentimentAnalysis) {
    if (!sentimentAnalysis || sentimentAnalysis.length === 0) return 'neutral';
    
    // Get the most recent or dominant sentiment
    const lastSentiment = sentimentAnalysis[sentimentAnalysis.length - 1];
    const label = lastSentiment?.label?.toLowerCase();
    
    if (['positive', 'satisfaction', 'gratitude'].includes(label)) return 'positive';
    if (['negative', 'frustration', 'anger', 'confusion'].includes(label)) return 'negative';
    return 'neutral';
  }
  
  // Extract agent name from segments
  static extractAgentFromSegments(segments) {
    if (!segments || segments.length === 0) return null;
    
    // Look for name introductions like "eu me chamo Nicolas"
    for (const segment of segments) {
      const text = segment.text || '';
      const nameMatch = text.match(/me chamo (\w+)|sou (\w+)|meu nome é (\w+)/i);
      if (nameMatch) {
        return nameMatch[1] || nameMatch[2] || nameMatch[3];
      }
    }
    
    return null;
  }
  
  // Extract customer name from segments  
  static extractCustomerFromSegments(segments) {
    if (!segments || segments.length === 0) return null;
    
    // Look for direct name mentions like "fala com o Miguel"
    for (const segment of segments) {
      const text = segment.text || '';
      const nameMatch = text.match(/fala com o? (\w+)|cliente (\w+)|senhor (\w+)/i);
      if (nameMatch) {
        return nameMatch[1] || nameMatch[2] || nameMatch[3];
      }
    }
    
    return null;
  }
  
  // Legacy compatibility method
  static processBasicSipPulse(rawWebhook) {
    return this.processWebhook(rawWebhook);
  }
}

export default WebhookProcessorFixed;