export async function db(path, options = {}) {
  const response = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...options,
    headers: {apikey:process.env.SUPABASE_SERVICE_KEY,'Content-Type':'application/json',...options.headers},
    signal:AbortSignal.timeout(5000)
  });
  if (!response.ok) throw new Error('Database request failed.');
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}
export function configured() {
  return ['GEMINI_API_KEY','SUPABASE_URL','SUPABASE_SERVICE_KEY'].every(k=>Boolean(process.env[k]));
}
