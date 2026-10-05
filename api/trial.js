import {db} from '../lib/db.js';
import {visitor} from './plan.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({error:'Use GET.'});
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY) return res.status(503).json({error:'Access setup is incomplete.'});
  try{
    return res.status(200).json(await db('rpc/payday_access',{method:'POST',body:JSON.stringify({p_visitor:visitor(req,res)})}));
  }catch{
    try {
      const rows=await db(`payday_plans?visitor_id=eq.${visitor(req,res)}&select=status`);
      return res.status(200).json({registered:false,used:rows.some(r=>r.status==='ok'),retry_limit_reached:rows.length>=5,payment_required:false,daily_limit_reached:false});
    }catch{return res.status(503).json({error:'Access is temporarily unavailable. The registration database setup may need to be completed.'});}
  }
}
