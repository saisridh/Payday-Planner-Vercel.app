import {db} from '../lib/db.js';
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'GET') return res.status(405).json({error:'Use GET.'});
  try {
    const stats = await db('rpc/payday_stats',{method:'POST',body:'{}'});
    return res.status(200).json(stats);
  } catch { return res.status(503).json({error:'Usage figures are temporarily unavailable.'}); }
}
