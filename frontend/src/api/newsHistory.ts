import { supabase } from '../supabaseClient';

export interface NewsSearch {
  id?: string;
  user_id: string;
  topic: string;
  start_date: string;
  end_date: string;
  articles: any[];
  overall_summary?: string;
  created_at?: string;
}

export async function saveNewsSearch(searchData: Omit<NewsSearch, 'id' | 'created_at'>) {
  const { data, error } = await supabase
    .from('news_searches')
    .insert([searchData])
    .select()
    .single();
  
  return { data, error };
}

export async function getNewsHistory(userId: string) {
  const { data, error } = await supabase
    .from('news_searches')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  return { data, error };
}

export async function deleteNewsSearch(searchId: string) {
  const { error } = await supabase
    .from('news_searches')
    .delete()
    .eq('id', searchId);
  
  return { error };
} 