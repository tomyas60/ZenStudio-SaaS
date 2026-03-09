# ZenStudio SaaS — Setup Guide

## Overview
This is a full SaaS dashboard with:
- User signup/login (Supabase Auth)
- Per-user data storage (Supabase Database)
- Stripe subscription (£9.99/month, 14-day trial)
- Deployed on Netlify

---

## Step 1: Create Supabase Project

1. Go to https://supabase.com and sign up (free)
2. Click "New Project"
3. Name it "zenstudio", set a database password, click Create
4. Wait for it to set up (~2 minutes)
5. Go to **Settings → API** and copy:
   - `Project URL` → this is your SUPABASE_URL
   - `anon public` key → this is your SUPABASE_ANON_KEY
   - `service_role secret` key → this is your SUPABASE_SERVICE_ROLE_KEY

### Create Database Tables
Go to **SQL Editor** in Supabase and run this:

```sql
-- User data table
create table if not exists user_data (
  user_id uuid references auth.users(id) primary key,
  db jsonb default '{"products":[],"categories":[],"suppliers":[],"transactions":[],"sales":[]}',
  next_id jsonb default '{"product":1,"category":1,"supplier":1,"transaction":1,"sale":1}',
  updated_at timestamptz default now()
);

-- Subscriptions table
create table if not exists subscriptions (
  user_id uuid references auth.users(id) primary key,
  stripe_customer_id text,
  stripe_subscription_id text,
  status text default 'trialing',
  trial_end timestamptz,
  current_period_end timestamptz
);

-- Enable Row Level Security
alter table user_data enable row level security;
alter table subscriptions enable row level security;

-- Policies: users can only see their own data
create policy "user_data_policy" on user_data for all using (auth.uid() = user_id);
create policy "subscriptions_read" on subscriptions for select using (auth.uid() = user_id);
```

---

## Step 2: Set Up Stripe

1. Go to https://stripe.com (you already have an account)
2. Go to **Products** → **Add Product**
3. Name it "ZenStudio Monthly"
4. Set price: £9.99, recurring, monthly
5. Copy the **Price ID** (starts with `price_...`) → this is your STRIPE_PRICE_ID

### Stripe Webhook (set up AFTER deploying to Netlify)
1. Go to **Developers → Webhooks → Add endpoint**
2. URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
3. Select events: `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
4. Copy the **Signing secret** → this is your STRIPE_WEBHOOK_SECRET

---

## Step 3: Configure app.html

Open `app.html` and find these lines near the bottom of the script:

```javascript
var SUPABASE_URL = 'YOUR_SUPABASE_URL';
var SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
var STRIPE_PRICE_ID = 'YOUR_STRIPE_PRICE_ID';
```

Replace with your actual values from Steps 1 and 2.

---

## Step 4: Deploy to Netlify

1. Create a new GitHub repo (e.g. `zenstudio-saas`)
2. Upload all these files to the repo
3. Go to Netlify → Add new site → Import from Git
4. Select the repo, click Deploy

### Set Environment Variables in Netlify
Go to **Project configuration → Environment variables** and add:

| Key | Value |
|-----|-------|
| SUPABASE_URL | Your Supabase project URL |
| SUPABASE_SERVICE_ROLE_KEY | Your Supabase service role key |
| STRIPE_SECRET_KEY | Your Stripe secret key (sk_live_...) |
| STRIPE_PRICE_ID | Your Stripe price ID (price_...) |
| STRIPE_WEBHOOK_SECRET | Your Stripe webhook signing secret |
| APP_URL | Your Netlify site URL (e.g. https://zenstudio-hq.netlify.app) |

5. Trigger a redeploy after adding variables

---

## Step 5: Configure Supabase Auth

1. In Supabase go to **Authentication → URL Configuration**
2. Set **Site URL** to your Netlify URL
3. Add your Netlify URL to **Redirect URLs**

---

## Done!

Your SaaS is live. Customers can:
1. Visit your landing page
2. Click "Start Free Trial" → sign up
3. Confirm their email
4. Sign in → redirected to Stripe checkout
5. Start 14-day free trial
6. Access the dashboard

After trial ends, Stripe automatically charges £9.99/month.
If they cancel, the webhook marks their subscription as canceled and they lose access.
