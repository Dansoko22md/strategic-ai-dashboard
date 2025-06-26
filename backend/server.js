// server.js - AI Intelligence Dashboard Backend
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const cors = require('cors');
const cron = require('node-cron');
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize OpenAI
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// In-memory storage (replace with Redis/MongoDB in production)
let intelligenceCache = {
  stories: [],
  lastUpdated: null,
  trends: {},
  powerMap: {}
};

// Data sources configuration
const DATA_SOURCES = {
  arxiv: {
    url: 'http://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&start=0&max_results=20&sortBy=submittedDate&sortOrder=descending',
    parser: parseArxivFeed
  },
  hackernews: {
    url: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    parser: parseHackerNews
  },
  techcrunch: {
    url: 'https://techcrunch.com/category/artificial-intelligence/feed/',
    parser: parseTechCrunchFeed
  },
  github: {
    url: 'https://api.github.com/search/repositories?q=machine+learning+OR+artificial+intelligence+OR+LLM&sort=stars&order=desc&per_page=20',
    parser: parseGithubTrending
  }
};

// Strategic analysis prompts
const ANALYSIS_PROMPTS = {
  categorize: `
Analyze this AI/tech news item and categorize it. Return JSON with:
{
  "category": "model_releases|regulatory|funding|research_breakthrough|competitive_positioning|infrastructure",
  "importance": "HIGH|MEDIUM|LOW",
  "impact_score": 1-10,
  "timing_score": 1-10,
  "players_score": 1-10,
  "precedent_score": 1-10,
  "reasoning": "brief explanation"
}

Focus on strategic implications, not just technical details.
`,

  analyze: `
Provide strategic analysis for this AI development. Return JSON with:
{
  "strategic_takeaway": "1-2 sentence summary of why this matters strategically",
  "implications": ["implication1", "implication2", "implication3"],
  "affected_players": ["company1", "company2"],
  "next_moves": "what this enables or what responses to expect",
  "timing_significance": "why this is happening now"
}

Think like a strategic analyst, not a tech reporter.
`,

  connect: `
Analyze potential connections between these AI developments. Return JSON with:
{
  "connections": [
    {
      "story1_id": "id",
      "story2_id": "id", 
      "relationship": "response_to|enables|competes_with|builds_on",
      "explanation": "why these are connected"
    }
  ],
  "trends": ["trend1", "trend2"],
  "power_shifts": "analysis of changing competitive dynamics"
}
`
};

// Data parsers
async function parseArxivFeed(data) {
  const papers = [];
  const $ = cheerio.load(data, { xmlMode: true });
  
  $('entry').each((i, entry) => {
    const $entry = $(entry);
    papers.push({
      title: $entry.find('title').text().trim(),
      summary: $entry.find('summary').text().trim(),
      authors: $entry.find('author name').map((i, el) => $(el).text()).get(),
      url: $entry.find('id').text(),
      published: new Date($entry.find('published').text()),
      source: 'arXiv'
    });
  });
  
  return papers;
}

async function parseHackerNews(topStoryIds) {
  const stories = [];
  const aiKeywords = ['AI', 'artificial intelligence', 'machine learning', 'LLM', 'GPT', 'OpenAI', 'Anthropic', 'neural', 'deep learning'];
  
  for (let i = 0; i < Math.min(50, topStoryIds.length); i++) {
    try {
      const storyResponse = await axios.get(`https://hacker-news.firebaseio.com/v0/item/${topStoryIds[i]}.json`);
      const story = storyResponse.data;
      
      if (story && story.title) {
        const hasAIKeyword = aiKeywords.some(keyword => 
          story.title.toLowerCase().includes(keyword.toLowerCase())
        );
        
        if (hasAIKeyword) {
          stories.push({
            title: story.title,
            url: story.url || `https://news.ycombinator.com/item?id=${story.id}`,
            score: story.score,
            published: new Date(story.time * 1000),
            source: 'Hacker News'
          });
        }
      }
    } catch (error) {
      console.error(`Error fetching HN story ${topStoryIds[i]}:`, error.message);
    }
  }
  
  return stories.slice(0, 10);
}

async function parseTechCrunchFeed(data) {
  const articles = [];
  const $ = cheerio.load(data, { xmlMode: true });
  
  $('item').each((i, item) => {
    const $item = $(item);
    articles.push({
      title: $item.find('title').text().trim(),
      summary: $item.find('description').text().trim(),
      url: $item.find('link').text(),
      published: new Date($item.find('pubDate').text()),
      source: 'TechCrunch'
    });
  });
  
  return articles.slice(0, 15);
}

async function parseGithubTrending(data) {
  const repos = data.items.slice(0, 10).map(repo => ({
    title: `${repo.name} - ${repo.description || 'No description'}`,
    url: repo.html_url,
    stars: repo.stargazers_count,
    language: repo.language,
    published: new Date(repo.created_at),
    source: 'GitHub'
  }));
  
  return repos;
}

// Intelligence gathering
async function gatherIntelligence() {
  console.log('🔍 Starting intelligence gathering...');
  const allStories = [];
  
  for (const [sourceName, config] of Object.entries(DATA_SOURCES)) {
    try {
      console.log(`📡 Fetching from ${sourceName}...`);
      const response = await axios.get(config.url, {
        headers: {
          'User-Agent': 'AI-Intelligence-Dashboard/1.0'
        },
        timeout: 10000
      });
      
      const stories = await config.parser(response.data);
      allStories.push(...stories);
      console.log(`✅ Got ${stories.length} items from ${sourceName}`);
    } catch (error) {
      console.error(`❌ Error fetching from ${sourceName}:`, error.message);
    }
  }
  
  console.log(`📊 Total raw stories: ${allStories.length}`);
  return allStories;
}

