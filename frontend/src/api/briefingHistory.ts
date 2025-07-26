import { supabase } from '../supabaseClient';

export interface BriefingHistory {
  id?: string;
  user_id: string;
  briefing_config_id: string;
  articles: any[];
  summary: any;
  created_at?: string;
  updated_at?: string;
}

export async function saveBriefingHistory(briefingData: Omit<BriefingHistory, 'id' | 'created_at' | 'updated_at'>) {
  const { data, error } = await supabase
    .from('briefing_history')
    .insert([briefingData])
    .select()
    .single();
  
  return { data, error };
}

export async function getLatestBriefing(userId: string, configId?: string) {
  let query = supabase
    .from('briefing_history')
    .select('*')
    .eq('user_id', userId);
  
  if (configId) {
    query = query.eq('briefing_config_id', configId);
  }
  
  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .single();
  
  return { data, error };
}

export async function getBriefingHistory(userId: string) {
  const { data, error } = await supabase
    .from('briefing_history')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  
  return { data, error };
}

export async function deleteBriefingHistory(briefingId: string) {
  const { error } = await supabase
    .from('briefing_history')
    .delete()
    .eq('id', briefingId);
  
  return { error };
} 