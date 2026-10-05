# Payday Planner assignment feature

This package extends the existing landing page with a Gemini payday-plan form.
No keys are included. All three existing environment variable names are used.

## Before deployment

1. Run `setup-functions.sql` in the Supabase SQL Editor. The existing table is preserved.
2. Upload index.html, planner.js, package.json, vercel.json, and the api/ and lib/ directories to the existing repository, preserving their paths.
3. Deploy on Vercel with framework preset Other. No build command is required.
4. Vercel should already contain GEMINI_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY.

## Tests after deployment

- Typical: pay 50000, essentials 30000, save 10000, buffer none, purchase yes/cost 36000, risk medium. Expect 5000 / 3000 / 2000.
- Edge: buffer three months or more; purchase no. Expect 0 / 0 / 10000.
- Small saving: save 50; buffer under three months; purchase yes/cost 12000. Confirm no negative amount and sum exactly 50.
- Zero saving: save 0. All three buckets zero, no product options or examples.
- Unaffordable: pay 30000, essentials 28000, save 10000. The page blocks submission; the server refuses a direct invalid API request.
- Generate five requests in one browser. The sixth must return HTTP 429 without calling Gemini. Refusals and service failures consume a try after the request is reserved.
- Check the count and average against successful rows in Supabase. Errors and refusals are excluded from the displayed plan count.
- Confirm five or more real rows. Record screenshots with no secrets visible.
- Check an official source link in each visible named-fund example. Zero buckets have no examples. Low-risk/short-access inputs have no named equity examples.
- For concurrency, fire six requests carrying the same signed visitor cookie; at most five may reserve rows. The database serializes reservations.

## Implementation choices and limits

- Gemini model: gemini-3.5-flash-lite. maxOutputTokens: 600, minimal thinking. The cap provides space for JSON keys plus concise explanations; 300 may truncate the required JSON. Measure actual usage after deployment.
- The original tested prompt is included. A server arithmetic supplement specifies exact amounts, including clamping rounded values to available savings. Each explanation is requested at 15 words or fewer and validated at 25.
- A signed HttpOnly cookie identifies a browser visitor. Five lifetime tries per cookie; 100 total requests per UTC day. Clearing cookies or changing browsers can reset the visitor identity. This is a course-demo cap, not account-level abuse prevention.
- Requests are reserved atomically in Supabase before calling Gemini. There is no automatic model retry. A dropped process can leave a pending row, which still consumes a try and does not count as a completed plan.
- Server input checks enforce whole rupees between 0 and 1 crore, positive take-home pay, valid dropdowns and affordability.
- Invalid free-text values are recorded as `[invalid]`; extra fields are omitted from logs. These do not reach Gemini.
- Server output checks enforce exact bucket names/amounts, allow-listed options, zero-bucket rules and bounded explanations. A phrase filter rejects common prohibited claims and names, but cannot prove all semantic claims safe. The verified fund catalogue never uses model names.
- Before validation, zero-value buckets with correct names and checked zero amounts receive an input-based explanation and an empty options list. This handles the observed case where Gemini returned product options for zero allocations. Incorrect amounts and nonzero bucket options still fail validation. The original model response is retained with the displayed plan for audit. Form fields are locked during generation to keep the result tied to its submitted inputs.
- Fund catalogue: four HDFC Mutual Fund examples, official Direct Plan pages checked 5 October 2026. This is a limited sample, not a comparison or endorsement. Other providers are available. Entries expire after 30 days and require manual review. No prices, rankings, yields or returns are displayed in the tool.
- Equity examples are shown only for medium/high risk and confirmation that long-term money can remain invested for seven years. This is a conservative prototype display rule, not a suitability assessment. The core split remains the assignment's simplified rule.
- Submitted numbers are sent to Gemini and stored in Supabase. No names/emails are collected by the tool. The future subscription offer remains informational; there is no signup or payment form. All main calls to action lead to the working planner.
- `output_tokens` includes reported candidate and thinking tokens. Rows with no model call use zero; missing provider usage is null. For model-call averages, use successful/model-response rows with reported usage, not local-validation refusals.
- Raw model responses that fail checks are retained in error rows for review, never rendered in the browser. Errors returned to the browser do not include provider details or keys.
- A successful answer is returned only after the database update succeeds. Aggregate statistics are computed by SQL across all successful rows and expose no individual financial inputs.
- End-to-end Gemini/Supabase and latency checks require the live deployment; local tests use mocked service responses.

## Worksheet evidence query

Run this in SQL Editor after live testing (do not publish it as a browser endpoint):

```sql
select count(*) as measured_model_calls,
       round(avg(input_tokens),1) as avg_input_tokens,
       round(avg(output_tokens),1) as avg_output_tokens
from public.payday_plans
where input_tokens > 0 and output_tokens is not null;
```

Never put actual key values in this README, GitHub, screenshots or worksheet.

## One-plan trial and sign-up journey

Visitors get one successful public trial plan, with at most five submitted attempts to allow retries after failures. The API checks successful history; run the updated setup-functions.sql to enforce the one-plan gate and simultaneous-request guard atomically in Supabase. Existing successful rows count toward the trial.

The assignment now supports browser-bound registration with name/email, using a signed HttpOnly browser cookie. Registration persists in payday_registrations, separate from planning data. Email is not verified and this is not cross-device authentication. It cannot be treated as a production identity or paid entitlement. No payment details are accepted. Users get six calendar months without payment setup, counted from the database registration timestamp. Access pauses after six months because checkout is not connected. The free year still runs from registration, and ₹999/year thereafter is a future offer; no charging, payment reminders or cancellation system is live.

Plan validation errors expose a static failing-check explanation and code, without rendering raw model text. Errors do not consume the successful trial, but do consume an attempt. SQL deployment is required for atomic enforcement under concurrent requests.

## Registration database update

Run the new complete setup-functions.sql before using this version. It creates a separate service-role-only RLS table and atomically enforces one successful anonymous trial, five anonymous attempts, five daily registered requests and 100 daily shared requests. Earlier anonymous requests do not consume the new registered allowance; only requests since registration count. Dates use PostgreSQL calendar intervals of six months and one year, not approximate day counts. Re-registering the same signed browser never resets its original timestamp. Names/emails never enter Gemini, payday_plans, aggregate statistics or returned access payloads. Registrations are capped at 100/day.

Deleting cookies changes browser identity. There is no verified email ownership or cross-device login; both require a later authentication flow. This implementation is appropriate only for the assignment demonstration. The six-month gate does not pretend to accept card details or collect payments.
