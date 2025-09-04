// LLM-based KPI Extractor with Structured Output Prompts
// Generates prompts for LLM to extract specific KPIs for each campaign type

export class LLMKpiExtractor {
  
  // Main extraction method that generates LLM prompt based on campaign type
  static generateExtractionPrompt(transcription, campaignType, metadata = {}) {
    const basePrompt = this.getBasePrompt(transcription, metadata);
    
    switch (campaignType) {
      case 'sales':
        return this.getSalesExtractionPrompt(transcription, metadata);
      case 'debt_collection':
        return this.getDebtCollectionExtractionPrompt(transcription, metadata);
      case 'customer_service':
        return this.getCustomerServiceExtractionPrompt(transcription, metadata);
      default:
        return this.getGenericExtractionPrompt(transcription, metadata);
    }
  }

  // Base prompt structure
  static getBasePrompt(transcription, metadata) {
    return {
      system_prompt: `You are an expert call center quality analyst with deep expertise in extracting precise KPIs from call transcriptions. Your task is to analyze call transcriptions and extract specific metrics with high accuracy.

CRITICAL INSTRUCTIONS:
1. Analyze the ENTIRE transcription thoroughly
2. Extract only data that can be confidently determined from the transcription
3. Use numerical values wherever possible (percentages, counts, durations)
4. If information is not available or unclear, use null or indicate "not_determinable"
5. Be precise with calculations and measurements
6. Consider context and nuance in language analysis
7. Distinguish between agent and customer speech patterns

CALL METADATA:
- Duration: ${metadata.duration || 'unknown'} seconds
- Participants: ${metadata.participants || 'agent and customer'}
- Call Type: ${metadata.call_type || 'unknown'}`,
      
      transcription: transcription,
      
      output_format: "Respond with a valid JSON object containing the extracted KPIs. Do not include any text outside the JSON response."
    };
  }

  // SALES CAMPAIGN KPI EXTRACTION
  static getSalesExtractionPrompt(transcription, metadata) {
    return {
      system_prompt: `You are an expert sales call analyst. Extract the following Sales KPIs from this call transcription with precision:

SALES KPI EXTRACTION REQUIREMENTS:

1. TALK-TO-LISTEN RATIO ANALYSIS:
   - Calculate agent talking time vs customer talking time
   - Optimal range: 40-45% agent talk time
   - Identify who speaks when and for how long

2. DISCOVERY QUESTIONS ANALYSIS:
   - Count open-ended questions asked by the agent
   - Categories: Situation, Problem, Implication, Need-payoff questions
   - Look for: "What", "How", "Why", "When", "Tell me about", "Can you describe"
   - Target: 18+ questions per hour

3. CUSTOMER ENGAGEMENT ANALYSIS:
   - Find longest continuous customer speech segment
   - Target range: 45-90 seconds indicates good engagement
   - Measure customer monologue lengths

4. SALES METHODOLOGY ADHERENCE:
   - SPIN Selling: Situation, Problem, Implication, Need-payoff questions
   - MEDDIC: Metrics, Economic buyer, Decision criteria, Decision process, Identify pain, Champion
   - Score methodology coverage (0-100%)

5. SENTIMENT PROGRESSION ANALYSIS:
   - Track sentiment changes throughout the call
   - Beginning vs middle vs end sentiment
   - Calculate sentiment improvement score

6. VALUE PROPOSITION ANALYSIS:
   - Count value propositions mentioned
   - ROI discussions, cost savings, efficiency gains
   - Benefits articulated clearly

7. OBJECTION HANDLING:
   - Identify customer objections or concerns
   - Evaluate agent's response quality
   - Count successful objection addresses

8. COMPETITIVE ANALYSIS:
   - Detect competitor mentions
   - Evaluate professional handling of competitive topics

CALL TRANSCRIPTION:
${transcription}

RESPOND WITH THIS EXACT JSON STRUCTURE:`,

      json_schema: {
        type: "object",
        properties: {
          sales_kpis: {
            type: "object",
            properties: {
              talk_to_listen_ratio: {
                type: "object",
                properties: {
                  agent_talk_percentage: { type: "number", minimum: 0, maximum: 100 },
                  customer_talk_percentage: { type: "number", minimum: 0, maximum: 100 },
                  optimal_range: { type: "boolean" },
                  total_speaking_time: { type: "number" }
                }
              },
              discovery_questions: {
                type: "object",
                properties: {
                  total_questions: { type: "integer", minimum: 0 },
                  questions_per_hour: { type: "number", minimum: 0 },
                  question_types: {
                    type: "object",
                    properties: {
                      situation: { type: "integer" },
                      problem: { type: "integer" },
                      implication: { type: "integer" },
                      need_payoff: { type: "integer" }
                    }
                  },
                  quality_score: { type: "number", minimum: 0, maximum: 100 }
                }
              },
              customer_engagement: {
                type: "object",
                properties: {
                  longest_monologue_seconds: { type: "number", minimum: 0 },
                  optimal_engagement: { type: "boolean" },
                  total_customer_segments: { type: "integer" },
                  average_segment_length: { type: "number" }
                }
              },
              sales_methodology: {
                type: "object",
                properties: {
                  spin_score: { type: "number", minimum: 0, maximum: 100 },
                  meddic_score: { type: "number", minimum: 0, maximum: 100 },
                  overall_methodology_score: { type: "number", minimum: 0, maximum: 100 },
                  methodology_elements_covered: { type: "array", items: { type: "string" } }
                }
              },
              sentiment_progression: {
                type: "object",
                properties: {
                  beginning_sentiment: { type: "number", minimum: -1, maximum: 1 },
                  middle_sentiment: { type: "number", minimum: -1, maximum: 1 },
                  ending_sentiment: { type: "number", minimum: -1, maximum: 1 },
                  improvement_score: { type: "number" },
                  positive_progression: { type: "boolean" }
                }
              },
              value_propositions: {
                type: "object",
                properties: {
                  total_propositions: { type: "integer", minimum: 0 },
                  roi_mentioned: { type: "boolean" },
                  cost_savings_discussed: { type: "boolean" },
                  benefits_articulated: { type: "integer" },
                  clarity_score: { type: "number", minimum: 0, maximum: 100 }
                }
              },
              objection_handling: {
                type: "object",
                properties: {
                  objections_identified: { type: "integer", minimum: 0 },
                  objections_addressed: { type: "integer", minimum: 0 },
                  handling_quality_score: { type: "number", minimum: 0, maximum: 100 },
                  success_rate: { type: "number", minimum: 0, maximum: 100 }
                }
              },
              competitive_handling: {
                type: "object",
                properties: {
                  competitor_mentions: { type: "integer", minimum: 0 },
                  professional_handling: { type: "boolean" },
                  competitive_advantages_highlighted: { type: "integer" }
                }
              },
              overall_sales_score: { type: "number", minimum: 0, maximum: 100 }
            }
          }
        }
      }
    };
  }

