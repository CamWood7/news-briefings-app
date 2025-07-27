import React, { useState, useEffect } from 'react';
import { saveNewsSearch } from './api/newsHistory';
import { supabase } from './supabaseClient';
import { API_BASE_URL } from './config';

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
}

const getTodayRange = () => {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
  const toISO = (d: Date) => d.toISOString().slice(0, 10);
  return {
    start: toISO(yesterday),
    end: toISO(today)
  };
};

const todayRange = getTodayRange();

const Dashboard: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [startDate, setStartDate] = useState(todayRange.start);
  const [endDate, setEndDate] = useState(todayRange.end);
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<{ [url: string]: string | null }>({});
  const [summarizing, setSummarizing] = useState<{ [url: string]: boolean }>({});
  const [allSummary, setAllSummary] = useState<string | null>(null);
  const [allBullets, setAllBullets] = useState<{ [url: string]: string[] }>({});
  const [summarizingAll, setSummarizingAll] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const isDateValid = startDate && endDate && endDate >= startDate;

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
    };
    getUser();
  }, []);

  const handleRun = async () => {
    if (!isDateValid) {
      setError('End date must be after or equal to start date.');
      return;
    }
    setLoading(true);
    setError(null);
    setArticles([]);
    // Clear all summaries when running a new search
    setSummaries({});
    setAllSummary(null);
    setAllBullets({});
    try {
      const res = await fetch(`${API_BASE_URL}/api/news`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, start_date: startDate, end_date: endDate })
      });
      const data = await res.json();
      if (res.ok) {
        setArticles(data.articles);
        // Save search to history
        if (currentUser && data.articles.length > 0) {
          try {
            await saveNewsSearch({
              user_id: currentUser.id,
              topic,
              start_date: startDate,
              end_date: endDate,
              articles: data.articles,
              overall_summary: undefined // Will be updated when user summarizes
            });
          } catch (err) {
            console.error('Failed to save search history:', err);
          }
        }
      } else {
        setError(data.error || 'Failed to fetch news');
      }
    } catch (err: any) {
      setError('Failed to fetch news');
    } finally {
      setLoading(false);
    }
  };





  // Function to fetch summary for an article
  const handleSummarize = async (articleUrl: string) => {
    // If summary is already shown, remove it (toggle off)
    if (summaries[articleUrl]) {
      setSummaries(s => ({ ...s, [articleUrl]: null }));
      return;
    }
    setSummarizing(s => ({ ...s, [articleUrl]: true }));
    setSummaries(s => ({ ...s, [articleUrl]: null }));
    try {
      const res = await fetch(`${API_BASE_URL}/api/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: articleUrl })
      });
      const data = await res.json();
      setSummaries(s => ({ ...s, [articleUrl]: data.summary || 'No summary available.' }));
    } catch (err) {
      setSummaries(s => ({ ...s, [articleUrl]: 'Failed to summarize.' }));
    } finally {
      setSummarizing(s => ({ ...s, [articleUrl]: false }));
    }
  };

  // Summarize All handler
  const handleSummarizeAll = async () => {
    setSummarizingAll(true);
    setAllSummary(null);
    setAllBullets({});
    try {
      const res = await fetch(`${API_BASE_URL}/api/summarize_all`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ articles })
      });
      const data = await res.json();
      if (data.summary) {
        // Parse OpenAI response
        // Expect: Article N: ...\n- bullet\n- bullet\n- bullet\n...\nAll Articles Summary:\n<summary>
        const articleMap: { [url: string]: string[] } = {};
        let globalSummary = '';
        let currentIdx = 0;
        let lines = data.summary.split(/\r?\n/);
        let collecting = false;
        let bullets: string[] = [];
        let urlList = articles.map(a => a.url);
        
        console.log('Parsing summary:', data.summary); // Debug log
        
        for (let i = 0; i < lines.length; i++) {
          const line = lines[i].trim();
          if (line.match(/^Article \d+:/)) {
            if (collecting && urlList[currentIdx - 1]) {
              articleMap[urlList[currentIdx - 1]] = bullets;
            }
            collecting = true;
            bullets = [];
            currentIdx++;
          } else if (line.startsWith('- ')) {
            bullets.push(line.substring(2));
          } else if (line.includes('All Articles Summary:') || line.includes('Overall Summary:')) {
            if (collecting && urlList[currentIdx - 1]) {
              articleMap[urlList[currentIdx - 1]] = bullets;
            }
            // Collect bullet points for global summary
            let globalBullets: string[] = [];
            for (let j = i + 1; j < lines.length; j++) {
              const summaryLine = lines[j].trim();
              if (summaryLine.startsWith('- ')) {
                globalBullets.push(summaryLine.substring(2));
              } else if (summaryLine && !summaryLine.startsWith('-') && summaryLine !== '') {
                // If we hit a non-bullet line, stop collecting
                break;
              }
            }
            globalSummary = globalBullets.join('\n');
            console.log('Found global summary:', globalSummary); // Debug log
            break;
          }
        }
        setAllBullets(articleMap);
        setAllSummary(globalSummary);
        
        // Update the most recent search with the summary
        if (currentUser) {
          try {
            const { data: history } = await supabase
              .from('news_searches')
              .select('*')
              .eq('user_id', currentUser.id)
              .order('created_at', { ascending: false })
              .limit(1);
            
            if (history && history.length > 0) {
              const mostRecentSearch = history[0];
              const { error } = await supabase
                .from('news_searches')
                .update({ overall_summary: globalSummary })
                .eq('id', mostRecentSearch.id);
            }
          } catch (err) {
            console.error('Failed to update search with summary:', err);
          }
        }
      }
    } catch (err) {
      setAllSummary('Failed to summarize all articles.');
      setAllBullets({});
    } finally {
      setSummarizingAll(false);
    }
  };

      return (
      <main className="flex-1 flex flex-col items-center justify-start py-8 px-2 md:px-0">
        <div className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-lg w-full max-w-4xl flex flex-col gap-6 border border-slate-100 dark:border-gray-800 transition-colors duration-300">
          {/* Search form */}
          <form
            className="flex flex-col md:flex-row md:items-end gap-4"
            onSubmit={e => { e.preventDefault(); handleRun(); }}
          >
            <div className="flex-1 flex flex-col">
              <label className="text-sm text-gray-700 dark:text-gray-200 mb-1 font-medium">News Topic</label>
              <input
                type="text"
                placeholder="Enter a news topic..."
                value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-700 rounded-lg px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm transition-colors duration-200"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-gray-700 dark:text-gray-200 mb-1 font-medium">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm transition-colors duration-200"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-sm text-gray-700 dark:text-gray-200 mb-1 font-medium">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                className="border border-gray-300 dark:border-gray-700 rounded-lg px-2 py-2 text-base focus:outline-none focus:ring-2 focus:ring-teal-400 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100 shadow-sm transition-colors duration-200"
              />
            </div>
            <button
              type="submit"
              className="h-12 mt-2 md:mt-0 px-6 py-2 rounded-lg font-bold text-base bg-teal-500 hover:bg-orange-500 text-white shadow-md transition duration-200 hover:scale-105"
              disabled={loading || !topic || !isDateValid}
            >
              {loading ? 'Loading...' : 'Run'}
            </button>
          </form>
          {error && <div className="text-red-500 text-sm font-medium text-center">{error}</div>}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
              <span className="ml-3 text-gray-600 dark:text-gray-400">Loading articles...</span>
            </div>
          )}
        </div>



        {/* Articles section - only show when articles exist */}
        {articles.length > 0 && (
          <div className="w-full max-w-4xl mx-auto mt-3">
            {/* Articles header with Summarize All button */}
            <div className="flex items-center justify-between mb-6 animate-fade-in-up" style={{ animationDelay: '0ms' }}>
              <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                Articles ({articles.length})
              </h2>
              <button
                className="px-5 py-2 rounded-lg font-bold text-base bg-teal-600 hover:bg-orange-500 text-white shadow-md transition duration-200 hover:scale-105 disabled:opacity-50"
                onClick={handleSummarizeAll}
                disabled={summarizingAll}
              >
                {summarizingAll ? 'Summarizing All...' : 'Summarize All'}
              </button>
            </div>

            {/* Global summary display */}
            {allSummary && (
              <div className="bg-white dark:bg-gray-900 border border-slate-200 dark:border-gray-800 rounded-xl p-4 shadow text-base text-gray-800 dark:text-gray-100 mb-6 animate-fade-in-up" style={{ animationDelay: '50ms' }}>
                <div className="font-bold mb-2">All Articles Summary:</div>
                <ul className="list-disc list-inside space-y-1">
                  {allSummary.split('\n').map((bullet, index) => (
                    <li key={index} className="text-sm">{bullet}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Articles grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[...articles]
            .map((article, idx) => {
              // Attach a comparable date value for sorting
              let rawDate = article.seendate || article.date;
              let sortDate = 0;
              if (rawDate) {
                if (/^\d{8}T\d{6}Z$/.test(rawDate)) {
                  // GDELT format: YYYYMMDDTHHmmssZ
                  const year = rawDate.slice(0, 4);
                  const month = rawDate.slice(4, 6);
                  const day = rawDate.slice(6, 8);
                  const hour = rawDate.slice(9, 11);
                  const min = rawDate.slice(11, 13);
                  const sec = rawDate.slice(13, 15);
                  sortDate = new Date(`${year}-${month}-${day}T${hour}:${min}:${sec}Z`).getTime();
                } else {
                  sortDate = new Date(rawDate).getTime();
                }
              }
              return { ...article, _sortDate: sortDate };
            })
            .sort((a, b) => (a._sortDate || 0) - (b._sortDate || 0))
            .map((article, idx) => {
              // Format date (prefer seendate, fallback to date)
              let formattedDate = '';
              let rawDate = article.seendate || article.date;
              if (rawDate) {
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
                  formattedDate = `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
                } else {
                  formattedDate = rawDate;
                }
              }
              // Image logic: prefer image, then socialimage, only if it's a valid URL
              let imgSrc = article.image && /^https?:\/\//.test(article.image) ? article.image :
                (article.socialimage && /^https?:\/\//.test(article.socialimage) ? article.socialimage : null);
              return (
                <div 
                  key={idx} 
                  className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-slate-100 dark:border-gray-800 p-6 hover:shadow-xl hover:scale-[1.03] transition-all duration-500 cursor-pointer animate-fade-in-up"
                  style={{
                    animationDelay: `${idx * 100}ms`,
                    animationFillMode: 'both'
                  }}
                >
                  {/* Article header with image and basic info */}
                  <div className="flex gap-4 mb-4">
                    {/* Article image */}
                    <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      {imgSrc ? (
                        <img src={imgSrc} alt={article.title} className="object-cover w-full h-full" />
                      ) : (
                        <svg className="w-10 h-10 text-gray-300 dark:text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a4 4 0 004 4h10a4 4 0 004-4V7a4 4 0 00-4-4H7a4 4 0 00-4 4z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 11l2 2 4-4m0 0l2 2m-2-2v6" /></svg>
                      )}
                    </div>
                    {/* Article content */}
                    <div className="flex flex-col flex-1 min-w-0">
                      <a href={article.url} target="_blank" rel="noopener noreferrer" className="text-lg font-bold text-teal-700 dark:text-teal-300 hover:underline mb-1 transition-colors duration-200 line-clamp-2">
                        {article.title}
                      </a>
                      {formattedDate && <div className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</div>}
                      {article.domain && <div className="text-xs text-gray-500 dark:text-gray-400">Source: {article.domain}</div>}
                      {article.summary && <div className="text-sm text-gray-700 dark:text-gray-200 mt-1 line-clamp-3">{article.summary}</div>}
                    </div>
                  </div>
                  
                  {/* Show OpenAI bullet points if available - full width */}
                  {allBullets[article.url] && allBullets[article.url].length > 0 && (
                    <div className="w-full">
                      <ul className="list-disc list-inside text-sm text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-gray-800 rounded p-3 border border-gray-200 dark:border-gray-700 space-y-1">
                        {allBullets[article.url].map((b, i) => (
                          <li key={i} className="leading-relaxed">{b}</li>
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
      </main>
  );
};

export default Dashboard; 