const plannerForm = document.getElementById('planner-form');
const plannerStatus = document.getElementById('planner-status');
const planResult = document.getElementById('plan-result');
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
let latestPlan;
let latestInput;
let trialUsed=false;
let trialBlocked=false;
const signupNudge=document.getElementById("signup-nudge");
function applyTrialState() {
  signupNudge.hidden=!trialBlocked;
  const button=document.getElementById("generate-plan");
  button.disabled=trialBlocked;
  button.textContent=trialBlocked ? "Sign up to create another plan" : "Create my payday plan";
}
const placeholder = document.getElementById("plan-placeholder");
function node(tag,text,className) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function renderPlan(plan) {
  planResult.replaceChildren();
  planResult.append(node('h3','Your illustrative payday plan'));
  if (latestInput) planResult.append(node('p',money(latestInput.amount_to_save)+' to save from '+money(latestInput.take_home_pay)+' monthly take-home pay.','small'));
  for (const [i,b] of plan.buckets.entries()) {
    const card = node('article',null,'allocation');
    const heading = node('div',null,'allocation-title');
    heading.append(node('h3',b.name),node('strong',money(b.amount)));
    card.append(heading,node('p',b.reason));
    if (b.options.length) card.append(node('p','Types people consider: '+b.options.join(', ')+'.'));
    if (b.amount > 0 && i === 2 && b.options.includes('PPF')) card.append(node('p','PPF has long access restrictions. Check current withdrawal rules before considering it.','small'));
    if (b.amount > 0 && i === 1 && b.options.includes('short-duration debt fund')) card.append(node('p','“Short duration” describes the portfolio, not guaranteed access or capital protection. It can lose value.','small'));
    const showEquity = document.getElementById('long-horizon').checked && document.getElementById('risk-comfort').value !== 'low';
    const examples = b.examples.filter(f => i !== 2 || showEquity);
    if (examples.length) {
      const details = node('details',null,'fund-examples');
      details.append(node('summary','Fund examples to research'));
      for (const f of examples) {
        const entry = node('div',null,'fund-entry');
        const link = node('a',f.name+' ('+f.plan+')');
        link.href = f.url; link.target = '_blank'; link.rel = 'noopener noreferrer';
        entry.append(link,node('p',f.caution,'small'),node('p','Name and category checked: '+f.checked,'small'));
        details.append(entry);
      }
      card.append(details);
    } else if (b.amount > 0 && i === 2) card.append(node('p','To view equity fund examples, choose medium or high risk and confirm you can leave this money invested for seven years.','small'));
    planResult.append(card);
  }
  planResult.append(node('p',plan.note,'small'),node('p',plan.catalogue_note,'small'));
  placeholder.hidden = true;
  planResult.hidden = false;
}
async function refreshStats() {
  const text = document.getElementById('planner-stats');
  try {
    const response = await fetch('/api/stats',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if (!response.ok) throw new Error();
    const s = await response.json();
    text.textContent = s.sample_size === 0 ? '0 plans generated so far. The average will appear after the first completed plan.' : `${s.plans_generated} ${s.plans_generated === 1 ? 'plan' : 'plans'} generated so far. On average, visitors set aside ${s.average_saving_share}% of take-home pay (across ${s.sample_size} ${s.sample_size === 1 ? 'plan' : 'plans'}).`;
  } catch { text.textContent = 'Usage figures are temporarily unavailable.'; }
}
function updateBudgetPreview() {
  const pay = Number(document.getElementById('take-home-pay').value);
  const expenses = Number(document.getElementById('essentials-emis').value);
  const saving = Number(document.getElementById('amount-save').value);
  const preview = document.getElementById('budget-preview');
  const valid = [pay,expenses,saving].every(Number.isFinite) && pay > 0 && expenses >= 0 && saving >= 0 && expenses + saving <= pay;
  preview.dataset.invalid = String(!valid);
  preview.textContent = valid ? money(pay-expenses-saving)+' remains for other spending after essentials, EMIs and your chosen savings.' : 'Your essentials, EMIs and savings must fit within your take-home pay.';
}
updateBudgetPreview();
document.getElementById('purchase-planned').addEventListener('change',function() {
  const yes = this.value === 'yes';
  document.getElementById('purchase-field').hidden = !yes;
  document.getElementById('purchase-cost').required = yes;
});
document.getElementById('long-horizon').addEventListener('change',()=>{if(latestPlan) renderPlan(latestPlan);});
plannerForm.addEventListener('input',event=>{
  if (['long-horizon','planner-consent'].includes(event.target.id)) return;
  latestPlan = null;
  latestInput = null;
  planResult.hidden = true;
  placeholder.hidden = false;
  updateBudgetPreview();
  plannerStatus.textContent = '';
});
plannerForm.addEventListener('submit',async event => {
  event.preventDefault();
  if(trialBlocked){signupNudge.hidden=false;return;}
  if (!plannerForm.reportValidity()) return;
  const input = {
    take_home_pay:Number(document.getElementById('take-home-pay').value),
    essentials_and_emis:Number(document.getElementById('essentials-emis').value),
    amount_to_save:Number(document.getElementById('amount-save').value),
    emergency_savings:document.getElementById('emergency-savings').value,
    purchase_planned:document.getElementById('purchase-planned').value,
    purchase_cost:document.getElementById('purchase-planned').value === 'yes' ? Number(document.getElementById('purchase-cost').value) : 0,
    risk_comfort:document.getElementById('risk-comfort').value
  };
  if (input.amount_to_save > input.take_home_pay - input.essentials_and_emis) {
    plannerStatus.textContent = 'Choose a saving amount that fits within pay minus essentials and EMIs.';
    return;
  }
  const button = document.getElementById('generate-plan');
  const fields = Array.from(plannerForm.querySelectorAll('input,select'));
  fields.forEach(field=>{field.disabled=true;});
  button.disabled = true; button.textContent = 'Creating your plan…';
  plannerStatus.textContent = 'Checking your numbers and preparing your plan.';
  latestPlan = null; latestInput = null; planResult.hidden = true;
  planResult.setAttribute('aria-busy','true');
  try {
    const response = await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(28000)});
    const data = await response.json();
    if (!response.ok || data.status !== 'ok') {
      if(data.code==='signup_required'||data.code==='visitor'){trialBlocked=true;trialUsed=data.code==='signup_required';signupNudge.hidden=false;}
      throw new Error(data.reason || data.error || 'The plan could not be generated.');
    }
    latestPlan = data; latestInput = input; renderPlan(data);
    trialUsed=true;trialBlocked=true;signupNudge.hidden=false;
    plannerStatus.textContent = 'Your plan is ready. The three amounts add up to '+money(input.amount_to_save)+'.';
    await refreshStats();
  } catch (error) {
    plannerStatus.textContent = error.name === 'TimeoutError' ? 'The request took too long. It may still complete and use a try. Please wait before retrying.' : error instanceof TypeError ? 'We could not connect. Check your connection and try again when ready.' : error.message;
  } finally { planResult.setAttribute('aria-busy','false'); fields.forEach(field=>{field.disabled=false;}); applyTrialState(); }
});
refreshStats();
async function refreshTrial() {
  const button=document.getElementById('generate-plan');
  button.disabled=true;
  try {
    const response=await fetch('/api/trial',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error();
    const trial=await response.json();
    trialUsed=trial.used;trialBlocked=trial.used||trial.retry_limit_reached;
    if(trialBlocked) plannerStatus.textContent=trialUsed ? 'Your free trial plan is complete. Sign up to continue.' : 'This browser has reached the trial retry limit. Sign up to continue.';
  } catch { /* The server still checks trial eligibility on every request. */ }
  applyTrialState();
}
refreshTrial();
document.getElementById('access-form').addEventListener('submit',event=>{
  event.preventDefault();
  document.getElementById('form-status').textContent='Secure payment setup is not connected yet. Your details have not been sent or saved, and no account or subscription has been created.';
});
