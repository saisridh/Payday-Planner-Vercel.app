const plannerForm = document.getElementById('planner-form');
const plannerStatus = document.getElementById('planner-status');
const planResult = document.getElementById('plan-result');
const money = n => new Intl.NumberFormat('en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n);
let latestPlan;
function node(tag,text,className) {
  const e = document.createElement(tag);
  if (text != null) e.textContent = text;
  if (className) e.className = className;
  return e;
}
function renderPlan(plan) {
  planResult.replaceChildren();
  planResult.append(node('h3','Your illustrative payday plan'));
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
    } else if (b.amount > 0 && i === 2) card.append(node('p','Named equity examples appear only with medium/high risk comfort and the seven-year access confirmation. Other categories may have no catalogue example.','small'));
    planResult.append(card);
  }
  planResult.append(node('p',plan.note,'small'),node('p',plan.catalogue_note,'small'));
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
document.getElementById('purchase-planned').addEventListener('change',function() {
  const yes = this.value === 'yes';
  document.getElementById('purchase-field').hidden = !yes;
  document.getElementById('purchase-cost').required = yes;
});
document.getElementById('long-horizon').addEventListener('change',()=>{if(latestPlan) renderPlan(latestPlan);});
plannerForm.addEventListener('input',event=>{
  if (['long-horizon','planner-consent'].includes(event.target.id)) return;
  latestPlan = null;
  planResult.hidden = true;
  plannerStatus.textContent = '';
});
plannerForm.addEventListener('submit',async event => {
  event.preventDefault();
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
  latestPlan = null; planResult.hidden = true;
  try {
    const response = await fetch('/api/plan',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input),signal:AbortSignal.timeout(28000)});
    const data = await response.json();
    if (!response.ok || data.status !== 'ok') throw new Error(data.reason || data.error || 'The plan could not be generated.');
    latestPlan = data; renderPlan(data);
    plannerStatus.textContent = 'Your plan is ready. The three amounts add up to '+money(input.amount_to_save)+'.';
    await refreshStats();
  } catch (error) {
    plannerStatus.textContent = error.name === 'TimeoutError' ? 'The request took too long. It may still complete and use a try. Please wait before retrying.' : error.message;
  } finally { fields.forEach(field=>{field.disabled=false;}); button.disabled = false; button.textContent = 'Create my payday plan'; }
});
refreshStats();
