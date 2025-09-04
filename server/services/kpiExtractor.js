// KPI Extractor for different campaign types
// Based on industry-standard KPIs for Sales, Debt Collection, and Customer Service

export class KPIExtractor {
  
  // Extract KPIs based on campaign type
  static extractKPIs(webhookData, campaignType) {
    const baseKPIs = this.extractBaseKPIs(webhookData);
    
    switch (campaignType) {
      case 'sales':
        return { ...baseKPIs, ...this.extractSalesKPIs(webhookData) };
      case 'debt_collection':
        return { ...baseKPIs, ...this.extractDebtCollectionKPIs(webhookData) };
      case 'customer_service':
        return { ...baseKPIs, ...this.extractCustomerServiceKPIs(webhookData) };
      default:
        return baseKPIs;
    }
  }

  // Base KPIs common to all campaign types
  static extractBaseKPIs(data) {
    const text = data.transcription || data.text || '';
    const segments = data.segments || [];
    const sentimentAnalysis = data.sentiment_analysis || [];
    
    return {
      call_duration: data.duration || 0,
      total_words: text.split(/\s+/).length,
      agent_talk_time: this.calculateAgentTalkTime(segments),
      customer_talk_time: this.calculateCustomerTalkTime(segments),
      sentiment_score: this.calculateOverallSentiment(sentimentAnalysis),
      conversation_switches: this.countConversationSwitches(segments),
      silence_periods: this.countSilencePeriods(segments),
      call_resolution: data.resolution || false
    };
  }

  // SALES DASHBOARD KPIs
  static extractSalesKPIs(data) {
    const text = data.transcription || data.text || '';
    const segments = data.segments || [];
    
    return {
      // Talk-to-Listen Ratio - Optimal: 40-45% agent talk time
      talk_to_listen_ratio: this.calculateTalkToListenRatio(segments),
      
      // Discovery Question Rate - Elite performers: 18+ questions/hour
      discovery_questions: this.countDiscoveryQuestions(text),
      question_rate_per_hour: this.calculateQuestionRatePerHour(text, data.duration),
      
      // Longest Customer Monologue - Target: 45-90 seconds
      longest_customer_monologue: this.findLongestCustomerMonologue(segments),
      
      // Sales Methodology Adherence - SPIN/MEDDIC coverage
      sales_methodology_score: this.analyzeSalesMethodology(text),
      
      // Customer Sentiment Progression - 70% should show positive shift
      sentiment_progression: this.analyzeSentimentProgression(data.sentiment_analysis || []),
      
      // Value Proposition Articulation Rate
      value_propositions: this.countValuePropositions(text),
      
      // Competitive Mention Response Quality
      competitive_mentions: this.analyzeCompetitiveMentions(text),
      
      // Objection handling
      objections_handled: this.countObjectionHandling(text)
    };
  }

  // DEBT COLLECTION DASHBOARD KPIs
  static extractDebtCollectionKPIs(data) {
    const text = data.transcription || data.text || '';
    const segments = data.segments || [];
    
    return {
      // Mini-Miranda Compliance Rate - Must be 100%
      mini_miranda_compliance: this.checkMiniMirandaCompliance(text),
      
      // Promise-to-Pay Conversion Rate
      promise_to_pay_mentioned: this.detectPromiseToPay(text),
      
      // Payment Discussion Rate - Target 80%+
      payment_discussion_detected: this.detectPaymentDiscussion(text),
      
      // Right Party Contact Verification
      identity_verification: this.checkIdentityVerification(text),
      
      // FDCPA Violation Detection
      fdcpa_violations: this.detectFDCPAViolations(text),
      fdcpa_compliance_score: this.calculateFDCPAComplianceScore(text),
      
      // Empathy Score - Correlates with 15-25% better performance
      empathy_indicators: this.countEmpathyIndicators(text),
      
      // Customer Information Gathering Completeness
      information_gathering_score: this.analyzeInformationGathering(text),
      
      // Threatening language detection
      threatening_language_detected: this.detectThreateningLanguage(text),
      
      // Dispute handling
      dispute_handling: this.analyzeDisputeHandling(text)
    };
  }

