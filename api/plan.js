import {randomUUID,createHmac,timingSafeEqual} from 'node:crypto';
import {db,configured} from '../lib/db.js';
import {validateInput,allocation,validateOutput,normalizeZeroBuckets,NAMES,PlanValidationError} from '../lib/planning.js';
import {examplesFor} from '../lib/catalogue.js';
import {SYSTEM_PROMPT} from '../lib/prompt.js';
const MODEL = 'gemini-3.5-flash-lite';
const MAX_OUTPUT_TOKENS = 600;
export function visitor(req,res) {
  const sign = id => createHmac('sha256',process.env.SUPABASE_SERVICE_KEY).update(id).digest('hex');
  const cookie = (req.headers.cookie || '').split(';').map(s=>s.trim()).find(s=>s.startsWith('payday_visitor='))?.slice(15);
  let [id,signature] = (cookie || '').split('.');
  const valid = /^[0-9a-f-]{36}$/i.test(id || '') && /^[0-9a-f]{64}$/i.test(signature || '') && timingSafeEqual(Buffer.from(signature,'hex'),Buffer.from(sign(id),'hex'));
  if (!valid) id = randomUUID();
  res.setHeader('Set-Cookie',`payday_visitor=${id}.${sign(id)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=31536000`);
  return id;
}
const refusal = reason => ({status:'refused',reason});
function logInput(raw) {
  // Never retain injected free text or extra personal fields in this demo table.
  const safe = {};
  for (const k of ['take_home_pay','essentials_and_emis','amount_to_save','purchase_cost']) {
    if (raw?.[k] != null) safe[k] = typeof raw[k] === 'number' && Number.isFinite(raw[k]) ? raw[k] : '[invalid]';
  }
  for (const [k,allowed] of Object.entries({emergency_savings:['none','under_3_months','3_months_or_more'],purchase_planned:['yes','no'],risk_comfort:['low','medium','high']})) {
    if (raw?.[k] != null) safe[k] = allowed.includes(raw[k]) ? raw[k] : '[invalid]';
  }
  return safe;
}
export default async function handler(req,res) {
  res.setHeader('Cache-Control','no-store');
  if (req.method !== 'POST') return res.status(405).json({error:'Use POST.'});
  const origin = req.headers.origin;
  if (origin) {
    try { if (new URL(origin).host !== req.headers.host) return res.status(403).json({error:'Submit from this website.'}); }
    catch { return res.status(403).json({error:'Invalid origin.'}); }
  }
  if (!configured()) return res.status(503).json({error:'The planner setup is incomplete. Please try later.'});
  let raw;
  try {
    if (!req.headers['content-type']?.includes('application/json')) throw new Error();
    raw = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    if (JSON.stringify(raw ?? null).length > 4096) return res.status(413).json({error:'The request is too large.'});
  } catch { return res.status(400).json(refusal('Please submit the form as valid JSON.')); }
  let id;
  let tokens = {input_tokens:null,output_tokens:null};
  try {
    const visitorId=visitor(req,res);
    const previous=await db(`payday_plans?visitor_id=eq.${visitorId}&status=eq.ok&select=id&limit=1`);
    if(previous.length) return res.status(403).json({code:'signup_required',error:'You have created your free trial plan. Sign up to continue with Payday Planner.'});
    const claim = await db('rpc/claim_payday_request',{method:'POST',body:JSON.stringify({p_visitor:visitorId,p_input:logInput(raw)})});
    if (!claim.id) {
      if(claim.reason==='signup') return res.status(403).json({code:'signup_required',error:'You have created your free trial plan. Sign up to continue with Payday Planner.'});
      return res.status(429).json({code:claim.reason,error:claim.reason==='pending' ? 'A plan is already being generated in this browser. Please wait for it to finish.' : claim.reason==='visitor' ? 'You have reached the retry limit for this trial. Please sign up to continue.' : 'The planner has reached its daily limit. Please try tomorrow.'});
    }
    id = claim.id;
    const save = (status,output) => db(`payday_plans?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status,output,...tokens})});
    let input;
    try { input = validateInput(raw); }
    catch (e) {
      const output = refusal(e.message);
      tokens = {input_tokens:0,output_tokens:0};
      await save('refused',output);
      return res.status(400).json(output);
    }
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`,{
      method:'POST',headers:{'Content-Type':'application/json','x-goog-api-key':process.env.GEMINI_API_KEY},
      body:JSON.stringify({systemInstruction:{parts:[{text:SYSTEM_PROMPT+'\nSERVER ARITHMETIC: Use these exact checked amounts, in bucket order: '+allocation(input).join(', ')+'. Rounding must never make a bucket negative or exceed available savings. Keep each reason to 15 words or fewer. The server renders verified examples separately; do not supply names.'}]},contents:[{role:'user',parts:[{text:JSON.stringify(input)}]}],generationConfig:{maxOutputTokens:MAX_OUTPUT_TOKENS,responseMimeType:'application/json',thinkingConfig:{thinkingLevel:'minimal'},responseJsonSchema:{type:'object',properties:{status:{type:'string',enum:['ok','refused']},buckets:{type:'array',minItems:3,maxItems:3,items:{type:'object',properties:{name:{type:'string',enum:NAMES},amount:{type:'integer',minimum:0},reason:{type:'string'},options:{type:'array',items:{type:'string'}}},required:['name','amount','reason','options'],additionalProperties:false}},note:{type:'string'},reason:{type:'string'}},required:['status'],additionalProperties:false}}}),
      signal:AbortSignal.timeout(15000)
    });
    if (!response.ok) {
      const output = {status:'error',reason:response.status === 429 ? 'Gemini is busy or its quota has been reached. Please try later.' : 'The AI service could not generate a plan. Please try later.'};
      await save('error',output);
      return res.status(503).json({error:output.reason});
    }
    const data = await response.json();
    tokens = {input_tokens:data.usageMetadata?.promptTokenCount ?? null,output_tokens:data.usageMetadata ? (data.usageMetadata.candidatesTokenCount ?? 0) + (data.usageMetadata.thoughtsTokenCount ?? 0) : null};
    const candidate = data.candidates?.[0];
    const rawOutput = candidate?.content?.parts?.filter(p=>!p.thought).map(p=>p.text || '').join('') || '';
    let plan, modelPlan;
    try {
      if (candidate?.finishReason !== 'STOP') throw new PlanValidationError(candidate?.finishReason === 'MAX_TOKENS' ? 'incomplete_response' : 'model_stopped',candidate?.finishReason === 'MAX_TOKENS' ? 'The AI response was cut off before the plan was complete.' : 'The AI service stopped without completing a usable plan.');
      try { modelPlan = JSON.parse(rawOutput); } catch { throw new PlanValidationError('invalid_json','The AI response was not valid structured plan data.'); }
      plan = normalizeZeroBuckets(modelPlan,input);
      if (plan.status === 'refused') {
        // Refusal wording is fixed by the application; raw model text remains auditable.
        const output = refusal('The model could not provide a plan for these inputs.');
        await save('refused',{...output,model_response:plan});
        return res.status(422).json(output);
      }
      validateOutput(plan,input);
    } catch (e) {
      const code=e instanceof PlanValidationError ? e.code : 'invalid_format';
      const reason=e instanceof PlanValidationError ? e.message : 'The AI response did not match the required plan structure.';
      await save('error',{status:'error',reason,code,model_response:rawOutput});
      return res.status(502).json({code,error:'We could not show this plan. '+reason+' No plan was accepted. You can retry without using your successful trial plan.'});
    }
    const output = {...plan,buckets:plan.buckets.map((b,i)=>({...b,examples:examplesFor(b,i)})),catalogue_note:'Illustrative examples from a small HDFC Mutual Fund catalogue, not a ranking or endorsement. Other providers are available. Names checked on 5 October 2026; examples expire after 30 days without review.'};
    await save('ok',{...output,model_response:modelPlan});
    return res.status(200).json(output);
  } catch {
    if (id) { try { await db(`payday_plans?id=eq.${id}`,{method:'PATCH',body:JSON.stringify({status:'error',output:{status:'error',reason:'Request interrupted or service unavailable.'},...tokens})}); } catch {} }
    return res.status(503).json({error:'The planner is temporarily unavailable. Please try later.'});
  }
}
