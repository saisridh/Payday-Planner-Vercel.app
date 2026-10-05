// Manually verified official scheme pages. No model-generated fund names.
// The 30-day review expiry is a pilot policy, not a live data feed.
export const CATALOGUE = [
  {name:'HDFC Liquid Fund',plan:'Direct Plan',type:'liquid fund',buckets:[0,1],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-liquid-fund/direct',caution:'Market-linked, with credit and interest-rate risk. Access is subject to redemption processing; keep immediate emergency cash accessible.'},
  {name:'HDFC Nifty 50 Index Fund',plan:'Direct Plan',type:'index fund',buckets:[2],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-nifty-50-index-fund/direct',caution:'Equity exposure can lose value. This prototype shows equity examples only for money you can leave invested for at least seven years.'},
  {name:'HDFC Large Cap Fund',plan:'Direct Plan',type:'large cap fund',buckets:[2],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-large-cap-fund/direct',caution:'Equity exposure can lose value. This prototype shows equity examples only for money you can leave invested for at least seven years.'},
  {name:'HDFC Flexi Cap Fund',plan:'Direct Plan',type:'flexi cap fund',buckets:[2],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-flexi-cap-fund/direct',caution:'Equity exposure across company sizes can lose value. This prototype shows equity examples only for money you can leave invested for at least seven years.'},
  {name:'SBI Liquid Fund',plan:'Direct Plan',type:'liquid fund',buckets:[0,1],checked:'2026-10-05',url:'https://www.sbimf.com/sbimf-scheme-details/sbi-liquid-fund-19',caution:'Market-linked, with credit and interest-rate risk. Access is subject to redemption processing; keep immediate emergency cash accessible. Select the Direct Plan on the provider page.'},
  {name:'SBI Nifty Index Fund',plan:'Direct Plan',type:'index fund',buckets:[2],checked:'2026-10-05',url:'https://www.sbimf.com/sbimf-scheme-details/sbi-nifty-index-fund-13',caution:'Equity exposure can lose value. Check overlap before considering another Nifty 50 fund. Select the Direct Plan on the provider page.'},
  {name:'SBI Large Cap Fund',plan:'Direct Plan',type:'large cap fund',buckets:[2],checked:'2026-10-05',url:'https://www.sbimf.com/sbimf-scheme-details/sbi-large-cap-fund-%28formerly-known-as-sbi-bluechip-fund%29-43',caution:'Equity exposure can lose value. Large-cap funds can overlap with index funds. Select the Direct Plan on the provider page.'},
  {name:'SBI Flexicap Fund',plan:'Direct Plan',type:'flexi cap fund',buckets:[2],checked:'2026-10-05',url:'https://www.sbimf.com/sbimf-scheme-details/sbi-flexicap-fund-39',caution:'Equity exposure across company sizes can lose value. Select the Direct Plan on the provider page.'},
  {name:'HDFC Gold ETF',plan:'Exchange-traded fund',type:'gold ETF',buckets:[2],checked:'2026-10-05',url:'https://www.hdfcfund.com/explore/mutual-funds/hdfc-gold-etf/regular',caution:'Commodity exposure through gold. Gold prices can fall; tracking differences, costs and exchange liquidity matter. A demat and trading account is normally needed.'},
  {name:'SBI Gold ETF',plan:'Exchange-traded fund',type:'gold ETF',buckets:[2],checked:'2026-10-05',url:'https://www.sbimf.com/sbimf-scheme-details/sbi-gold-etf-formerly-known-as-%28sbi-etf-gold%29-131',caution:'Commodity exposure through gold. Gold prices can fall; tracking differences, costs and exchange liquidity matter. A demat and trading account is normally needed.'},
  {name:'Embassy Office Parks REIT',plan:'Listed REIT',type:'REIT',buckets:[2],checked:'2026-10-05',url:'https://www.embassyofficeparks.com/investors/',caution:'Real estate exposure through commercial properties, without owning a flat. Unit prices and distributions can fall; occupancy, debt and interest rates matter. Check exchange liquidity and account requirements.'},
  {name:'Mindspace Business Parks REIT',plan:'Listed REIT',type:'REIT',buckets:[2],checked:'2026-10-05',url:'https://www.mindspacereit.com/investor-relations/overview',caution:'Real estate exposure through commercial properties, without owning a flat. Unit prices and distributions can fall; occupancy, debt and interest rates matter. Check exchange liquidity and account requirements.'}
];
export function examplesFor(bucket, i, now = new Date(), catalogue = CATALOGUE, riskComfort) {
  if (bucket.amount === 0) return [];
  return catalogue.filter(f => {
    const age = now - new Date(f.checked+'T00:00:00Z');
    const alternative = ['gold ETF','REIT'].includes(f.type);
    const eligible = alternative ? i === 2 && riskComfort === 'high' : bucket.options.includes(f.type);
    return age >= 0 && age <= 30*86400000 && f.buckets.includes(i) && eligible;
  }).map(f => ({...f,research_only:!bucket.options.includes(f.type)}));
}
