const plannerForm = document.getElementById('planner-form');
const plannerStatus = document.getElementById('planner-status');
const planResult = document.getElementById('plan-result');
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
let latestPlan;
let latestInput;
let trialUsed=false;
let trialBlocked=false;
let registered=false;
let paymentRequired=false;
let memberDailyLimit=false;
const signupNudge=document.getElementById("signup-nudge");
const signupForm=document.getElementById("access-form");
const registrationStatus=document.getElementById("registration-status");
const formatDate=value=>new Intl.DateTimeFormat('en-IN',{dateStyle:'medium'}).format(new Date(value));
function applyTrialState() {
  signupNudge.hidden=registered||!trialBlocked;
  if(!registered&&trialBlocked) signupNudge.querySelector('p').textContent=trialUsed
    ? 'You’ve used your free trial plan. Sign up with name and email to continue. No payment details now; add them after six months. First year free, then ₹999 a year.'
    : 'We could not complete your trial within the retry limit. You have not received a free plan. You can register with name and email to continue without payment details.';
  const button=document.getElementById("generate-plan");
  button.disabled=trialBlocked;
  button.textContent=paymentRequired ? 'Payment setup required' : memberDailyLimit ? 'Daily request limit reached' : trialBlocked ? 'Sign up to create another plan' : 'Create my payday plan';
}
function setAccess(access) {
  registered=access.registered===true;
  paymentRequired=access.payment_required===true;
  memberDailyLimit=registered&&access.daily_limit_reached===true;
  trialUsed=access.used===true;
  trialBlocked=registered ? paymentRequired||memberDailyLimit : trialUsed||access.retry_limit_reached===true;
  const headerSignup=document.querySelector('.header .button');
  headerSignup.textContent=registered ? 'My planner' : 'Sign up';headerSignup.href=registered ? '#try-plan' : '#early-access';
  signupForm.hidden=registered;
  registrationStatus.hidden=!registered;
  if(registered) {
    registrationStatus.replaceChildren();
    registrationStatus.append(node('h3','You’re registered in this browser'));
    registrationStatus.append(node('p','Registered: '+formatDate(access.registered_at)+'. Payment setup required: '+formatDate(access.payment_due_at)+'. Your free year ends: '+formatDate(access.free_year_ends_at)+'.'));
    registrationStatus.append(node('p','No payment details have been collected and no payment will be taken by this assignment version.','small'));
    const link=node('a','Go to my planner','button');link.href='#try-plan';registrationStatus.append(link);
    plannerStatus.textContent=paymentRequired ? 'Your six-month access period has ended. Secure payment setup must be connected to continue; no payment has been taken.' : memberDailyLimit ? 'You have used today’s five requests. Please try tomorrow.' : 'Registration is active. '+access.requests_remaining_today+' requests remain today. No payment details are needed now.';
  } else if(trialBlocked) plannerStatus.textContent=trialUsed ? 'Your free trial plan is complete. Sign up to continue without payment details.' : 'This browser has reached the trial retry limit without a plan. Register to continue.';
  applyTrialState();
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
      if(data.code==='signup_required'||data.code==='visitor'){trialBlocked=true;trialUsed=data.code==='signup_required';}
      if(data.code==='payment_required'){registered=true;paymentRequired=true;trialBlocked=true;}
      if(data.code==='member_daily'){registered=true;memberDailyLimit=true;trialBlocked=true;}
      throw new Error(data.reason || data.error || 'The plan could not be generated.');
    }
    latestPlan = data; latestInput = input; renderPlan(data);
    trialUsed=true;trialBlocked=!registered;
    plannerStatus.textContent = 'Your plan is ready. The three amounts add up to '+money(input.amount_to_save)+'.';
    await refreshStats();
  } catch (error) {
    plannerStatus.textContent = error.name === 'TimeoutError' ? 'The request took too long. It may still complete and use a try. Please wait before retrying.' : error instanceof TypeError ? 'We could not connect. Check your connection and try again when ready.' : error.message;
  } finally { planResult.setAttribute('aria-busy','false'); fields.forEach(field=>{field.disabled=false;}); applyTrialState(); }
});
refreshStats();
async function refreshTrial() {
  document.getElementById('generate-plan').disabled=true;
  try {
    const response=await fetch('/api/trial',{cache:'no-store',signal:AbortSignal.timeout(8000)});
    if(!response.ok) throw new Error();
    setAccess(await response.json());
  } catch {
    trialBlocked=true;
    document.getElementById('generate-plan').disabled=true;
    plannerStatus.textContent='Access setup is temporarily unavailable. The registration database update needs to be applied before this version can be used.';
    signupNudge.hidden=true;
    return;
  }
}
refreshTrial();
signupForm.addEventListener('submit',async event=>{
  event.preventDefault();
  if(!signupForm.reportValidity()) return;
  const status=document.getElementById('form-status');
  const button=document.getElementById('signup-button');
  button.disabled=true;status.textContent='Saving your registration…';
  try {
    const response=await fetch('/api/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({
      name:document.getElementById('signup-name').value,email:document.getElementById('signup-email').value,consent:document.getElementById('signup-consent').checked
    }),signal:AbortSignal.timeout(10000)});
    const data=await response.json();
    if(!response.ok||data.status!=='registered') throw new Error(data.error||'Registration could not be saved.');
    signupForm.reset();setAccess(data);
  } catch(error) {
    status.textContent=error.name==='TimeoutError' ? 'Registration may still complete. Refresh before trying again; your registration date will not be reset.' : error instanceof TypeError ? 'Could not connect. Please check your connection and try again.' : error.message;
  } finally {button.disabled=false;}
});