  // DEBT COLLECTION CAMPAIGN KPI EXTRACTION
  static getDebtCollectionExtractionPrompt(transcription, metadata) {
    return {
      system_prompt: `You are an expert debt collection compliance analyst. Extract the following Debt Collection KPIs with strict attention to regulatory compliance:

DEBT COLLECTION KPI EXTRACTION REQUIREMENTS:

1. MINI-MIRANDA COMPLIANCE (CRITICAL - 100% REQUIRED):
   - "This is a debt collector attempting to collect a debt"
   - "Any information obtained will be used for that purpose"
   - Must be verbatim or substantially similar
   - FDCPA Section 807(11) requirement

2. PROMISE-TO-PAY CONVERSION:
   - Explicit payment commitments from debtor
   - Payment arrangements discussed
   - Commitment language analysis
   - Date-specific promises

3. PAYMENT DISCUSSION RATE:
   - Target: 80%+ of calls must discuss payment
   - Balance, amount owed, payment options
   - Settlement offers, payment plans

4. RIGHT PARTY CONTACT VERIFICATION:
   - Identity verification attempts
   - Confirmation of debtor identity
   - Privacy protection measures

5. FDCPA VIOLATION DETECTION (CRITICAL):
   - Threatening language (jail, arrest, legal action beyond scope)
   - Harassment indicators
   - False or misleading statements
   - Inappropriate contact threats
   - Credit reporting threats without authority

6. EMPATHY AND PROFESSIONALISM:
   - Understanding language
   - Respectful tone indicators
   - Acknowledgment of debtor situation
   - Professional communication

7. INFORMATION GATHERING:
   - Contact information updates
   - Financial situation assessment
   - Employment verification
   - Asset information (where legally appropriate)

8. DISPUTE HANDLING:
   - Debt disputes identified
   - Proper dispute procedures followed
   - Verification process mentioned

CALL TRANSCRIPTION:
${transcription}

RESPOND WITH THIS EXACT JSON STRUCTURE:`,

      json_schema: {
        type: "object",
        properties: {
          debt_collection_kpis: {
            type: "object",
            properties: {
              mini_miranda_compliance: {
                type: "object",
                properties: {
                  fully_compliant: { type: "boolean" },
                  debt_collector_mentioned: { type: "boolean" },
                  collection_purpose_stated: { type: "boolean" },
                  information_use_disclosed: { type: "boolean" },
                  compliance_score: { type: "number", minimum: 0, maximum: 100 },
                  exact_language_used: { type: "string" }
                }
              },
              promise_to_pay: {
                type: "object",
                properties: {
                  promise_obtained: { type: "boolean" },
                  payment_amount_specified: { type: "boolean" },
                  payment_date_specified: { type: "boolean" },
                  commitment_strength: { type: "string", enum: ["strong", "weak", "none"] },
                  promise_details: { type: "string" }
                }
              },
              payment_discussion: {
                type: "object",
                properties: {
                  payment_discussed: { type: "boolean" },
                  balance_mentioned: { type: "boolean" },
                  payment_options_offered: { type: "boolean" },
                  settlement_offered: { type: "boolean" },
                  discussion_quality_score: { type: "number", minimum: 0, maximum: 100 }
                }
              },
              identity_verification: {
                type: "object",
                properties: {
                  verification_attempted: { type: "boolean" },
                  identity_confirmed: { type: "boolean" },
                  verification_method: { type: "string" },
                  privacy_protected: { type: "boolean" }
                }
              },
              fdcpa_compliance: {
                type: "object",
                properties: {
                  violations_detected: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        violation_type: { type: "string" },
                        severity: { type: "string", enum: ["low", "medium", "high", "critical"] },
                        description: { type: "string" },
                        exact_quote: { type: "string" }
                      }
                    }
                  },
                  overall_compliance_score: { type: "number", minimum: 0, maximum: 100 },
                  threatening_language_detected: { type: "boolean" },
                  harassment_indicators: { type: "integer", minimum: 0 }
                }
              },
              empathy_professionalism: {
                type: "object",
                properties: {
                  empathy_indicators: { type: "integer", minimum: 0 },
                  respectful_language: { type: "boolean" },
                  professional_tone: { type: "boolean" },
                  acknowledgment_of_situation: { type: "boolean" },
                  empathy_score: { type: "number", minimum: 0, maximum: 100 }
                }
              },
              information_gathering: {
                type: "object",
                properties: {
                  contact_info_updated: { type: "boolean" },
                  financial_situation_discussed: { type: "boolean" },
                  employment_verified: { type: "boolean" },
                  completeness_score: { type: "number", minimum: 0, maximum: 100 },
                  information_types_gathered: { type: "array", items: { type: "string" } }
                }
              },
              dispute_handling: {
                type: "object",
                properties: {
                  dispute_raised: { type: "boolean" },
                  dispute_type: { type: "string" },
                  proper_procedures_followed: { type: "boolean" },
                  verification_process_explained: { type: "boolean" },
                  dispute_handling_score: { type: "number", minimum: 0, maximum: 100 }
                }
              },
              overall_compliance_score: { type: "number", minimum: 0, maximum: 100 }
            }
          }
        }
      }
    };
  }

  // CUSTOMER SERVICE CAMPAIGN KPI EXTRACTION
  static getCustomerServiceExtractionPrompt(transcription, metadata) {
    return {
      system_prompt: `You are an expert customer service quality analyst. Extract the following Customer Service KPIs with focus on customer satisfaction predictors:

CUSTOMER SERVICE KPI EXTRACTION REQUIREMENTS:

1. CUSTOMER SENTIMENT ANALYSIS (CSAT Predictor):
   - Track sentiment throughout the call
   - Final sentiment score (predicts CSAT with 85-95% accuracy)
   - Sentiment journey mapping
   - Emotional state changes

2. AGENT EMPATHY SCORING:
   - Empathy indicators: "I understand", "I can see", "I appreciate"
   - Acknowledgment of customer emotions
   - Supportive language patterns
   - 15-20% better CSAT correlation

3. FIRST CONTACT RESOLUTION (FCR):
   - Resolution indicators: "solved", "fixed", "resolved"
   - Escalation needs: "transfer", "specialist", "call back"
   - Problem closure language
   - Next steps clarity

4. CUSTOMER EFFORT ANALYSIS:
   - Effort indicators: "complicated", "difficult", "confusing"
   - Friction points in conversation
   - Ease of resolution
   - Customer frustration markers

5. CONVERSATION FLOW QUALITY:
   - Turn-taking balance
   - Interruption frequency
   - Natural conversation rhythm
   - Silent periods analysis

6. AGENT KNOWLEDGE ASSESSMENT:
   - Confidence indicators
   - Knowledge gaps: "let me check", "not sure"
   - Uncertainty markers
   - Information accuracy

7. CALL WRAP-UP QUALITY:
   - Summary provided
   - Next steps explained
   - Additional needs addressed
   - Professional closing

8. PROBLEM RESOLUTION CLARITY:
   - Clear explanation of solution
   - Customer understanding confirmed
   - Resolution completeness

CALL TRANSCRIPTION:
${transcription}

RESPOND WITH THIS EXACT JSON STRUCTURE:`,

      json_schema: {
        type: "object",
        properties: {
          customer_service_kpis: {
            type: "object",
            properties: {
              customer_sentiment: {
                type: "object",
                properties: {
                  initial_sentiment: { type: "number", minimum: -1, maximum: 1 },
                  final_sentiment: { type: "number", minimum: -1, maximum: 1 },
                  sentiment_improvement: { type: "number" },
                  csat_prediction: { type: "number", minimum: 1, maximum: 5 },
                  emotional_journey: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        timeframe: { type: "string" },
                        sentiment: { type: "number", minimum: -1, maximum: 1 },
                        emotion_type: { type: "string" }
                      }
                    }
                  }
                }
              },
              agent_empathy: {
                type: "object",
                properties: {
                  empathy_indicators_count: { type: "integer", minimum: 0 },
                  emotional_acknowledgment: { type: "boolean" },
                  supportive_language: { type: "boolean" },
                  empathy_score: { type: "number", minimum: 0, maximum: 100 },
                  empathy_phrases: { type: "array", items: { type: "string" } }
                }
              },
              first_contact_resolution: {
                type: "object",
                properties: {
                  fcr_achieved: { type: "boolean" },
                  resolution_confidence: { type: "number", minimum: 0, maximum: 100 },
                  escalation_needed: { type: "boolean" },
                  resolution_indicators: { type: "array", items: { type: "string" } },
                  problem_fully_addressed: { type: "boolean" }
                }
              },
              customer_effort: {
                type: "object",
                properties: {
                  low_effort_experience: { type: "boolean" },
                  effort_indicators_count: { type: "integer", minimum: 0 },
                  friction_points: { type: "array", items: { type: "string" } },
                  ease_of_resolution_score: { type: "number", minimum: 0, maximum: 100 },
                  customer_frustration_detected: { type: "boolean" }
                }
              },
              conversation_flow: {
                type: "object",
                properties: {
                  turn_taking_balance: { type: "number", minimum: 0, maximum: 100 },
                  interruption_count: { type: "integer", minimum: 0 },
                  natural_flow_score: { type: "number", minimum: 0, maximum: 100 },
                  silence_periods: { type: "integer", minimum: 0 },
                  conversation_rhythm: { type: "string", enum: ["excellent", "good", "fair", "poor"] }
                }
              },
              agent_knowledge: {
                type: "object",
                properties: {
                  knowledge_confidence: { type: "number", minimum: 0, maximum: 100 },
                  uncertainty_indicators: { type: "integer", minimum: 0 },
                  knowledge_gaps: { type: "array", items: { type: "string" } },
                  information_accuracy: { type: "boolean" },
                  expertise_demonstrated: { type: "boolean" }
                }
              },
              call_wrap_up: {
                type: "object",
                properties: {
                  summary_provided: { type: "boolean" },
                  next_steps_explained: { type: "boolean" },
                  additional_needs_addressed: { type: "boolean" },
                  professional_closing: { type: "boolean" },
                  wrap_up_quality_score: { type: "number", minimum: 0, maximum: 100 }
                }
              },
              problem_resolution: {
                type: "object",
                properties: {
                  solution_clarity: { type: "number", minimum: 0, maximum: 100 },
                  customer_understanding_confirmed: { type: "boolean" },
                  resolution_completeness: { type: "number", minimum: 0, maximum: 100 },
                  follow_up_required: { type: "boolean" }
                }
              },
              overall_service_score: { type: "number", minimum: 0, maximum: 100 }
            }
          }
        }
      }
    };
  }

  // Generic extraction for other campaign types
  static getGenericExtractionPrompt(transcription, metadata) {
    return {
      system_prompt: `You are a call center quality analyst. Extract general call quality KPIs from this transcription:

GENERAL KPI EXTRACTION:
- Call duration and structure
- Participant engagement
- Overall sentiment
- Resolution status
- Professional communication
- Key topics discussed

CALL TRANSCRIPTION:
${transcription}

RESPOND WITH THIS JSON STRUCTURE:`,

      json_schema: {
        type: "object",
        properties: {
          general_kpis: {
            type: "object",
            properties: {
              call_structure: {
                type: "object",
                properties: {
                  total_segments: { type: "integer" },
                  average_segment_length: { type: "number" },
                  turn_taking_balance: { type: "number" }
                }
              },
              overall_sentiment: { type: "number", minimum: -1, maximum: 1 },
              resolution_achieved: { type: "boolean" },
              professional_communication: { type: "boolean" },
              key_topics: { type: "array", items: { type: "string" } },
              overall_quality_score: { type: "number", minimum: 0, maximum: 100 }
            }
          }
        }
      }
    };
  }

  // Process LLM response and validate structure
  static validateAndProcessLLMResponse(response, campaignType) {
    try {
      const parsed = typeof response === 'string' ? JSON.parse(response) : response;
      
      // Basic validation
      if (!parsed || typeof parsed !== 'object') {
        throw new Error('Invalid response format');
      }
      
      // Add metadata
      parsed.extraction_metadata = {
        campaign_type: campaignType,
        extracted_at: new Date().toISOString(),
        extraction_method: 'llm_structured_output',
        confidence_level: this.assessExtractionConfidence(parsed)
      };
      
      return parsed;
      
    } catch (error) {
      console.error('LLM response validation error:', error);
      return {
        error: 'Failed to parse LLM response',
        raw_response: response,
        extraction_metadata: {
          campaign_type: campaignType,
          extracted_at: new Date().toISOString(),
          extraction_method: 'llm_structured_output',
          success: false
        }
      };
    }
  }

  // Assess confidence in extraction quality
  static assessExtractionConfidence(extractedData) {
    let confidence = 100;
    let factors = [];
    
    // Check for null values (reduces confidence)
    const nullCount = this.countNullValues(extractedData);
    if (nullCount > 5) {
      confidence -= 20;
      factors.push(`high_null_count: ${nullCount}`);
    }
    
    // Check for numerical consistency
    if (!this.validateNumericalConsistency(extractedData)) {
      confidence -= 15;
      factors.push('numerical_inconsistency');
    }
    
    // Check for required fields based on campaign type
    if (!this.validateRequiredFields(extractedData)) {
      confidence -= 25;
      factors.push('missing_required_fields');
    }
    
    return {
      confidence_score: Math.max(0, confidence),
      confidence_level: confidence >= 80 ? 'high' : confidence >= 60 ? 'medium' : 'low',
      factors: factors
    };
  }

  static countNullValues(obj) {
    let count = 0;
    for (const key in obj) {
      if (obj[key] === null || obj[key] === undefined) {
        count++;
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        count += this.countNullValues(obj[key]);
      }
    }
    return count;
  }

  static validateNumericalConsistency(data) {
    // Basic numerical validation rules
    try {
      // Check percentages are within 0-100
      const percentageFields = this.findPercentageFields(data);
      for (const field of percentageFields) {
        if (field < 0 || field > 100) return false;
      }
      
      // Check sentiment scores are within -1 to 1
      const sentimentFields = this.findSentimentFields(data);
      for (const field of sentimentFields) {
        if (field < -1 || field > 1) return false;
      }
      
      return true;
    } catch (error) {
      return false;
    }
  }

  static findPercentageFields(obj, path = '') {
    let percentageFields = [];
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        percentageFields = percentageFields.concat(this.findPercentageFields(obj[key], path + key + '.'));
      } else if (typeof obj[key] === 'number' && (key.includes('percentage') || key.includes('score'))) {
        percentageFields.push(obj[key]);
      }
    }
    return percentageFields;
  }

  static findSentimentFields(obj) {
    let sentimentFields = [];
    for (const key in obj) {
      if (typeof obj[key] === 'object' && obj[key] !== null) {
        sentimentFields = sentimentFields.concat(this.findSentimentFields(obj[key]));
      } else if (typeof obj[key] === 'number' && key.includes('sentiment')) {
        sentimentFields.push(obj[key]);
      }
    }
    return sentimentFields;
  }

  static validateRequiredFields(data) {
    // Basic required field validation - can be enhanced per campaign type
    return data && typeof data === 'object';
  }
}