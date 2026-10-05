// Manually verified official scheme pages. No model-generated fund names.
// The 30-day review expiry is a pilot policy, not a live data feed.
export const CATALOGUE = [
  {name:'HDFC Liquid Fund',plan:'Direct Plan',type:'liquid fund',buckets:[0,1],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-liquid-fund/direct',caution:'Market-linked, with credit and interest-rate risk. Access is subject to redemption processing; keep immediate emergency cash accessible.'},
  {name:'HDFC Nifty 50 Index Fund',plan:'Direct Plan',type:'index fund',buckets:[2],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-nifty-50-index-fund/direct',caution:'Equity exposure can lose value. This prototype shows equity examples only for money you can leave invested for at least seven years.'},
  {name:'HDFC Large Cap Fund',plan:'Direct Plan',type:'large cap fund',buckets:[2],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-large-cap-fund/direct',caution:'Equity exposure can lose value. This prototype shows equity examples only for money you can leave invested for at least seven years.'},
  {name:'HDFC Flexi Cap Fund',plan:'Direct Plan',type:'flexi cap fund',buckets:[2],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-flexi-cap-fund/direct',caution:'Equity exposure across company sizes can lose value. This prototype shows equity examples only for money you can leave invested for at least seven years.'}
];
export function examplesFor(bucket, i, now = new Date(), catalogue = CATALOGUE) {
  if (bucket.amount === 0) return [];
  return catalogue.filter(f => {
    const age = now - new Date(f.checked+'T00:00:00Z');
    return age >= 0 && age <= 30*86400000 && f.buckets.includes(i) && bucket.options.includes(f.type);
  });
}