// AI-powered story analysis
async function analyzeStory(story) {
  try {
    const analysisPrompt = `${ANALYSIS_PROMPTS.categorize}

Title: ${story.title}
Summary: ${story.summary || story.title}
Source: ${story.source}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: analysisPrompt }],
      temperature: 0.3,
      max_tokens: 500
    });

    const analysis = JSON.parse(response.choices[0].message.content);
    
    // Get detailed strategic analysis for high-importance stories
    if (analysis.importance === 'HIGH') {
      const detailPrompt = `${ANALYSIS_PROMPTS.analyze}

Title: ${story.title}
Summary: ${story.summary || story.title}
`;

      const detailResponse = await openai.chat.completions.create({
        model: "gpt-4",
        messages: [{ role: "user", content: detailPrompt }],
        temperature: 0.3,
        max_tokens: 600
      });

      const detailAnalysis = JSON.parse(detailResponse.choices[0].message.content);
      analysis.strategic_analysis = detailAnalysis;
    }

    return analysis;
  } catch (error) {
    console.error('Error analyzing story:', error.message);
    return {
      category: 'research_breakthrough',
      importance: 'LOW',
      impact_score: 3,
      timing_score: 3,
      players_score: 3,
      precedent_score: 3,
      reasoning: 'Analysis failed - using defaults'
    };
  }
}

// Process and rank stories
async function processIntelligence(rawStories) {
  console.log('🧠 Processing intelligence with AI...');
  const processedStories = [];
  
  // Process stories in batches to avoid rate limits
  const batchSize = 5;
  for (let i = 0; i < rawStories.length; i += batchSize) {
    const batch = rawStories.slice(i, i + batchSize);
    const batchPromises = batch.map(async (story, index) => {
      const analysis = await analyzeStory(story);
      
      return {
        id: Date.now() + i + index,
        title: story.title,
        summary: story.summary || story.title,
        url: story.url,
        source: story.source,
        published: story.published,
        category: analysis.category,
        importance: analysis.importance,
        impact_score: analysis.impact_score,
        timing_score: analysis.timing_score,
        players_score: analysis.players_score,
        precedent_score: analysis.precedent_score,
        overall_score: Math.round((analysis.impact_score + analysis.timing_score + analysis.players_score + analysis.precedent_score) / 4),
        reasoning: analysis.reasoning,
        strategic_analysis: analysis.strategic_analysis,
        timestamp: new Date()
      };
    });
    
    const batchResults = await Promise.all(batchPromises);
    processedStories.push(...batchResults);
    
    // Rate limiting delay
    if (i + batchSize < rawStories.length) {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
  
  // Sort by strategic importance
  const sortedStories = processedStories
    .filter(story => story.importance !== 'LOW' || story.overall_score >= 6)
    .sort((a, b) => {
      const importanceOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (importanceOrder[b.importance] - importanceOrder[a.importance]) || 
             (b.overall_score - a.overall_score);
    })
    .slice(0, 20); // Top 20 stories
  
  console.log(`🎯 Processed ${sortedStories.length} strategic stories`);
  return sortedStories;
}

// Find story connections
async function findConnections(stories) {
  if (stories.length < 2) return { connections: [], trends: [], power_shifts: '' };
  
  try {
    const storySummaries = stories.slice(0, 10).map(s => 
      `ID: ${s.id}, Title: ${s.title}, Category: ${s.category}`
    ).join('\n');
    
    const connectPrompt = `${ANALYSIS_PROMPTS.connect}

Stories to analyze:
${storySummaries}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: connectPrompt }],
      temperature: 0.3,
      max_tokens: 800
    });

    return JSON.parse(response.choices[0].message.content);
  } catch (error) {
    console.error('Error finding connections:', error.message);
    return { connections: [], trends: [], power_shifts: '' };
  }
}

// Main intelligence update function
async function updateIntelligence() {
  try {
    const rawStories = await gatherIntelligence();
    const processedStories = await processIntelligence(rawStories);
    const connections = await findConnections(processedStories);
    
    // Update cache
    intelligenceCache = {
      stories: processedStories,
      lastUpdated: new Date(),
      connections: connections.connections,
      trends: connections.trends,
      power_shifts: connections.power_shifts
    };
    
    console.log('✅ Intelligence update complete');
    return intelligenceCache;
  } catch (error) {
    console.error('❌ Intelligence update failed:', error.message);
    throw error;
  }
}

// API Routes
app.get('/api/intelligence', (req, res) => {
  res.json(intelligenceCache);
});

app.post('/api/refresh', async (req, res) => {
  try {
    const updated = await updateIntelligence();
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/story/:id', (req, res) => {
  const story = intelligenceCache.stories.find(s => s.id == req.params.id);
  if (!story) {
    return res.status(404).json({ error: 'Story not found' });
  }
  res.json(story);
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    lastUpdated: intelligenceCache.lastUpdated,
    storiesCount: intelligenceCache.stories.length 
  });
});

// Schedule automatic updates every 2 hours
cron.schedule('0 */2 * * *', () => {
  console.log('⏰ Scheduled intelligence update starting...');
  updateIntelligence().catch(console.error);
});

// Initial intelligence gathering on startup
updateIntelligence().catch(console.error);

app.listen(PORT, () => {
  console.log(`🚀 AI Intelligence Dashboard API running on port ${PORT}`);
  console.log(`📊 Dashboard available at http://localhost:${PORT}`);
});

module.exports = app;