import { createClient } from 'npm:@supabase/supabase-js@2';

const deno = (globalThis as typeof globalThis & {
  Deno: {
    env: { get(name: string): string | undefined };
    serve(handler: (request: Request) => Promise<Response>): void;
  };
}).Deno;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse(405, { error: 'Method not allowed' });

  const authorization = request.headers.get('Authorization');
  if (!authorization?.startsWith('Bearer ')) return jsonResponse(401, { error: 'Sign in as the Cubmaster to approve access.' });

  const supabaseUrl = deno.env.get('SUPABASE_URL');
  const anonKey = deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const siteUrl = deno.env.get('NEWSLETTER_SITE_URL');
  if (!supabaseUrl || !anonKey || !serviceRoleKey || !siteUrl) {
    return jsonResponse(500, { error: 'Newsletter invitation is not configured.' });
  }

  const accessToken = authorization.slice('Bearer '.length);
  const callerClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const { data: callerData, error: callerError } = await callerClient.auth.getUser(accessToken);
  if (callerError || !callerData.user) return jsonResponse(401, { error: 'Your sign-in has expired. Please sign in again.' });

  const { data: isCubmaster, error: roleError } = await callerClient.rpc('is_newsletter_cubmaster');
  if (roleError || isCubmaster !== true) return jsonResponse(403, { error: 'Only the Cubmaster can approve newsletter access.' });

  let email = '';
  try {
    const body = await request.json();
    email = String(body.email || '').trim().toLowerCase();
  } catch {
    return jsonResponse(400, { error: 'Provide a valid email address.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 320) {
    return jsonResponse(400, { error: 'Provide a valid email address.' });
  }

  const adminClient = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: usersData, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return jsonResponse(502, { error: 'Could not check whether this parent already has an account.' });

  let parentUser = usersData.users.find((user) => user.email?.toLowerCase() === email);
  let invitationSent = false;
  let deliveryError: string | null = null;

  if (!parentUser) {
    const { data, error } = await adminClient.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${siteUrl.replace(/\/$/, '')}/newsletters/`,
    });
    if (error || !data.user) return jsonResponse(502, { error: 'Supabase could not send the parent invitation.' });
    parentUser = data.user;
    invitationSent = true;
  }

  const { data: existingMembership, error: membershipLookupError } = await adminClient
    .from('newsletter_members')
    .select('role,status')
    .eq('user_id', parentUser.id)
    .maybeSingle();
  if (membershipLookupError) return jsonResponse(500, { error: 'Could not verify the account role.' });
  if (existingMembership?.role === 'cubmaster') {
    return jsonResponse(409, { error: 'The Cubmaster account cannot be added as a parent.' });
  }

  const { error: membershipError } = await adminClient.from('newsletter_members').upsert({
    user_id: parentUser.id,
    email,
    role: 'parent',
    status: 'active',
    approved_by: callerData.user.id,
    approved_at: new Date().toISOString(),
    revoked_by: null,
    revoked_at: null,
    updated_by: callerData.user.id,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (membershipError) return jsonResponse(500, { error: 'The invitation was sent, but newsletter access could not be recorded. Contact support before retrying.' });

  if (existingMembership?.status === 'active') {
    const { error: auditError } = await adminClient.from('newsletter_access_audit').insert({
      subject_user_id: parentUser.id,
      subject_email: email,
      action: 'approved',
      actor_user_id: callerData.user.id,
    });
    if (auditError) return jsonResponse(500, { error: 'Access was approved, but the audit record could not be written.' });
  }

  if (!invitationSent) {
    const deliveryClient = createClient(supabaseUrl, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { error } = await deliveryClient.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: false, emailRedirectTo: `${siteUrl.replace(/\/$/, '')}/newsletters/` },
    });
    if (error) deliveryError = 'Access was approved, but the sign-in email could not be sent. Ask the parent to request a sign-in link from the newsletter page.';
  }

  return jsonResponse(200, {
    approved: true,
    invitationSent,
    message: deliveryError || (invitationSent ? 'Parent approved and invitation sent.' : 'Parent access approved and a sign-in link sent.'),
  });
});