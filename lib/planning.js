export const NAMES = ['Emergency buffer','Near-term goal','Long-term investing'];
export const NOTE = 'This is an illustration, not personal advice. Check product details before acting.';
export const OPTIONS = [
  ['savings account','fixed deposit','liquid fund'],
  ['recurring deposit','fixed deposit','liquid fund','short-duration debt fund'],
  ['index fund','large cap fund','flexi cap fund','PPF','gold ETF','REIT']
];
export function validateInput(x) {
  if (!x || typeof x !== 'object' || Array.isArray(x)) throw new Error('Please enter the fixed fields in the form.');
  const fields = ['take_home_pay','essentials_and_emis','amount_to_save','emergency_savings','purchase_planned','purchase_cost','risk_comfort'];
  if (Object.keys(x).some(k => !fields.includes(k))) throw new Error('Only the planner fields are accepted.');
  for (const k of ['take_home_pay','essentials_and_emis','amount_to_save']) {
    if (!Number.isSafeInteger(x[k]) || x[k] < 0 || x[k] > 10000000) throw new Error('Enter whole rupee amounts from 0 to 1 crore.');
  }
  if (x.take_home_pay === 0) throw new Error('Take-home pay must be greater than zero.');
  if (x.essentials_and_emis > x.take_home_pay || x.amount_to_save > x.take_home_pay - x.essentials_and_emis) throw new Error('Your saving amount must fit within pay minus essentials and EMIs.');
  if (!['none','under_3_months','3_months_or_more'].includes(x.emergency_savings) || !['yes','no'].includes(x.purchase_planned) || !['low','medium','high'].includes(x.risk_comfort)) throw new Error('Please choose a valid option in each dropdown.');
  if (x.purchase_planned === 'yes' && (!Number.isSafeInteger(x.purchase_cost) || x.purchase_cost < 1 || x.purchase_cost > 10000000)) throw new Error('Enter a purchase cost between 1 rupee and 1 crore.');
  if (x.purchase_planned === 'no' && x.purchase_cost != null && x.purchase_cost !== 0) throw new Error('Purchase cost must be zero when no purchase is planned.');
  return {...x, purchase_cost: x.purchase_planned === 'yes' ? x.purchase_cost : 0};
}
export function allocation(x) {
  const share = {none:0.5, under_3_months:0.3, '3_months_or_more':0}[x.emergency_savings];
  const buffer = Math.min(x.amount_to_save, Math.round(x.amount_to_save * share / 100) * 100);
  const available = x.amount_to_save - buffer;
  const goal = x.purchase_planned === 'yes' ? Math.min(available, Math.round(Math.min(x.purchase_cost / 12, available) / 100) * 100) : 0;
  return [buffer,goal,available-goal];
}
export function zeroReason(x, i) {
  if (i === 0) return x.emergency_savings === '3_months_or_more'
    ? 'You reported at least three months of emergency savings, so no buffer contribution is allocated.'
    : 'Your emergency contribution rounds to zero at this saving amount.';
  if (i === 1) return x.purchase_planned === 'no'
    ? 'You reported no purchase in the next twelve months, so this bucket is zero.'
    : 'No amount remains for the purchase, or its monthly contribution rounds to zero.';
  return x.amount_to_save === 0
    ? 'You chose to save zero this payday, so there is no long-term contribution.'
    : 'Your buffer and purchase contributions use the saving amount, leaving no long-term contribution.';
}
const unsafe = /\b(best|top|buy|sell|return\w*|yield\w*|guarantee\w*|tax\w*|legal|crypto\w*|derivative\w*|stock\w*|insurance|scheme|ticker|HDFC|UTI|SBI|ICICI|Nippon|Axis|Kotak|Motilal|Parag|Quant)\b|%|https?:\/\/|\d+(?:\.\d+)?\s*(?:percent|per cent)/i;
export function validateOutput(p, x) {
  const amounts = allocation(x);
  if (p?.status !== 'ok' || !Array.isArray(p.buckets) || p.buckets.length !== 3 || p.note !== NOTE || Object.keys(p).some(k => !['status','buckets','note'].includes(k))) throw new Error('Invalid plan format.');
  p.buckets.forEach((b,i) => {
    if (!b || Object.keys(b).some(k=>!['name','amount','reason','options'].includes(k)) || b.name !== NAMES[i] || b.amount !== amounts[i] || typeof b.reason !== 'string' || !b.reason.trim() || b.reason.length > 200 || b.reason.trim().split(/\s+/).length > 25 || unsafe.test(b.reason) || !Array.isArray(b.options) || new Set(b.options).size !== b.options.length || b.options.some(o => !OPTIONS[i].includes(o))) throw new Error('Plan failed validation.');
    if (b.amount === 0 ? b.options.length !== 0 : b.options.length < 2 || b.options.length > 3) throw new Error('Invalid product options.');
    if (i === 2 && b.amount > 0) {
      const equity = b.options.filter(o => ['index fund','large cap fund','flexi cap fund'].includes(o));
      if (x.risk_comfort === 'low' && (!b.options.includes('PPF') || equity.length > 1)) throw new Error('Invalid low-risk options.');
      if (x.risk_comfort === 'medium' && (!b.options.includes('PPF') || equity.length !== 1)) throw new Error('Invalid medium-risk options.');
    }
  });
  return p;
}