  // CUSTOMER SERVICE DASHBOARD KPIs
  static extractCustomerServiceKPIs(data) {
    const text = data.transcription || data.text || '';
    const segments = data.segments || [];
    const sentimentAnalysis = data.sentiment_analysis || [];
    
    return {
      // Customer Sentiment Score - Predicts CSAT with 85-95% accuracy
      customer_sentiment_final: this.getCustomerFinalSentiment(sentimentAnalysis, segments),
      
      // Agent Empathy Score - 15-20% better CSAT for high empathy
      agent_empathy_score: this.calculateAgentEmpathyScore(text),
      
      // First Contact Resolution Indicators
      fcr_indicators: this.detectFCRIndicators(text),
      
      // Customer Effort Score Indicators
      customer_effort_indicators: this.analyzeCustomerEffort(text),
      
      // Conversation Flow Quality
      conversation_flow_score: this.analyzeConversationFlow(segments),
      
      // Emotional Journey Mapping
      emotional_journey: this.mapEmotionalJourney(sentimentAnalysis),
      
      // Agent Knowledge Assessment
      knowledge_gaps: this.detectKnowledgeGaps(text),
      uncertainty_indicators: this.countUncertaintyIndicators(text),
      
      // Call Wrap-up Quality
      wrap_up_quality: this.analyzeWrapUpQuality(text),
      next_steps_provided: this.checkNextStepsProvided(text),
      
      // Problem resolution
      problem_resolution_clarity: this.analyzeProblemResolution(text)
    };
  }

  // Helper Methods for Base KPIs
  static calculateAgentTalkTime(segments) {
    if (!Array.isArray(segments)) return 0;
    
    let agentTime = 0;
    segments.forEach(segment => {
      if (segment.speaker && segment.speaker.toLowerCase().includes('agent')) {
        agentTime += (segment.end || 0) - (segment.start || 0);
      }
    });
    return agentTime;
  }

  static calculateCustomerTalkTime(segments) {
    if (!Array.isArray(segments)) return 0;
    
    let customerTime = 0;
    segments.forEach(segment => {
      if (segment.speaker && !segment.speaker.toLowerCase().includes('agent')) {
        customerTime += (segment.end || 0) - (segment.start || 0);
      }
    });
    return customerTime;
  }

  static calculateOverallSentiment(sentimentAnalysis) {
    if (!Array.isArray(sentimentAnalysis) || sentimentAnalysis.length === 0) return 0;
    
    let totalScore = 0;
    let count = 0;
    
    sentimentAnalysis.forEach(analysis => {
      if (analysis.score) {
        const score = analysis.label?.toLowerCase().includes('positive') ? analysis.score :
                     analysis.label?.toLowerCase().includes('negative') ? -analysis.score : 0;
        totalScore += score;
        count++;
      }
    });
    
    return count > 0 ? totalScore / count : 0;
  }

  static countConversationSwitches(segments) {
    if (!Array.isArray(segments) || segments.length <= 1) return 0;
    
    let switches = 0;
    for (let i = 1; i < segments.length; i++) {
      if (segments[i].speaker !== segments[i-1].speaker) {
        switches++;
      }
    }
    return switches;
  }

  static countSilencePeriods(segments) {
    if (!Array.isArray(segments) || segments.length <= 1) return 0;
    
    let silences = 0;
    for (let i = 1; i < segments.length; i++) {
      const gap = (segments[i].start || 0) - (segments[i-1].end || 0);
      if (gap > 3) { // 3+ second gaps count as silence
        silences++;
      }
    }
    return silences;
  }

  // Sales KPI Helper Methods
  static calculateTalkToListenRatio(segments) {
    const agentTime = this.calculateAgentTalkTime(segments);
    const totalTime = agentTime + this.calculateCustomerTalkTime(segments);
    return totalTime > 0 ? (agentTime / totalTime) * 100 : 0;
  }

