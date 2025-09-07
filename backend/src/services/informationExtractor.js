/**
 * Information Extraction Service for Lesson Plan Builder
 * Extracts structured information from UC unit outline documents
 */

const logger = require('../utils/logger');
const { config } = require('../config');

/**
 * Information Extraction Service Class
 * Parses unit outline documents to extract structured curriculum information
 */
class InformationExtractor {
  constructor() {
    // Define section patterns for UC unit outlines
    this.sectionPatterns = {
      introduction: {
        keywords: ['introduction', 'overview', 'unit description', 'course description', 'about this unit'],
        patterns: [
          /(?:introduction|overview|unit description|course description|about this unit)[\s\S]*?(?=\n\s*(?:[A-Z][^a-z]*|learning outcomes|objectives|assessment|timetable|resources))/i,
          /(?:introduction|overview)[\s\S]*?(?=\n\s*[A-Z])/i
        ]
      },
      learningOutcomes: {
        keywords: ['learning outcomes', 'learning objectives', 'objectives', 'unit learning outcomes', 'course objectives'],
        patterns: [
          /(?:learning outcomes|learning objectives|objectives|unit learning outcomes|course objectives)[\s\S]*?(?=\n\s*(?:[A-Z][^a-z]*|assessment|accreditation|timetable|resources))/i,
          /(?:on completion|upon completion|by the end)[\s\S]*?(?=\n\s*[A-Z])/i
        ]
      },
      accreditation: {
        keywords: ['accreditation', 'aqf', 'australian qualifications framework', 'professional accreditation', 'acs', 'sfia'],
        patterns: [
          /(?:accreditation|aqf|australian qualifications framework|professional accreditation|acs|sfia)[\s\S]*?(?=\n\s*(?:[A-Z][^a-z]*|timetable|assessment|resources))/i,
          /(?:professional body|industry standards|accrediting body)[\s\S]*?(?=\n\s*[A-Z])/i
        ]
      },
      timetable: {
        keywords: ['timetable', 'schedule', 'weekly schedule', 'course schedule', 'teaching schedule', 'week'],
        patterns: [
          /(?:timetable|schedule|weekly schedule|course schedule|teaching schedule)[\s\S]*?(?=\n\s*(?:[A-Z][^a-z]*|assessment|resources|references))/i,
          /week\s+\d+[\s\S]*?(?=\n\s*(?:[A-Z][^a-z]*|assessment|resources))/i
        ]
      },
      resources: {
        keywords: ['resources', 'textbooks', 'references', 'reading list', 'recommended reading', 'materials'],
        patterns: [
          /(?:resources|textbooks|references|reading list|recommended reading|materials)[\s\S]*?(?=\n\s*(?:[A-Z][^a-z]*|assessment|appendix))/i,
          /(?:prescribed text|recommended text)[\s\S]*?(?=\n\s*[A-Z])/i
        ]
      },
      assessment: {
        keywords: ['assessment', 'evaluation', 'grading', 'assignments', 'examinations'],
        patterns: [
          /(?:assessment|evaluation|grading|assignments|examinations)[\s\S]*?(?=\n\s*(?:[A-Z][^a-z]*|resources|references|appendix))/i,
          /(?:assessment task|assignment|exam|test)[\s\S]*?(?=\n\s*[A-Z])/i
        ]
      }
    };

    // Bloom's taxonomy keywords for classification
    this.bloomsKeywords = {
      remember: ['define', 'list', 'recall', 'recognize', 'retrieve', 'name', 'identify', 'describe'],
      understand: ['classify', 'describe', 'discuss', 'explain', 'identify', 'locate', 'recognize', 'report', 'select', 'translate'],
      apply: ['execute', 'implement', 'solve', 'use', 'demonstrate', 'interpret', 'operate', 'schedule', 'sketch'],
      analyze: ['differentiate', 'organize', 'relate', 'compare', 'contrast', 'distinguish', 'examine', 'experiment', 'question', 'test'],
      evaluate: ['appraise', 'argue', 'defend', 'judge', 'select', 'support', 'value', 'critique', 'weigh'],
      create: ['design', 'assemble', 'construct', 'conjecture', 'develop', 'formulate', 'author', 'investigate']
    };
  }

