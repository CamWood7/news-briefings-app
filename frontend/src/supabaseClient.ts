import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://rixerjowgvcopsdowjsl.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpeGVyam93Z3Zjb3BzZG93anNsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTM0Njg2ODksImV4cCI6MjA2OTA0NDY4OX0.eBXyLqAX5BdXospakGP017X6mW-4GdYDNkFwB6xKapM';

export const supabase = createClient(supabaseUrl, supabaseAnonKey); 