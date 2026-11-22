import { createClient } from 'npm:@supabase/supabase-js@2';

const feedUrl = 'https://api.scouting.org/advancements/events/calendar/46471';
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

function respond(body: string, status = 200, contentType = 'text/plain; charset=utf-8') {
  return new Response(body, { status, headers: { ...corsHeaders, 'Content-Type': contentType, 'Cache-Control': 'no-store' } });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return respond('Method not allowed', 405);

  const authorization = request.headers.get('Authorization');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!authorization || !supabaseUrl || !anonKey) return respond('Sign in with the Cubmaster account to load this calendar.', 401);

  const client = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: userData, error: userError } = await client.auth.getUser(token);
  if (userError || !userData.user) return respond('A valid Cubmaster session is required.', 401);
  const { data: isCubmaster, error: roleError } = await client.rpc('is_newsletter_cubmaster');
  if (roleError || isCubmaster !== true) return respond('Cubmaster authorization is required.', 403);

  try {
    const upstream = await fetch(feedUrl, { signal: AbortSignal.timeout(15000), headers: { Accept: 'text/calendar' } });
    if (!upstream.ok) return respond(`Calendar provider returned HTTP ${upstream.status}.`, 502);
    const body = await upstream.text();
    if (body.length > 2_000_000) return respond('Calendar response is too large to review.', 502);
    if (!body.includes('BEGIN:VCALENDAR')) return respond('Calendar provider did not return an ICS calendar.', 502);
    return respond(body);
  } catch {
    return respond('Could not reach the scouting.org calendar. Try again later.', 502);
  }
});
