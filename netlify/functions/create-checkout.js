const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 200, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: '' };

  try {
    if (!process.env.STRIPE_SECRET_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing STRIPE_SECRET_KEY' }) };
    if (!process.env.SUPABASE_URL) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing SUPABASE_URL' }) };
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' }) };
    if (!process.env.STRIPE_PRICE_ID) return { statusCode: 500, headers, body: JSON.stringify({ error: 'Missing STRIPE_PRICE_ID' }) };

    const token = event.headers.authorization?.replace('Bearer ', '');
    if (!token) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No token provided' }) };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError) return { statusCode: 401, headers, body: JSON.stringify({ error: 'Auth error: ' + authError.message }) };
    if (!user) return { statusCode: 401, headers, body: JSON.stringify({ error: 'No user found' }) };

    let { data: subs } = await supabase.from('subscriptions').select('stripe_customer_id').eq('user_id', user.id).limit(1);
    let customerId = subs && subs.length > 0 ? subs[0].stripe_customer_id : null;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id }
      });
      customerId = customer.id;
    }

    const appUrl = process.env.APP_URL || 'https://zenstudiosaa.netlify.app';

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      line_items: [{ price: process.env.STRIPE_PRICE_ID, quantity: 1 }],
      mode: 'subscription',
      subscription_data: { trial_period_days: 14 },
      success_url: appUrl + '/app.html?checkout=success',
      cancel_url: appUrl + '/app.html',
      allow_promotion_codes: true
    });

    return { statusCode: 200, headers, body: JSON.stringify({ url: session.url }) };

  } catch (err) {
    console.error('create-checkout error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
