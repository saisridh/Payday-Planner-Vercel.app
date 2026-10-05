import {db} from '../lib/db.js';
import {visitor} from './plan.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'Use GET.'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY) return res.status(503).json({error:'Trial status is unavailable.'});
  try{
    const id=visitor(req,res);
    const rows=await db(`payday_plans?visitor_id=eq.${id}&select=status`);
    return res.status(200).json({used:rows.some(r=>r.status==='ok'),retry_limit_reached:rows.length>=5});
  }catch{return res.status(503).json({error:'Trial status is temporarily unavailable.'});}
}
