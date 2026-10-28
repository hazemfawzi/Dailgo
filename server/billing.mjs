import { createHmac, timingSafeEqual } from 'node:crypto';
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
export function createBilling(db, options = {}) {
  const env = options.env ?? process.env;
  const fetchImpl = options.fetch ?? fetch;
  const enabled =
    env.BILLING_ENABLED === 'true' &&
    !!env.STRIPE_SECRET_KEY &&
    !!env.STRIPE_PRICE_ID &&
    !!env.STRIPE_WEBHOOK_SECRET &&
    !!env.APP_ORIGIN;
  db.exec(
    'CREATE TABLE IF NOT EXISTS billing_customers(principal TEXT PRIMARY KEY,customer TEXT NOT NULL UNIQUE); CREATE TABLE IF NOT EXISTS billing_subscriptions(principal TEXT PRIMARY KEY,subscription TEXT NOT NULL,status TEXT NOT NULL,until INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS billing_events(id TEXT PRIMARY KEY,created INTEGER NOT NULL);',
  );
  async function stripe(path, method = 'GET', body, key) {
    const response = await fetchImpl('https://api.stripe.com/v1/' + path, {
      method,
      headers: {
        authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
        ...(body ? { 'content-type': 'application/x-www-form-urlencoded' } : {}),
        ...(key ? { 'Idempotency-Key': key } : {}),
      },
      body: body ? new URLSearchParams(body).toString() : undefined,
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) fail('billing-provider-unavailable', 502);
    return response.json();
  }
  function isPro(principal) {
    const row = db
      .prepare('SELECT status,until FROM billing_subscriptions WHERE principal=?')
      .get(principal);
    return !!row && ['active', 'trialing'].includes(row.status) && row.until > Date.now();
  }
  async function status(principal) {
    let price = null;
    if (enabled) {
      try {
        const value = await stripe('prices/' + encodeURIComponent(env.STRIPE_PRICE_ID));
        if (
          value.active &&
          value.recurring &&
          Number.isInteger(value.unit_amount) &&
          value.unit_amount >= 0
        )
          price = {
            currency: value.currency,
            amount: value.unit_amount,
            interval: value.recurring.interval,
          };
      } catch {}
    }
    return {
      enabled,
      pro: isPro(principal),
      canManage: !!db.prepare('SELECT 1 FROM billing_customers WHERE principal=?').get(principal),
      price,
      features: ['Claude usage allowance', 'Goal sharing', 'Advanced insights'],
      betaAccess: !enabled,
    };
  }
  async function customer(principal) {
    let row = db.prepare('SELECT customer FROM billing_customers WHERE principal=?').get(principal);
    if (row) return row.customer;
    const created = await stripe(
      'customers',
      'POST',
      { 'metadata[dailgo_principal]': principal },
      'dailgo-customer-' + principal,
    );
    db.prepare('INSERT INTO billing_customers VALUES(?,?) ON CONFLICT(principal) DO NOTHING').run(
      principal,
      created.id,
    );
    return db.prepare('SELECT customer FROM billing_customers WHERE principal=?').get(principal)
      .customer;
  }
  async function checkout(principal) {
    if (!enabled) fail('billing-not-configured', 503);
    const value = await stripe(
      'checkout/sessions',
      'POST',
      {
        customer: await customer(principal),
        mode: 'subscription',
        client_reference_id: principal,
        'line_items[0][price]': env.STRIPE_PRICE_ID,
        'line_items[0][quantity]': '1',
        success_url: env.APP_ORIGIN + '/tools?tab=pro&checkout=success',
        cancel_url: env.APP_ORIGIN + '/tools?tab=pro&checkout=cancelled',
        'subscription_data[metadata][dailgo_principal]': principal,
      },
      'dailgo-checkout-' + principal + '-' + Math.floor(Date.now() / 600000),
    );
    if (typeof value.url !== 'string' || !value.url.startsWith('https://checkout.stripe.com/'))
      fail('invalid-checkout', 502);
    return { url: value.url };
  }
  async function portal(principal) {
    if (!enabled) fail('billing-not-configured', 503);
    const row = db
      .prepare('SELECT customer FROM billing_customers WHERE principal=?')
      .get(principal);
    if (!row) fail('no-billing-account', 404);
    const value = await stripe('billing_portal/sessions', 'POST', {
      customer: row.customer,
      return_url: env.APP_ORIGIN + '/tools?tab=pro',
    });
    if (typeof value.url !== 'string' || !value.url.startsWith('https://billing.stripe.com/'))
      fail('invalid-portal', 502);
    return { url: value.url };
  }
  async function webhook(raw, signature) {
    if (!enabled) fail('billing-not-configured', 503);
    if (typeof signature !== 'string') fail('invalid-signature', 400);
    const parts = signature.split(',').map((x) => x.split('='));
    const stamp = parts.find((x) => x[0] === 't')?.[1];
    const signatures = parts.filter((x) => x[0] === 'v1').map((x) => x[1]);
    if (!stamp || !/^\d+$/.test(stamp) || Math.abs(Date.now() / 1000 - Number(stamp)) > 300)
      fail('invalid-signature');
    const expected = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET)
      .update(stamp + '.')
      .update(raw)
      .digest('hex');
    if (
      !signatures.some(
        (value) =>
          /^[a-f0-9]{64}$/.test(value) &&
          timingSafeEqual(Buffer.from(value), Buffer.from(expected)),
      )
    )
      fail('invalid-signature');
    let event;
    try {
      event = JSON.parse(raw.toString());
    } catch {
      fail('invalid-event');
    }
    if (typeof event.id !== 'string' || !event.data?.object) fail('invalid-event');
    if (db.prepare('SELECT 1 FROM billing_events WHERE id=?').get(event.id))
      return { received: true };
    const object = event.data.object;
    if (
      [
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
      ].includes(event.type)
    ) {
      const row = db
        .prepare('SELECT principal FROM billing_customers WHERE customer=?')
        .get(object.customer);
      if (!row) fail('unknown-customer');
      // Fetch current Stripe state: delayed or reordered events cannot reactivate an expired plan.
      const subscription = await stripe('subscriptions/' + encodeURIComponent(object.id));
      const matches = subscription.items?.data?.some(
        (item) => item.price?.id === env.STRIPE_PRICE_ID,
      );
      const until =
        (subscription.current_period_end ??
          Math.max(
            0,
            ...(subscription.items?.data ?? []).map((item) => item.current_period_end ?? 0),
          )) * 1000;
      const state = matches ? subscription.status : 'inactive';
      db.prepare(
        'INSERT INTO billing_subscriptions VALUES(?,?,?,?) ON CONFLICT(principal) DO UPDATE SET subscription=excluded.subscription,status=excluded.status,until=excluded.until',
      ).run(row.principal, subscription.id, state, until);
    }
    db.prepare('INSERT INTO billing_events VALUES(?,?)').run(event.id, Date.now());
    return { received: true };
  }
  return { enabled, isPro, status, checkout, portal, webhook };
}
