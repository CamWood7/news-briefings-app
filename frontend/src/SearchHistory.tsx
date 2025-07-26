import React, { useState, useEffect } from 'react';
import { getNewsHistory, deleteNewsSearch, NewsSearch } from './api/newsHistory';
import { supabase } from './supabaseClient';

const SearchHistory: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [searchHistory, setSearchHistory] = useState<NewsSearch[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedArticles, setExpandedArticles] = useState<{ [key: string]: boolean }>({});

  // Get current user and load search history
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setCurrentUser(user);
      if (user) {
        const { data: history } = await getNewsHistory(user.id);
        setSearchHistory(history || []);
      }
      setLoading(false);
    };
    getUser();
  }, []);

  const handleDeleteSearch = async (searchId: string) => {
    try {
      await deleteNewsSearch(searchId);
      if (currentUser) {
        const { data: history } = await getNewsHistory(currentUser.id);
        setSearchHistory(history || []);
      }
    } catch (err) {
      console.error('Failed to delete search:', err);
    }
  };

  const toggleArticles = (searchId: string) => {
    setExpandedArticles(prev => ({
      ...prev,
      [searchId]: !prev[searchId]
    }));
  };



  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-200 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  return (
    <div className="flex-1 p-8">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold text-gray-800 dark:text-gray-100 mb-8">
            Search History
          </h2>

          {searchHistory.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-500 dark:text-gray-400 text-lg mb-4">
                No search history yet
              </div>
              <p className="text-gray-400 dark:text-gray-500">
                Your news searches will appear here once you start using the dashboard.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {searchHistory.map((search) => (
                <div key={search.id} className="bg-white dark:bg-gray-900 rounded-xl shadow-md border border-slate-100 dark:border-gray-800 p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold text-gray-800 dark:text-gray-100 mb-2">
                        {search.topic}
                      </h3>
                      <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        {search.start_date} to {search.end_date}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {search.articles?.length || 0} articles • {search.created_at ? new Date(search.created_at).toLocaleDateString() : 'Unknown date'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteSearch(search.id!)}
                      className="ml-4 px-3 py-1 rounded bg-red-500 hover:bg-red-600 text-white text-sm transition duration-200"
                    >
                      Delete
                    </button>
                  </div>
                  
                  {search.overall_summary && (
                    <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <h4 className="font-semibold text-gray-800 dark:text-gray-100 mb-2">Summary:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                        {search.overall_summary.split('\n').map((bullet, index) => (
                          <li key={index}>{bullet}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  
                  {search.articles && search.articles.length > 0 && (
                    <div className="mt-4">
                      <button
                        onClick={() => toggleArticles(search.id!)}
                        className="flex items-center gap-2 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:text-teal-600 dark:hover:text-teal-400 transition-colors"
                      >
                        <span className="text-lg">
                          {expandedArticles[search.id!] ? '−' : '+'}
                        </span>
                        Articles ({search.articles.length})
                      </button>
                      
                      {expandedArticles[search.id!] && (
                        <div className="mt-2 space-y-2">
                          {search.articles.slice(0, 5).map((article, index) => (
                            <div key={index} className="flex items-start gap-3 p-2 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
                              <div className="flex-shrink-0 w-8 h-8 rounded bg-teal-100 dark:bg-teal-900 flex items-center justify-center">
                                <span className="text-xs font-medium text-teal-700 dark:text-teal-300">
                                  {index + 1}
                                </span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <a 
                                  href={article.url} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-sm font-medium text-teal-600 dark:text-teal-400 hover:underline line-clamp-2"
                                >
                                  {article.title}
                                </a>
                                {article.domain && (
                                  <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                    {article.domain}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                          {search.articles.length > 5 && (
                            <div className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                              +{search.articles.length - 5} more articles
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
  );
};

export default SearchHistory; 