  /**
   * Extract structured information from document text
   * @param {string} text - Document text content
   * @param {string} subject - Subject identifier
   * @param {string} documentId - Document identifier
   * @returns {Object} Extracted structured information
   */
  async extractInformation(text, subject, documentId) {
    const startTime = Date.now();

    try {
      logger.info('Starting information extraction', {
        documentId,
        subject,
        textLength: text.length
      });

      // Extract each section
      const extractedSections = {};
      
      for (const [sectionName, sectionConfig] of Object.entries(this.sectionPatterns)) {
        extractedSections[sectionName] = this.extractSection(text, sectionConfig);
      }

      // Analyze learning outcomes for Bloom's taxonomy
      const bloomsAnalysis = this.analyzeBloomsTaxonomy(extractedSections.learningOutcomes);

      // Extract key topics and concepts
      const keyTopics = this.extractKeyTopics(text, subject);

      // Extract assessment information
      const assessmentInfo = this.extractAssessmentInfo(extractedSections.assessment);

      // Extract weekly structure from timetable
      const weeklyStructure = this.extractWeeklyStructure(extractedSections.timetable);

      // Build structured result
      const extractedInfo = {
        documentId,
        subject,
        extractedAt: new Date().toISOString(),
        processingTime: Date.now() - startTime,
        sections: {
          introduction: {
            content: extractedSections.introduction,
            summary: this.summarizeSection(extractedSections.introduction, 200)
          },
          learningOutcomes: {
            content: extractedSections.learningOutcomes,
            outcomes: this.parseOutcomes(extractedSections.learningOutcomes),
            bloomsAnalysis
          },
          accreditation: {
            content: extractedSections.accreditation,
            standards: this.extractStandards(extractedSections.accreditation)
          },
          timetable: {
            content: extractedSections.timetable,
            weeklyStructure
          },
          resources: {
            content: extractedSections.resources,
            textbooks: this.extractTextbooks(extractedSections.resources),
            onlineResources: this.extractOnlineResources(extractedSections.resources)
          },
          assessment: {
            content: extractedSections.assessment,
            assessmentInfo
          }
        },
        analysis: {
          keyTopics,
          subjectAlignment: this.analyzeSubjectAlignment(text, subject),
          aqfLevel: this.detectAQFLevel(text),
          complexity: this.analyzeComplexity(text)
        }
      };

      logger.logOperation('information_extracted', {
        documentId,
        subject,
        sectionsFound: Object.keys(extractedSections).filter(key => extractedSections[key]).length,
        outcomesCount: extractedInfo.sections.learningOutcomes.outcomes.length,
        topicsCount: keyTopics.length
      }, Date.now() - startTime);

      return extractedInfo;

    } catch (error) {
      logger.error('Information extraction failed', {
        documentId,
        subject,
        error: error.message,
        processingTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Extract a specific section from text using patterns
   * @param {string} text - Document text
   * @param {Object} sectionConfig - Section configuration with patterns
   * @returns {string} Extracted section content
   */
  extractSection(text, sectionConfig) {
    if (!text || !sectionConfig) return '';

    // Try each pattern until one matches
    for (const pattern of sectionConfig.patterns) {
      const match = text.match(pattern);
      if (match) {
        return match[0].trim();
      }
    }

    // Fallback: search for keywords and extract surrounding text
    for (const keyword of sectionConfig.keywords) {
      const keywordIndex = text.toLowerCase().indexOf(keyword.toLowerCase());
      if (keywordIndex !== -1) {
        // Extract text starting from keyword
        const startIndex = keywordIndex;
        const endIndex = Math.min(startIndex + 1000, text.length); // Limit to 1000 chars
        return text.substring(startIndex, endIndex).trim();
      }
    }

    return '';
  }

  /**
   * Analyze learning outcomes for Bloom's taxonomy levels
   * @param {string} outcomesText - Learning outcomes text
   * @returns {Object} Bloom's taxonomy analysis
   */
  analyzeBloomsTaxonomy(outcomesText) {
    if (!outcomesText) return { levels: [], distribution: {} };

    const analysis = {
      levels: [],
      distribution: {},
      detectedOutcomes: []
    };

    // Initialize distribution
    Object.keys(this.bloomsKeywords).forEach(level => {
      analysis.distribution[level] = 0;
    });

    // Split into individual outcomes
    const outcomes = outcomesText.split(/\n|•|·|\d+\./).filter(outcome => outcome.trim().length > 10);

    outcomes.forEach(outcome => {
      const lowerOutcome = outcome.toLowerCase();
      let detectedLevel = null;

      // Check for Bloom's keywords
      for (const [level, keywords] of Object.entries(this.bloomsKeywords)) {
        for (const keyword of keywords) {
          if (lowerOutcome.includes(keyword)) {
            detectedLevel = level;
            analysis.distribution[level]++;
            break;
          }
        }
        if (detectedLevel) break;
      }

      if (detectedLevel) {
        analysis.detectedOutcomes.push({
          text: outcome.trim(),
          bloomsLevel: detectedLevel
        });
      }
    });

    // Determine primary levels
    analysis.levels = Object.entries(analysis.distribution)
      .filter(([level, count]) => count > 0)
      .sort(([, a], [, b]) => b - a)
      .map(([level]) => level);

    return analysis;
  }

  /**
   * Extract key topics and concepts from text
   * @param {string} text - Document text
   * @param {string} subject - Subject identifier
   * @returns {Array} List of key topics
   */
  extractKeyTopics(text, subject) {
    if (!text) return [];

    // Subject-specific topic patterns
    const topicPatterns = {
      'intro-it': [
        /(?:programming|software|hardware|database|network|security|web|system|algorithm|data structure)/gi,
        /(?:computer|technology|digital|information|cyber|cloud|mobile|internet)/gi
      ],
      'intro-data-science': [
        /(?:data|analytics|statistics|machine learning|visualization|mining|modeling|prediction)/gi,
        /(?:python|r|sql|tableau|analysis|regression|classification|clustering)/gi
      ],
      'intro-statistics': [
        /(?:probability|distribution|hypothesis|regression|correlation|variance|mean|median)/gi,
        /(?:statistical|inference|sampling|confidence|significance|test|analysis)/gi
      ]
    };

    const patterns = topicPatterns[subject] || topicPatterns['intro-it'];
    const topics = new Set();

    patterns.forEach(pattern => {
      const matches = text.match(pattern) || [];
      matches.forEach(match => topics.add(match.toLowerCase()));
    });

    return Array.from(topics).slice(0, 20); // Limit to top 20 topics
  }

  /**
   * Parse individual learning outcomes from text
   * @param {string} outcomesText - Learning outcomes text
   * @returns {Array} List of parsed outcomes
   */
  parseOutcomes(outcomesText) {
    if (!outcomesText) return [];

    return outcomesText
      .split(/\n|•|·|\d+\./)
      .map(outcome => outcome.trim())
      .filter(outcome => outcome.length > 10)
      .slice(0, 10); // Limit to 10 outcomes
  }

  /**
   * Extract accreditation standards
   * @param {string} accreditationText - Accreditation text
   * @returns {Array} List of standards
   */
  extractStandards(accreditationText) {
    if (!accreditationText) return [];

    const standards = [];
    const standardPatterns = [
      /AQF\s+Level\s+\d+/gi,
      /ACS\s+[A-Z]+/gi,
      /SFIA\s+[A-Z0-9]+/gi,
      /Australian\s+Qualifications\s+Framework/gi
    ];

    standardPatterns.forEach(pattern => {
      const matches = accreditationText.match(pattern) || [];
      standards.push(...matches);
    });

    return [...new Set(standards)]; // Remove duplicates
  }

  /**
   * Extract weekly structure from timetable
   * @param {string} timetableText - Timetable text
   * @returns {Array} Weekly structure
   */
  extractWeeklyStructure(timetableText) {
    if (!timetableText) return [];

    const weeks = [];
    const weekPattern = /week\s+(\d+)[:\-\s]*([^\n]*)/gi;
    let match;

    while ((match = weekPattern.exec(timetableText)) !== null) {
      weeks.push({
        week: parseInt(match[1]),
        topic: match[2].trim()
      });
    }

    return weeks.slice(0, 15); // Limit to 15 weeks
  }

  /**
   * Extract textbook information
   * @param {string} resourcesText - Resources text
   * @returns {Array} List of textbooks
   */
  extractTextbooks(resourcesText) {
    if (!resourcesText) return [];

    const textbooks = [];
    const bookPattern = /(?:prescribed|recommended|required)?\s*(?:text|book)[:\-\s]*([^\n]*)/gi;
    let match;

    while ((match = bookPattern.exec(resourcesText)) !== null) {
      const bookInfo = match[1].trim();
      if (bookInfo.length > 5) {
        textbooks.push(bookInfo);
      }
    }

    return textbooks.slice(0, 5); // Limit to 5 textbooks
  }

  /**
   * Extract online resources
   * @param {string} resourcesText - Resources text
   * @returns {Array} List of online resources
   */
  extractOnlineResources(resourcesText) {
    if (!resourcesText) return [];

    const urlPattern = /https?:\/\/[^\s]+/gi;
    const urls = resourcesText.match(urlPattern) || [];
    
    return [...new Set(urls)].slice(0, 10); // Remove duplicates, limit to 10
  }

  /**
   * Extract assessment information
   * @param {string} assessmentText - Assessment text
   * @returns {Object} Assessment information
   */
  extractAssessmentInfo(assessmentText) {
    if (!assessmentText) return { tasks: [], types: [], weights: [] };

    const tasks = [];
    const types = new Set();
    const weights = [];

    // Extract assessment tasks
    const taskPattern = /(?:assignment|exam|test|quiz|project|presentation)[:\-\s]*([^\n]*)/gi;
    let match;

    while ((match = taskPattern.exec(assessmentText)) !== null) {
      tasks.push(match[0].trim());
    }

    // Extract assessment types
    const typePattern = /(?:formative|summative|peer|self|group|individual)/gi;
    const typeMatches = assessmentText.match(typePattern) || [];
    typeMatches.forEach(type => types.add(type.toLowerCase()));

    // Extract weights/percentages
    const weightPattern = /(\d+)%/g;
    while ((match = weightPattern.exec(assessmentText)) !== null) {
      weights.push(parseInt(match[1]));
    }

    return {
      tasks: tasks.slice(0, 5),
      types: Array.from(types),
      weights
    };
  }

  /**
   * Analyze subject alignment
   * @param {string} text - Document text
   * @param {string} subject - Subject identifier
   * @returns {Object} Subject alignment analysis
   */
  analyzeSubjectAlignment(text, subject) {
    const subjectConfig = config.subjects[subject];
    if (!subjectConfig) return { score: 0, keywords: [] };

    const subjectKeywords = {
      'intro-it': ['information', 'technology', 'computer', 'software', 'programming', 'system'],
      'intro-data-science': ['data', 'science', 'analytics', 'statistics', 'machine', 'learning'],
      'intro-statistics': ['statistics', 'probability', 'analysis', 'mathematical', 'statistical']
    };

    const keywords = subjectKeywords[subject] || [];
    const foundKeywords = [];
    let score = 0;

    keywords.forEach(keyword => {
      const regex = new RegExp(keyword, 'gi');
      const matches = text.match(regex) || [];
      if (matches.length > 0) {
        foundKeywords.push(keyword);
        score += matches.length;
      }
    });

    return {
      score: Math.min(score / keywords.length, 10), // Normalize to 0-10
      keywords: foundKeywords,
      alignment: score > keywords.length ? 'high' : score > 0 ? 'medium' : 'low'
    };
  }

  /**
   * Detect AQF level from text
   * @param {string} text - Document text
   * @returns {string} Detected AQF level
   */
  detectAQFLevel(text) {
    const aqfPatterns = {
      'aqf7': /(?:bachelor|undergraduate|level\s+7)/gi,
      'aqf8': /(?:graduate\s+certificate|graduate\s+diploma|level\s+8)/gi,
      'aqf9': /(?:master|masters|postgraduate|level\s+9)/gi
    };

    for (const [level, pattern] of Object.entries(aqfPatterns)) {
      if (pattern.test(text)) {
        return level;
      }
    }

    return 'aqf9'; // Default to Master's level for UC MITS
  }

  /**
   * Analyze text complexity
   * @param {string} text - Document text
   * @returns {Object} Complexity analysis
   */
  analyzeComplexity(text) {
    if (!text) return { level: 'low', score: 0 };

    const words = text.split(/\s+/);
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
    
    const avgWordsPerSentence = words.length / sentences.length;
    const longWords = words.filter(word => word.length > 6).length;
    const longWordRatio = longWords / words.length;

    // Simple complexity scoring
    let score = 0;
    if (avgWordsPerSentence > 20) score += 2;
    else if (avgWordsPerSentence > 15) score += 1;
    
    if (longWordRatio > 0.3) score += 2;
    else if (longWordRatio > 0.2) score += 1;

    const level = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';

    return {
      level,
      score,
      avgWordsPerSentence: Math.round(avgWordsPerSentence),
      longWordRatio: Math.round(longWordRatio * 100) / 100
    };
  }

  /**
   * Summarize section content
   * @param {string} content - Section content
   * @param {number} maxLength - Maximum summary length
   * @returns {string} Summary
   */
  summarizeSection(content, maxLength = 200) {
    if (!content || content.length <= maxLength) return content;

    // Simple extractive summarization - take first sentences up to maxLength
    const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
    let summary = '';

    for (const sentence of sentences) {
      if (summary.length + sentence.length + 1 <= maxLength) {
        summary += sentence.trim() + '. ';
      } else {
        break;
      }
    }

    return summary.trim() || content.substring(0, maxLength) + '...';
  }
}

module.exports = InformationExtractor;

