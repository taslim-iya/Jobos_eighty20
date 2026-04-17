import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

// MBA JobScout Supabase — read-only access to scraped_jobs
const SCRAPER_URL = 'https://ojtredjreiajjrgcwcuy.supabase.co';
const SCRAPER_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9qdHJlZGpyZWlhampyZ2N3Y3V5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI2MzExMTcsImV4cCI6MjA4ODIwNzExN30.au5FIjdjtuTQkJJl9f9P5N_rx3RhLjFVSGJql3UyRIk';

const scraper = createClient(SCRAPER_URL, SCRAPER_KEY);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const { search, source, location, limit = '50', offset = '0' } = req.query;

  let query = scraper
    .from('scraped_jobs')
    .select('*')
    .order('scraped_at', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (search && typeof search === 'string') {
    query = query.or(`title.ilike.%${search}%,company.ilike.%${search}%,description.ilike.%${search}%`);
  }

  if (source && typeof source === 'string') {
    query = query.eq('source', source);
  }

  if (location && typeof location === 'string') {
    query = query.ilike('location', `%${location}%`);
  }

  const { data, error, count } = await query;

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  // Also get total count
  const { count: total } = await scraper
    .from('scraped_jobs')
    .select('id', { count: 'exact', head: true });

  res.setHeader('Cache-Control', 'public, s-maxage=300');
  return res.status(200).json({
    jobs: data || [],
    total: total || 0,
    offset: Number(offset),
    limit: Number(limit),
  });
}
