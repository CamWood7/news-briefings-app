import React, { useState, useEffect } from 'react';
import { supabase } from './supabaseClient';
import { saveBriefingHistory, getLatestBriefing, BriefingHistory } from './api/briefingHistory';
import { API_BASE_URL } from './config';

interface Topic {
  id: string;
  name: string;
  isCustom: boolean;
}

interface BriefingConfig {
  id?: string;
  name: string;
  description?: string;
  topics: Topic[];
  frequency: 'daily' | 'weekly' | 'monthly';
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

interface Article {
  title: string;
  url: string;
  date?: string;
  seendate?: string;
  source?: string;
  summary?: string;
  image?: string;
  socialimage?: string;
  domain?: string;
  topic?: string;
}

const BriefingDashboard: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [config, setConfig] = useState<BriefingConfig>({
    name: 'My Briefing',
    topics: [],
    frequency: 'daily',
    is_active: false
  });
  const [newTopic, setNewTopic] = useState('');
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [overallSummary, setOverallSummary] = useState<string | null>(null);
  const [allBullets, setAllBullets] = useState<{ [url: string]: string[] }>({});
  const [isSetupMode, setIsSetupMode] = useState(false);
  const [selectedTopicFilter, setSelectedTopicFilter] = useState<string>('all');
  const [isSummaryExpanded, setIsSummaryExpanded] = useState(true);
  const [articlesByTopic, setArticlesByTopic] = useState<{ [topicName: string]: Article[] }>({});
  const [hasLoadedLatestBriefing, setHasLoadedLatestBriefing] = useState(false);
  const [latestBriefingDate, setLatestBriefingDate] = useState<string | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [briefingConfigs, setBriefingConfigs] = useState<BriefingConfig[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newBriefingName, setNewBriefingName] = useState('');
  const [newBriefingDescription, setNewBriefingDescription] = useState('');