  static countDiscoveryQuestions(text) {
    const questionPatterns = [
      /what.*\?/gi,
      /how.*\?/gi,
      /when.*\?/gi,
      /where.*\?/gi,
      /why.*\?/gi,
      /tell me about/gi,
      /can you describe/gi,
      /help me understand/gi
    ];
    
    let questionCount = 0;
    questionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) questionCount += matches.length;
    });
    
    return questionCount;
  }

  static calculateQuestionRatePerHour(text, duration) {
    const questions = this.countDiscoveryQuestions(text);
    const hours = duration > 0 ? duration / 3600 : 1;
    return questions / hours;
  }

  static findLongestCustomerMonologue(segments) {
    if (!Array.isArray(segments)) return 0;
    
    let longestMonologue = 0;
    let currentMonologue = 0;
    let lastSpeaker = null;
    
    segments.forEach(segment => {
      const speaker = segment.speaker || '';
      const duration = (segment.end || 0) - (segment.start || 0);
      
      if (!speaker.toLowerCase().includes('agent')) {
        if (lastSpeaker && !lastSpeaker.toLowerCase().includes('agent')) {
          currentMonologue += duration;
        } else {
          currentMonologue = duration;
        }
        longestMonologue = Math.max(longestMonologue, currentMonologue);
      } else {
        currentMonologue = 0;
      }
      lastSpeaker = speaker;
    });
    
    return longestMonologue;
  }

  static analyzeSalesMethodology(text) {
    const spinKeywords = ['situation', 'problem', 'implication', 'need', 'benefit'];
    const meddiciKeywords = ['metrics', 'economic', 'decision', 'criteria', 'identify', 'champion'];
    
    let spinScore = 0;
    let meddiciScore = 0;
    
    const lowerText = text.toLowerCase();
    
    spinKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) spinScore++;
    });
    
    meddiciKeywords.forEach(keyword => {
      if (lowerText.includes(keyword)) meddiciScore++;
    });
    
    return {
      spin_score: (spinScore / spinKeywords.length) * 100,
      meddici_score: (meddiciScore / meddiciKeywords.length) * 100,
      overall_methodology_score: ((spinScore + meddiciScore) / (spinKeywords.length + meddiciKeywords.length)) * 100
    };
  }

  static analyzeSentimentProgression(sentimentAnalysis) {
    if (!Array.isArray(sentimentAnalysis) || sentimentAnalysis.length < 2) {
      return { progression: 'insufficient_data', improvement: 0 };
    }
    
    const firstThird = sentimentAnalysis.slice(0, Math.floor(sentimentAnalysis.length / 3));
    const lastThird = sentimentAnalysis.slice(Math.floor(2 * sentimentAnalysis.length / 3));
    
    const firstScore = this.calculateOverallSentiment(firstThird);
    const lastScore = this.calculateOverallSentiment(lastThird);
    
    const improvement = lastScore - firstScore;
    
    return {
      progression: improvement > 0 ? 'positive' : improvement < 0 ? 'negative' : 'neutral',
      improvement: improvement,
      first_third_sentiment: firstScore,
      last_third_sentiment: lastScore
    };
  }

  static countValuePropositions(text) {
    const valuePatterns = [
      /save.*money/gi,
      /increase.*efficiency/gi,
      /reduce.*cost/gi,
      /improve.*productivity/gi,
      /roi/gi,
      /return on investment/gi,
      /benefit/gi,
      /advantage/gi
    ];
    
    let valueCount = 0;
    valuePatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) valueCount += matches.length;
    });
    
    return valueCount;
  }

  static analyzeCompetitiveMentions(text) {
    const competitorPatterns = [
      /competitor/gi,
      /other.*company/gi,
      /alternative/gi,
      /compared to/gi
    ];
    
    let mentions = 0;
    competitorPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) mentions += matches.length;
    });
    
    return {
      competitive_mentions: mentions,
      handled_professionally: mentions > 0 // Could be enhanced with sentiment analysis
    };
  }

  static countObjectionHandling(text) {
    const objectionPatterns = [
      /but/gi,
      /however/gi,
      /i understand.*concern/gi,
      /let me address/gi,
      /i can see why/gi
    ];
    
    let objectionHandling = 0;
    objectionPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) objectionHandling += matches.length;
    });
    
    return objectionHandling;
  }

  // Debt Collection KPI Helper Methods
  static checkMiniMirandaCompliance(text) {
    const requiredElements = [
      /debt collector/gi,
      /attempting to collect/gi,
      /any information.*collect.*debt/gi
    ];
    
    let compliance = 0;
    requiredElements.forEach(pattern => {
      if (text.match(pattern)) compliance++;
    });
    
    return {
      compliance_rate: (compliance / requiredElements.length) * 100,
      elements_present: compliance,
      total_required: requiredElements.length
    };
  }

  static detectPromiseToPay(text) {
    const promisePatterns = [
      /promise.*pay/gi,
      /commit.*payment/gi,
      /agree.*pay/gi,
      /payment.*arrangement/gi,
      /payment.*plan/gi
    ];
    
    return promisePatterns.some(pattern => text.match(pattern));
  }

  static detectPaymentDiscussion(text) {
    const paymentPatterns = [
      /payment/gi,
      /pay.*amount/gi,
      /balance/gi,
      /owe/gi,
      /debt/gi,
      /settlement/gi
    ];
    
    return paymentPatterns.some(pattern => text.match(pattern));
  }

  static checkIdentityVerification(text) {
    const verificationPatterns = [
      /verify.*identity/gi,
      /confirm.*name/gi,
      /last.*four.*digits/gi,
      /date.*birth/gi,
      /address/gi
    ];
    
    return verificationPatterns.some(pattern => text.match(pattern));
  }

  static detectFDCPAViolations(text) {
    const violationPatterns = [
      /jail/gi,
      /arrest/gi,
      /sue.*personally/gi,
      /garnish.*wages/gi,
      /call.*employer/gi,
      /ruin.*credit/gi,
      /threaten/gi,
      /harass/gi
    ];
    
    let violations = [];
    violationPatterns.forEach((pattern, index) => {
      if (text.match(pattern)) {
        violations.push({
          type: ['jail_threat', 'arrest_threat', 'personal_lawsuit', 'wage_garnishment', 'employer_contact', 'credit_threat', 'threatening_language', 'harassment'][index],
          detected: true
        });
      }
    });
    
    return violations;
  }

  static calculateFDCPAComplianceScore(text) {
    const violations = this.detectFDCPAViolations(text);
    return violations.length === 0 ? 100 : Math.max(0, 100 - (violations.length * 20));
  }

  static countEmpathyIndicators(text) {
    const empathyPatterns = [
      /i understand/gi,
      /i can see/gi,
      /i appreciate/gi,
      /thank you/gi,
      /i'm sorry/gi,
      /difficult situation/gi,
      /challenging time/gi
    ];
    
    let empathyCount = 0;
    empathyPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) empathyCount += matches.length;
    });
    
    return empathyCount;
  }

  static analyzeInformationGathering(text) {
    const infoPatterns = [
      /contact.*information/gi,
      /phone.*number/gi,
      /address/gi,
      /employment/gi,
      /income/gi,
      /financial.*situation/gi
    ];
    
    let infoGathered = 0;
    infoPatterns.forEach(pattern => {
      if (text.match(pattern)) infoGathered++;
    });
    
    return (infoGathered / infoPatterns.length) * 100;
  }

  static detectThreateningLanguage(text) {
    const threateningPatterns = [
      /you better/gi,
      /you have to/gi,
      /or else/gi,
      /consequences/gi,
      /action.*taken/gi
    ];
    
    return threateningPatterns.some(pattern => text.match(pattern));
  }

  static analyzeDisputeHandling(text) {
    const disputePatterns = [
      /dispute/gi,
      /disagree/gi,
      /not.*my.*debt/gi,
      /don't.*owe/gi,
      /never.*received/gi
    ];
    
    const hasDispute = disputePatterns.some(pattern => text.match(pattern));
    
    if (hasDispute) {
      const handlingPatterns = [
        /understand.*concern/gi,
        /investigate/gi,
        /look.*into/gi,
        /verify/gi
      ];
      
      const handledProfessionally = handlingPatterns.some(pattern => text.match(pattern));
      return { dispute_detected: true, handled_professionally: handledProfessionally };
    }
    
    return { dispute_detected: false, handled_professionally: null };
  }

  // Customer Service KPI Helper Methods
  static getCustomerFinalSentiment(sentimentAnalysis, segments) {
    if (!Array.isArray(sentimentAnalysis) || sentimentAnalysis.length === 0) return 0;
    
    // Get sentiment from last third of conversation
    const lastThird = sentimentAnalysis.slice(Math.floor(2 * sentimentAnalysis.length / 3));
    return this.calculateOverallSentiment(lastThird);
  }

  static calculateAgentEmpathyScore(text) {
    const empathyIndicators = this.countEmpathyIndicators(text);
    const totalWords = text.split(/\s+/).length;
    
    // Empathy indicators per 100 words
    return totalWords > 0 ? (empathyIndicators / totalWords) * 100 : 0;
  }

  static detectFCRIndicators(text) {
    const fcrPositivePatterns = [
      /resolved.*today/gi,
      /fixed.*issue/gi,
      /problem.*solved/gi,
      /all.*set/gi,
      /taken.*care.*of/gi
    ];
    
    const fcrNegativePatterns = [
      /call.*back/gi,
      /escalate/gi,
      /transfer/gi,
      /specialist/gi,
      /follow.*up/gi
    ];
    
    const positiveCount = fcrPositivePatterns.reduce((count, pattern) => {
      const matches = text.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
    
    const negativeCount = fcrNegativePatterns.reduce((count, pattern) => {
      const matches = text.match(pattern);
      return count + (matches ? matches.length : 0);
    }, 0);
    
    return {
      fcr_likely: positiveCount > negativeCount,
      positive_indicators: positiveCount,
      negative_indicators: negativeCount,
      confidence: positiveCount + negativeCount > 0 ? positiveCount / (positiveCount + negativeCount) : 0.5
    };
  }

  static analyzeCustomerEffort(text) {
    const effortIndicators = [
      /complicated/gi,
      /difficult/gi,
      /confusing/gi,
      /frustrated/gi,
      /wait.*long/gi,
      /hold.*long/gi,
      /repeat/gi,
      /again/gi
    ];
    
    let effortScore = 0;
    effortIndicators.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) effortScore += matches.length;
    });
    
    return {
      effort_indicators: effortScore,
      low_effort: effortScore < 2
    };
  }

  static analyzeConversationFlow(segments) {
    if (!Array.isArray(segments) || segments.length === 0) return 0;
    
    const switches = this.countConversationSwitches(segments);
    const averageSegmentLength = segments.reduce((sum, seg) => sum + (seg.text || '').length, 0) / segments.length;
    
    // Good conversation flow: balanced turns, reasonable segment lengths
    const balanceScore = switches > 0 ? Math.min(switches / segments.length * 2, 1) : 0;
    const lengthScore = averageSegmentLength > 20 && averageSegmentLength < 200 ? 1 : 0;
    
    return (balanceScore + lengthScore) * 50; // 0-100 score
  }

  static mapEmotionalJourney(sentimentAnalysis) {
    if (!Array.isArray(sentimentAnalysis) || sentimentAnalysis.length < 3) {
      return { journey: 'insufficient_data' };
    }
    
    const segments = Math.min(5, sentimentAnalysis.length);
    const segmentSize = Math.floor(sentimentAnalysis.length / segments);
    
    const journey = [];
    for (let i = 0; i < segments; i++) {
      const start = i * segmentSize;
      const end = i === segments - 1 ? sentimentAnalysis.length : (i + 1) * segmentSize;
      const segmentData = sentimentAnalysis.slice(start, end);
      
      journey.push({
        segment: i + 1,
        sentiment: this.calculateOverallSentiment(segmentData),
        timeframe: `${(i * 20)}%-${((i + 1) * 20)}%`
      });
    }
    
    return { journey };
  }

  static detectKnowledgeGaps(text) {
    const knowledgeGapPatterns = [
      /don't know/gi,
      /not sure/gi,
      /let me check/gi,
      /i'm not familiar/gi,
      /need to look/gi,
      /ask.*supervisor/gi
    ];
    
    let gapCount = 0;
    knowledgeGapPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) gapCount += matches.length;
    });
    
    return gapCount;
  }

  static countUncertaintyIndicators(text) {
    const uncertaintyPatterns = [
      /maybe/gi,
      /possibly/gi,
      /might/gi,
      /could be/gi,
      /i think/gi,
      /probably/gi,
      /not certain/gi
    ];
    
    let uncertaintyCount = 0;
    uncertaintyPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) uncertaintyCount += matches.length;
    });
    
    return uncertaintyCount;
  }

  static analyzeWrapUpQuality(text) {
    const wrapUpPatterns = [
      /anything else/gi,
      /other questions/gi,
      /help.*today/gi,
      /resolve.*issue/gi,
      /thank.*you/gi,
      /have.*great.*day/gi
    ];
    
    let wrapUpCount = 0;
    wrapUpPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) wrapUpCount += matches.length;
    });
    
    return wrapUpCount >= 2; // Good wrap-up should have multiple elements
  }

  static checkNextStepsProvided(text) {
    const nextStepPatterns = [
      /next.*step/gi,
      /follow.*up/gi,
      /will.*contact/gi,
      /expect.*email/gi,
      /within.*days/gi,
      /reference.*number/gi,
      /ticket.*number/gi
    ];
    
    return nextStepPatterns.some(pattern => text.match(pattern));
  }

  static analyzeProblemResolution(text) {
    const resolutionPatterns = [
      /problem.*solved/gi,
      /issue.*resolved/gi,
      /fixed/gi,
      /working.*now/gi,
      /should.*work/gi
    ];
    
    const hasResolution = resolutionPatterns.some(pattern => text.match(pattern));
    
    return {
      resolution_mentioned: hasResolution,
      clarity_score: hasResolution ? this.analyzeWrapUpQuality(text) ? 100 : 50 : 0
    };
  }
}