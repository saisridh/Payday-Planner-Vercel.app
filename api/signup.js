import {db} from '../lib/db.js';
import {visitor} from './plan.js';
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST') return res.status(405).json({error:'Use POST.'});
  try{
    if(req.headers.origin&&new URL(req.headers.origin).host!==req.headers.host) return res.status(403).json({error:'Sign up from this website.'});
  }catch{return res.status(403).json({error:'Invalid origin.'});}
  if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY) return res.status(503).json({error:'Registration setup is incomplete.'});
  let name,email;
  try{
    if(!req.headers['content-type']?.includes('application/json')) throw new Error();
    const body=typeof req.body==='string'?JSON.parse(req.body):req.body;
    if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(k=>!['name','email','consent'].includes(k))||JSON.stringify(body).length>2048) throw new Error();
    if(typeof body.name!=='string'||typeof body.email!=='string'||body.consent!==true) throw new Error();
    name=body.name.trim().replace(/\s+/g,' ');email=body.email.trim().toLowerCase();
    if(!name||name.length>100||/[<>\p{C}]/u.test(name)||email.length>254||!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)) throw new Error();
  }catch{return res.status(400).json({error:'Enter a valid name and email address and agree to the registration notice. Do not enter payment details.'});}
  try{
    const access=await db('rpc/register_payday_visitor',{method:'POST',body:JSON.stringify({p_visitor:visitor(req,res),p_name:name,p_email:email})});
    if(access.error) return res.status(429).json({error:access.error});
    return res.status(200).json({status:'registered',...access});
  }catch{return res.status(503).json({error:'Registration could not be saved. Please complete the registration SQL setup in Supabase or try again later.'});}
}