  // Suggested topics
  const suggestedTopics = [
    'Technology',
    'Business',
    'Politics',
    'Health',
    'Science',
    'Environment',
    'Sports',
    'Entertainment',
    'Education',
    'Finance'
  ];

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        // Load existing briefing configuration
        await loadBriefingConfig(user.id);
        // Load latest briefing (will be loaded after config is selected)
      }
      setIsLoadingConfig(false);
    };
    getUser();
  }, []);

  const loadBriefingConfig = async (userId: string) => {
    try {
      console.log('Loading briefing configs for user:', userId);
      
      const { data, error } = await supabase
        .from('briefing_configs')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) {
        console.log('Error loading briefing configs:', error);
        console.log('Error details:', error.message, error.details, error.hint);
        setIsSetupMode(true);
        return;
      }

      if (data && data.length > 0) {
        console.log('Found existing configs:', data);
        setBriefingConfigs(data);
        
        // Set the first config as selected
        const firstConfig = data[0];
        setSelectedConfigId(firstConfig.id);
        setConfig({
          id: firstConfig.id,
          name: firstConfig.name || 'My Briefing',
          description: firstConfig.description,
          topics: firstConfig.topics || [],
          frequency: firstConfig.frequency || 'daily',
          is_active: firstConfig.is_active || false,
          created_at: firstConfig.created_at,
          updated_at: firstConfig.updated_at
        });
        
        // Load the latest briefing for the selected config
        await loadLatestBriefing(userId, firstConfig.id);
        
        // Only show setup mode if no configs are active
        const hasActiveConfig = data.some(config => config.is_active);
        setIsSetupMode(!hasActiveConfig);
      } else {
        // If no configs exist, show setup mode
        setIsSetupMode(true);
      }
    } catch (err) {
      console.error('Failed to load briefing configs:', err);
      setIsSetupMode(true);
    }
  };

  const loadLatestBriefing = async (userId: string, configId?: string) => {
    try {
      const { data: briefing, error } = await getLatestBriefing(userId, configId);
      
      if (error) {
        console.error('Error loading latest briefing:', error);
        // Clear the briefing data if no briefing found for this config
        setArticles([]);
        setOverallSummary(null);
        setAllBullets({});
        setArticlesByTopic({});
        setHasLoadedLatestBriefing(false);
        return;
      }
      
      if (briefing) {
        // Load the latest briefing data
        setArticles(briefing.articles || []);
        setOverallSummary(briefing.summary?.summary || '');
        setAllBullets(briefing.summary?.articleMap || {});
        
        // Store the briefing date
        if (briefing.created_at) {
          const date = new Date(briefing.created_at);
          setLatestBriefingDate(date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
          }));
        } else {
          setLatestBriefingDate(null);
        }
        
        // Group articles by topic for the articlesByTopic state
        const articlesByTopicLocal: { [topicName: string]: Article[] } = {};
        (briefing.articles || []).forEach((article: Article) => {
          if (article.topic) {
            if (!articlesByTopicLocal[article.topic]) {
              articlesByTopicLocal[article.topic] = [];
            }
            articlesByTopicLocal[article.topic].push(article);
          }
        });
        setArticlesByTopic(articlesByTopicLocal);
        
        setHasLoadedLatestBriefing(true);
      } else {
        // Clear the briefing data if no briefing found
        setArticles([]);
        setOverallSummary(null);
        setAllBullets({});
        setArticlesByTopic({});
        setHasLoadedLatestBriefing(false);
        setLatestBriefingDate(null);
      }
    } catch (err) {
      console.error('Error loading latest briefing:', err);
      // Clear the briefing data on error
      setArticles([]);
      setOverallSummary(null);
      setAllBullets({});
      setArticlesByTopic({});
      setHasLoadedLatestBriefing(false);
      setLatestBriefingDate(null);
    }
  };

  const saveBriefingHistoryToDB = async (articles: Article[], summary: string, articleMap: { [url: string]: string[] }) => {
    if (!currentUser || !config.id) return;
    
    try {
      const { data, error } = await saveBriefingHistory({
        user_id: currentUser.id,
        briefing_config_id: config.id,
        articles: articles,
        summary: {
          summary: summary,
          articleMap: articleMap
        }
      });
      
      if (error) {
        console.error('Failed to save briefing history:', error);
      } else {
        console.log('Briefing history saved successfully with ID:', data.id);
      }
    } catch (err) {
      console.error('Error saving briefing history:', err);
    }
  };

  const saveBriefingConfig = async () => {
    if (!currentUser || config.topics.length === 0) {
      console.log('Cannot save: no user or no topics');
      return;
    }

    console.log('Saving briefing config:', {
      user_id: currentUser.id,
      name: config.name,
      description: config.description,
      topics: config.topics,
      frequency: config.frequency,
      is_active: true
    });

    try {
      let data, error;
      
      if (config.id) {
        // Update existing config
        console.log('Updating existing config with ID:', config.id);
        const { data: updateData, error: updateError } = await supabase
          .from('briefing_configs')
          .update({
            name: config.name,
            description: config.description,
            topics: config.topics,
            frequency: config.frequency,
            is_active: true
          })
          .eq('id', config.id)
          .select()
          .single();
        
        data = updateData;
        error = updateError;
      } else {
        // Create new config
        console.log('Creating new config with name:', config.name);
        const { data: insertData, error: insertError } = await supabase
          .from('briefing_configs')
          .insert({
            user_id: currentUser.id,
            name: config.name,
            description: config.description,
            topics: config.topics,
            frequency: config.frequency,
            is_active: true
          })
          .select()
          .single();
        
        data = insertData;
        error = insertError;
      }

      if (error) {
        console.error('Supabase error:', error);
        console.error('Error details:', error.message, error.details, error.hint);
        throw error;
      }

      console.log('Successfully saved briefing config:', data);
      
      // Reload all configs to get the updated list
      await loadBriefingConfig(currentUser.id);
      setIsSetupMode(false);
      setError(null); // Clear any previous errors
    } catch (err) {
      console.error('Failed to save briefing config:', err);
      setError(`Failed to save configuration: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const selectConfig = (configId: string) => {
    const selectedConfig = briefingConfigs.find(c => c.id === configId);
    if (selectedConfig) {
      setSelectedConfigId(configId);
      setConfig({
        id: selectedConfig.id,
        name: selectedConfig.name || 'My Briefing',
        description: selectedConfig.description,
        topics: selectedConfig.topics || [],
        frequency: selectedConfig.frequency || 'daily',
        is_active: selectedConfig.is_active || false,
        created_at: selectedConfig.created_at,
        updated_at: selectedConfig.updated_at
      });
      
      // Load the latest briefing for this config
      if (currentUser) {
        loadLatestBriefing(currentUser.id, selectedConfig.id);
      }
    }
  };

  const createNewBriefing = () => {
    setIsCreatingNew(true);
    setIsSetupMode(true);
    setConfig({
      name: '',
      topics: [],
      frequency: 'daily',
      is_active: false
    });
    setNewBriefingName('');
    setNewBriefingDescription('');
    
    // Clear existing articles and summaries
    setArticles([]);
    setOverallSummary(null);
    setAllBullets({});
    setArticlesByTopic({});
    setHasLoadedLatestBriefing(false);
    setLatestBriefingDate(null);
    setSelectedTopicFilter('all');
    setIsSummaryExpanded(true);
  };

  const saveNewBriefing = async () => {
    if (!newBriefingName.trim()) {
      setError('Please enter a name for your briefing');
      return;
    }

    if (!currentUser) return;

    try {
      const { data, error } = await supabase
        .from('briefing_configs')
        .insert({
          user_id: currentUser.id,
          name: newBriefingName.trim(),
          description: newBriefingDescription.trim() || null,
          topics: [],
          frequency: 'daily',
          is_active: false
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      console.log('Successfully created new briefing:', data);
      
      // Reload all configs
      await loadBriefingConfig(currentUser.id);
      setIsCreatingNew(false);
      setError(null);
    } catch (err) {
      console.error('Failed to create new briefing:', err);
      setError(`Failed to create briefing: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const addTopic = (topicName: string, isCustom: boolean = false) => {
    if (!topicName.trim()) return;
    
    const newTopic: Topic = {
      id: Date.now().toString(),
      name: topicName.trim(),
      isCustom
    };

    setConfig(prev => ({
      ...prev,
      topics: [...prev.topics, newTopic]
    }));
    setNewTopic('');
  };

  const removeTopic = (topicId: string) => {
    setConfig(prev => ({
      ...prev,
      topics: prev.topics.filter(topic => topic.id !== topicId)
    }));
  };

  const getDateRange = () => {
    const now = new Date();
    const endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    
    switch (config.frequency) {
      case 'daily':
        const yesterday = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        return { start: yesterday.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
      case 'weekly':
        const lastWeek = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        return { start: lastWeek.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
      case 'monthly':
        const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth() - 1, endDate.getDate());
        return { start: lastMonth.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
      default:
        return { start: endDate.toISOString().slice(0, 10), end: endDate.toISOString().slice(0, 10) };
    }
  };

  const fetchBriefing = async () => {
    if (!currentUser || config.topics.length === 0) return;

    setLoading(true);
    setError(null);
    setArticles([]);
    setOverallSummary(null);
    setAllBullets({});

    try {
      const dateRange = getDateRange();
      const allArticles: Article[] = [];

      // Fetch articles for each topic (limit to 3 per topic)
      for (const topic of config.topics) {
        const res = await fetch(`${API_BASE_URL}/api/news`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            topic: topic.name, 
            start_date: dateRange.start, 
            end_date: dateRange.end 
          })
        });

        if (res.ok) {
          const data = await res.json();
          // Limit to 3 articles per topic
          const limitedArticles = data.articles.slice(0, 3).map((article: Article) => ({
            ...article,
            topic: topic.name
          }));
          allArticles.push(...limitedArticles);
        }
      }

      setArticles(allArticles);

      // Generate overall summary if we have articles
      if (allArticles.length > 0) {
        const summaryRes = await fetch(`${API_BASE_URL}/api/summarize_all`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ articles: allArticles })
        });

        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          
          console.log('Raw API response length:', summaryData.summary?.length || 0);
          console.log('Raw API response preview:', summaryData.summary?.substring(0, 200) + '...');
          
          // Parse the summary to extract bullet points for each topic and overall summary
          const articleMap: { [url: string]: string[] } = {};
          let topicSummaries: { [topicName: string]: string[] } = {};
          let overallSummary = '';
          let currentIdx = 0;
          let lines = summaryData.summary.split(/\r?\n/);
          let collecting = false;
          let bullets: string[] = [];
          let urlList = allArticles.map(a => a.url);
          let currentTopic = '';
          
          // Group articles by topic
          const articlesByTopicLocal: { [topicName: string]: Article[] } = {};
          allArticles.forEach(article => {
            if (article.topic) {
              if (!articlesByTopicLocal[article.topic]) {
                articlesByTopicLocal[article.topic] = [];
              }
              articlesByTopicLocal[article.topic].push(article);
            }
          });
          
          // Store in state for access in rendering
          setArticlesByTopic(articlesByTopicLocal);
          
          for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            if (line.match(/^Article \d+:/)) {
              if (collecting && urlList[currentIdx - 1]) {
                articleMap[urlList[currentIdx - 1]] = bullets;
              }
              collecting = true;
              bullets = [];
              currentIdx++;
              // Find the topic for this article
              const article = allArticles[currentIdx - 1];
              currentTopic = article?.topic || '';
            } else if (line.startsWith('- ')) {
              bullets.push(line.substring(2));
            } else if (line.includes('All Articles Summary:')) {
              if (collecting && urlList[currentIdx - 1]) {
                articleMap[urlList[currentIdx - 1]] = bullets;
              }
              // Collect the overall summary bullet points
              let summaryBullets: string[] = [];
              for (let j = i + 1; j < lines.length; j++) {
                const summaryLine = lines[j].trim();
                if (summaryLine.startsWith('- ')) {
                  summaryBullets.push(summaryLine.substring(2));
                } else if (summaryLine && !summaryLine.includes('Article')) {
                  // This might be a summary sentence
                  if (summaryBullets.length === 0) {
                    overallSummary = summaryLine;
                  }
                  break;
                }
              }
              // If we found summary bullets, create a summary sentence
              if (summaryBullets.length > 0 && !overallSummary) {
                overallSummary = 'Summary of key themes and insights across all articles.';
              }
              break;
            }
          }
          
          // Organize bullet points by topic, ensuring one bullet per article
          Object.keys(articlesByTopicLocal).forEach(topic => {
            const topicArticles = articlesByTopicLocal[topic];
            topicSummaries[topic] = [];
            
            topicArticles.forEach(article => {
              const articleBullets = articleMap[article.url];
              if (articleBullets && articleBullets.length > 0) {
                // Take the first bullet point for each article
                topicSummaries[topic].push(articleBullets[0]);
              }
            });
          });
          
          // If no overall summary sentence was found, create one from the actual article content
          if (!overallSummary || overallSummary.trim() === '') {
            // Create a meaningful summary from the actual article content
            const topicNames = Object.keys(topicSummaries);
            if (topicNames.length > 0) {
              // Extract key themes and create a coherent summary
              const keyThemes = topicNames.map(topic => {
                const bullets = topicSummaries[topic];
                if (bullets && bullets.length > 0) {
                  // Look for common themes in the bullet points
                  const firstBullet = bullets[0].toLowerCase();
                  if (firstBullet.includes('collaboration') || firstBullet.includes('partnership')) {
                    return 'partnerships and collaborations';
                  } else if (firstBullet.includes('application') || firstBullet.includes('process')) {
                    return 'business processes and applications';
                  } else if (firstBullet.includes('trump') || firstBullet.includes('hamas') || firstBullet.includes('political')) {
                    return 'political developments and international relations';
                  } else if (firstBullet.includes('technology') || firstBullet.includes('innovation')) {
                    return 'technological innovation and development';
                  } else {
                    return topic.toLowerCase();
                  }
                }
                return topic.toLowerCase();
              });
              
              // Create a summary sentence
              if (keyThemes.length === 1) {
                overallSummary = `Today's briefing focuses on ${keyThemes[0]}.`;
              } else if (keyThemes.length === 2) {
                overallSummary = `Today's briefing covers ${keyThemes[0]} and ${keyThemes[1]}.`;
              } else {
                const lastTheme = keyThemes.pop();
                overallSummary = `Today's briefing spans ${keyThemes.join(', ')}, and ${lastTheme}.`;
              }
            } else {
              overallSummary = 'Your personalized briefing is ready with the latest news across your selected topics.';
            }
          }
          

          
          // Create a formatted summary that matches the backend format
          let formattedSummary = '';
          
          // Generate synthesized topic summaries using GPT
          const topicSummariesPromises = Object.keys(topicSummaries).map(async (topic) => {
            const bullets = topicSummaries[topic];
            if (bullets.length === 0) return { topic, summary: '' };
            
            try {
              const response = await fetch(`${API_BASE_URL}/api/summarize_topic`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                  topic: topic,
                  bulletPoints: bullets 
                })
              });
              
              if (response.ok) {
                const data = await response.json();
                return { topic, summary: data.summary };
              } else {
                console.error(`Failed to summarize topic ${topic}:`, response.statusText);
                return { topic, summary: bullets.join('\n• ') };
              }
            } catch (error) {
              console.error(`Error summarizing topic ${topic}:`, error);
              return { topic, summary: bullets.join('\n• ') };
            }
          });
          
          // Wait for all topic summaries to complete
          const topicSummariesResults = await Promise.all(topicSummariesPromises);
          
          // Build the formatted summary
          topicSummariesResults.forEach(({ topic, summary }) => {
            if (summary) {
              formattedSummary += `${topic}:\n${summary}\n\n`;
            }
          });
          
          setAllBullets(articleMap);
          setOverallSummary(formattedSummary.trim());
          
          // Save briefing to history
          await saveBriefingHistoryToDB(allArticles, formattedSummary.trim(), articleMap);
        }
      }
    } catch (err) {
      setError('Failed to fetch briefing');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (rawDate: string) => {
    if (!rawDate) return '';
    
    let d;
    if (/^\d{8}T\d{6}Z$/.test(rawDate)) {
      const year = rawDate.slice(0, 4);
      const month = rawDate.slice(4, 6);
      const day = rawDate.slice(6, 8);
      const hour = rawDate.slice(9, 11);
      const min = rawDate.slice(11, 13);
      const sec = rawDate.slice(13, 15);
      d = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`);
    } else {
      d = new Date(rawDate);
    }
    
    if (!isNaN(d.getTime())) {
      const pad = (n: number) => n.toString().padStart(2, '0');
      return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }
    return rawDate;
  };

  if (isLoadingConfig) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (isSetupMode) {
    return (
      <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-lg border border-slate-100 dark:border-gray-800">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100">
                {isCreatingNew ? 'Create New Briefing' : 'Set Up Your Briefing'}
              </h2>
              {isCreatingNew && (
                <button
                  onClick={() => {
                    setIsCreatingNew(false);
                    setIsSetupMode(false);
                    if (briefingConfigs.length > 0) {
                      selectConfig(briefingConfigs[0].id!);
                    }
                  }}
                  className="px-4 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition duration-200"
                >
                  ← Back to Briefings
                </button>
              )}
            </div>
            
            {/* Briefing Name Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Briefing Name
              </h3>
              <input
                type="text"
                placeholder="Enter a name for your briefing..."
                value={config.name}
                onChange={(e) => setConfig(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
              />
            </div>

            {/* Briefing Description Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Description (Optional)
              </h3>
              <textarea
                placeholder="Add a description for your briefing..."
                value={config.description || ''}
                onChange={(e) => setConfig(prev => ({ ...prev, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 resize-none"
              />
            </div>
            
            {/* Topics Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Choose Your Topics
              </h3>
              
              {/* Add Custom Topic */}
              <div className="flex gap-2 mb-4">
                <input
                  type="text"
                  placeholder="Add a custom topic..."
                  value={newTopic}
                  onChange={(e) => setNewTopic(e.target.value)}
                  className="flex-1 border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  onKeyPress={(e) => e.key === 'Enter' && addTopic(newTopic, true)}
                />
                <button
                  onClick={() => addTopic(newTopic, true)}
                  className="px-4 py-2 bg-teal-500 hover:bg-orange-500 text-white rounded-lg font-semibold transition duration-200"
                >
                  Add
                </button>
              </div>

              {/* Suggested Topics */}
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Suggested Topics:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {suggestedTopics.map((topic) => (
                    <button
                      key={topic}
                      onClick={() => addTopic(topic, false)}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-800 hover:bg-teal-100 dark:hover:bg-teal-900 text-gray-700 dark:text-gray-300 rounded-lg text-sm transition duration-200"
                    >
                      {topic}
                    </button>
                  ))}
                </div>
              </div>

              {/* Selected Topics */}
              {config.topics.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Selected Topics:
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {config.topics.map((topic) => (
                      <div
                        key={topic.id}
                        className="flex items-center gap-2 px-3 py-1 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 rounded-lg text-sm"
                      >
                        <span>{topic.name}</span>
                        <button
                          onClick={() => removeTopic(topic.id)}
                          className="text-teal-500 hover:text-teal-700 dark:hover:text-teal-100"
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Frequency Section */}
            <div className="mb-8">
              <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-4">
                Briefing Frequency
              </h3>
              <div className="flex gap-4">
                {(['daily', 'weekly', 'monthly'] as const).map((freq) => (
                  <label key={freq} className="flex items-center">
                    <input
                      type="radio"
                      name="frequency"
                      value={freq}
                      checked={config.frequency === freq}
                      onChange={(e) => setConfig(prev => ({ ...prev, frequency: e.target.value as 'daily' | 'weekly' | 'monthly' }))}
                      className="mr-2"
                    />
                    <span className="text-gray-700 dark:text-gray-300 capitalize">{freq}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Save Button */}
            <button
              onClick={saveBriefingConfig}
              disabled={config.topics.length === 0 || !config.name.trim()}
              className="w-full px-6 py-3 bg-teal-500 hover:bg-orange-500 text-white rounded-lg font-bold text-lg transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreatingNew ? 'Create Briefing' : 'Save & Start Briefing'}
            </button>


          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 sm:p-8 overflow-x-auto">
      <div className="w-full max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8 w-full">
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-800 dark:text-gray-100">
              Your Briefings
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mt-2 break-words">
              {hasLoadedLatestBriefing && latestBriefingDate && (
                <span className="text-teal-600 dark:text-teal-400">
                  Updated on {latestBriefingDate}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 sm:gap-4 flex-shrink-0">
            <button
              onClick={() => setIsSetupMode(true)}
              className="px-3 py-2 sm:px-4 text-sm sm:text-base bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-semibold transition duration-200 whitespace-nowrap"
            >
              Edit Settings
            </button>
            <button
              onClick={fetchBriefing}
              disabled={loading}
              className="px-3 py-2 sm:px-6 text-sm sm:text-base bg-teal-500 hover:bg-orange-500 text-white rounded-lg font-semibold transition duration-200 disabled:opacity-50 whitespace-nowrap"
            >
              {loading ? 'Loading...' : 'Generate New Briefing'}
            </button>
          </div>
        </div>

        {/* Briefing Selector */}
        {briefingConfigs.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-2xl shadow-lg border border-slate-100 dark:border-gray-800 mb-6 w-full max-w-full">
            <div className="flex items-center justify-between mb-4 w-full">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">
                Select Briefing
              </h3>
              <button
                onClick={createNewBriefing}
                className="px-3 py-1 bg-teal-500 hover:bg-orange-500 text-white rounded-lg text-sm font-medium transition duration-200"
              >
                + New Briefing
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-full">
              {briefingConfigs.map((briefingConfig) => (
                <button
                  key={briefingConfig.id}
                  onClick={() => selectConfig(briefingConfig.id!)}
                  className={`p-3 rounded-lg border transition-all duration-200 text-left ${
                    selectedConfigId === briefingConfig.id
                      ? 'border-teal-500 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300'
                      : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
                  }`}
                >
                  <div className="font-medium text-sm">{briefingConfig.name}</div>
                  {briefingConfig.description && (
                    <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                      {briefingConfig.description}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    {briefingConfig.topics?.length || 0} topics • {briefingConfig.frequency}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && (
          <div className="bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 p-4 rounded-lg mb-6">
            {error}
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
            <span className="ml-3 text-gray-600 dark:text-gray-400">Loading your briefing...</span>
          </div>
        )}

        {/* Topic Filters */}
        {articles.length > 0 && (
          <div className="bg-white dark:bg-gray-900 p-3 sm:p-4 rounded-2xl shadow-lg border border-slate-100 dark:border-gray-800 mb-6 w-full max-w-full">
            <div className="flex items-center gap-4 w-full flex-wrap">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Filter by topic:</span>
              <button
                onClick={() => setSelectedTopicFilter('all')}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                  selectedTopicFilter === 'all'
                    ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                All Topics
              </button>
              {config.topics.map((topic) => (
                <button
                  key={topic.id}
                  onClick={() => setSelectedTopicFilter(topic.name)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${
                    selectedTopicFilter === topic.name
                      ? 'bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  {topic.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Overall Summary */}
        {overallSummary && (
          <div className="bg-white dark:bg-gray-900 p-3 sm:p-6 rounded-2xl shadow-lg border border-slate-100 dark:border-gray-800 mb-8 w-full max-w-full">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
                Key Takeaways
              </h3>
              <button
                onClick={() => setIsSummaryExpanded(!isSummaryExpanded)}
                className="text-gray-500 hover:text-teal-600 dark:text-gray-400 dark:hover:text-teal-400 transition-colors"
              >
                {isSummaryExpanded ? '−' : '+'}
              </button>
            </div>
            
            {isSummaryExpanded && (
              <div className="space-y-3">
                {(() => {
                  const lines = overallSummary.split('\n');
                  const elements: React.ReactNode[] = [];
                  let currentTopic = '';
                  let currentBullets: React.ReactNode[] = [];
                  
                  for (let i = 0; i < lines.length; i++) {
                    const line = lines[i].trim();
                    if (!line) continue;
                    
                    // Check if this is a topic header (ends with ':')
                    if (line.endsWith(':')) {
                      // Render previous topic's bullets if any
                      if (currentTopic && currentBullets.length > 0) {
                        if (selectedTopicFilter === 'all' || currentTopic === selectedTopicFilter) {
                          elements.push(
                            <div key={`bullets-${currentTopic}`} className="mt-2">
                              <ul className="list-disc list-inside text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 space-y-1">
                                {currentBullets}
                              </ul>
                            </div>
                          );
                        }
                      }
                      
                      const topicName = line.slice(0, -1);
                      currentTopic = topicName;
                      currentBullets = [];
                      
                      // Filter by selected topic
                      if (selectedTopicFilter === 'all' || topicName === selectedTopicFilter) {
                        elements.push(
                          <div key={`header-${topicName}`} className="pt-2">
                            <h4 className="text-base font-semibold text-teal-700 dark:text-teal-300 mb-1">
                              {topicName}
                            </h4>
                          </div>
                        );
                      }
                    }
                    // Check if this is a bullet point (starts with '•')
                    else if (line.startsWith('•')) {
                      if (selectedTopicFilter === 'all' || currentTopic === selectedTopicFilter) {
                        const bulletText = line.substring(1).trim();
                        
                        // Check if bullet starts with "The article" and create hyperlink
                        if (bulletText.toLowerCase().startsWith('the article')) {
                          // Find the corresponding article for this bullet point
                          const articleIndex = currentBullets.length; // This bullet's index within the topic
                          const topicArticles = articlesByTopic[currentTopic] || [];
                          const article = topicArticles[articleIndex];
                          
                          if (article && article.url) {
                            // Split the text to isolate "The article" portion
                            const articlePrefix = bulletText.substring(0, 11); // "The article"
                            const remainingText = bulletText.substring(11);
                            
                            currentBullets.push(
                              <li key={`bullet-${i}`} className="leading-relaxed text-sm text-gray-800 dark:text-gray-100">
                                <a 
                                  href={article.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-teal-600 dark:text-teal-400 hover:underline font-medium"
                                >
                                  {articlePrefix}
                                </a>
                                {remainingText}
                              </li>
                            );
                          } else {
                            // Fallback if no article found
                            currentBullets.push(
                              <li key={`bullet-${i}`} className="leading-relaxed text-sm text-gray-800 dark:text-gray-100">
                                {bulletText}
                              </li>
                            );
                          }
                        } else {
                          // Regular bullet point without "The article"
                          currentBullets.push(
                            <li key={`bullet-${i}`} className="leading-relaxed text-sm text-gray-800 dark:text-gray-100">
                              {bulletText}
                            </li>
                          );
                        }
                      }
                    }

                  }
                  
                  // Render final topic's bullets if any
                  if (currentTopic && currentBullets.length > 0) {
                    if (selectedTopicFilter === 'all' || currentTopic === selectedTopicFilter) {
                      elements.push(
                        <div key={`bullets-${currentTopic}-final`} className="mt-2">
                          <ul className="list-disc list-inside text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 space-y-1">
                            {currentBullets}
                          </ul>
                        </div>
                      );
                    }
                  }
                  
                  return elements;
                })()}
              </div>
            )}
          </div>
        )}

        {/* Articles */}
        {articles.length > 0 && (
          <div className="space-y-6 w-full max-w-full">
            <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 w-full">
              Articles ({articles.filter(article => selectedTopicFilter === 'all' || article.topic === selectedTopicFilter).length})
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-6 w-full max-w-full">
              {articles
                .filter(article => selectedTopicFilter === 'all' || article.topic === selectedTopicFilter)
                .map((article, idx) => {
                  const imgSrc = article.image && /^https?:\/\//.test(article.image) ? article.image :
                    (article.socialimage && /^https?:\/\//.test(article.socialimage) ? article.socialimage : null);
                  
                  return (
                    <div 
                      key={idx} 
                      className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-slate-100 dark:border-gray-800 p-3 sm:p-6 hover:shadow-xl transition-all duration-300 w-full max-w-full"
                    >
                      <div className="flex gap-4">
                        {/* Article image */}
                        <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                          {imgSrc ? (
                            <img src={imgSrc} alt={article.title} className="object-cover w-full h-full" />
                          ) : (
                            <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a4 4 0 004 4h10a4 4 0 004-4V7a4 4 0 00-4-4H7a4 4 0 00-4 4z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11l2 2 4-4m0 0l2 2m-2-2v6" />
                            </svg>
                          )}
                        </div>
                        
                        {/* Article content */}
                        <div className="flex flex-col flex-1 min-w-0">
                          <div className="flex items-start justify-between mb-2">
                            <a 
                              href={article.url} 
                              target="_blank" 
                              rel="noopener noreferrer" 
                              className="text-lg font-bold text-teal-700 dark:text-teal-300 hover:underline transition-colors duration-200 line-clamp-2"
                            >
                              {article.title}
                            </a>
                            {article.topic && (
                              <span className="ml-2 px-2 py-1 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs rounded-full whitespace-nowrap">
                                {article.topic}
                              </span>
                            )}
                          </div>
                          
                          {formatDate(article.seendate || article.date || '') && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                              {formatDate(article.seendate || article.date || '')}
                            </div>
                          )}
                          
                          {article.domain && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                              Source: {article.domain}
                            </div>
                          )}
                          
                          {article.summary && (
                            <div className="text-sm text-gray-700 dark:text-gray-200 line-clamp-3">
                              {article.summary}
                            </div>
                          )}
                        </div>
                      </div>
                      
                      {/* Show bullet points if available */}
                      {allBullets[article.url] && allBullets[article.url].length > 0 && (
                        <div className="mt-4">
                          <ul className="list-disc list-inside text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 space-y-1">
                            {allBullets[article.url].map((bullet, bulletIndex) => (
                              <li key={bulletIndex} className="leading-relaxed">{bullet}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!loading && articles.length === 0 && (
          <div className="text-center py-12">
            <div className="text-gray-500 dark:text-gray-400 text-lg mb-4">
              No articles in your briefing yet
            </div>
            <p className="text-gray-400 dark:text-gray-500 mb-6">
              Click "Refresh Briefing" to fetch the latest articles for your selected topics.
            </p>
            <button
              onClick={fetchBriefing}
              className="px-6 py-3 bg-teal-500 hover:bg-orange-500 text-white rounded-lg font-semibold transition duration-200"
            >
              Get Your First Briefing
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default BriefingDashboard; 