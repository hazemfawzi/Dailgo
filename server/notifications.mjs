import webpush from 'web-push';
import nodemailer from 'nodemailer';
import { randomBytes, createHash } from 'node:crypto';
const hash = (value) => createHash('sha256').update(value).digest('hex');
const fail = (message, status = 400) => {
  throw Object.assign(Error(message), { status });
};
const emailValid = (value) =>
  typeof value === 'string' &&
  value.length <= 254 &&
  /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value);
export const validPushSubscription = (value) => {
  try {
    const url = new URL(value.endpoint);
    return (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      (!url.port || url.port === '443') &&
      [
        'fcm.googleapis.com',
        'updates.push.services.mozilla.com',
        'push.services.mozilla.com',
        'web.push.apple.com',
        'notify.windows.com',
      ].some((host) => url.hostname === host || url.hostname.endsWith('.' + host)) &&
      typeof value.keys?.p256dh === 'string' &&
      /^[\w-]{80,100}$/.test(value.keys.p256dh) &&
      typeof value.keys?.auth === 'string' &&
      /^[\w-]{20,30}$/.test(value.keys.auth)
    );
  } catch {
    return false;
  }
};
const defaults = {
  email: '',
  emailEnabled: false,
  pushEnabled: false,
  morning: false,
  evening: true,
  tasks: true,
  events: true,
  showDetails: false,
};
export function createNotifications(db, identities, options = {}) {
  const env = options.env ?? process.env;
  const pushReady = !!env.VAPID_PUBLIC_KEY && !!env.VAPID_PRIVATE_KEY && !!env.VAPID_SUBJECT;
  const mailReady = !!env.SMTP_HOST && !!env.SMTP_FROM && !!env.APP_ORIGIN;
  const sendPush =
    options.sendPush ??
    ((subscription, payload) =>
      webpush.sendNotification(subscription, JSON.stringify(payload), {
        vapidDetails: {
          subject: env.VAPID_SUBJECT,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
        },
        timeout: 15000,
      }));
  const transport = options.sendMail
    ? null
    : mailReady
      ? nodemailer.createTransport({
          host: env.SMTP_HOST,
          port: Number(env.SMTP_PORT ?? 587),
          secure: env.SMTP_SECURE === 'true',
          requireTLS: env.SMTP_SECURE !== 'true',
          auth: env.SMTP_USER ? { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } : undefined,
          connectionTimeout: 10000,
          greetingTimeout: 10000,
          socketTimeout: 15000,
        })
      : null;
  const sendMail =
    options.sendMail ?? ((message) => transport.sendMail({ from: env.SMTP_FROM, ...message }));
  db.exec(
    'CREATE TABLE IF NOT EXISTS notification_profiles(principal TEXT PRIMARY KEY,settings TEXT NOT NULL,verified TEXT); CREATE TABLE IF NOT EXISTS email_verifications(token TEXT PRIMARY KEY,principal TEXT NOT NULL,email TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS push_subscriptions(principal TEXT NOT NULL,endpoint TEXT NOT NULL,data TEXT NOT NULL,PRIMARY KEY(principal,endpoint)); CREATE TABLE IF NOT EXISTS notification_deliveries(id TEXT PRIMARY KEY,principal TEXT NOT NULL,state TEXT NOT NULL,attempts INTEGER NOT NULL,next INTEGER NOT NULL);',
  );
  function profile(principal) {
    const row = db.prepare('SELECT * FROM notification_profiles WHERE principal=?').get(principal);
    return {
      ...defaults,
      ...(row ? JSON.parse(row.settings) : {}),
      verified: !!row?.verified && row.verified === JSON.parse(row.settings).email,
    };
  }
  function status(principal) {
    return {
      settings: profile(principal),
      pushAvailable: pushReady,
      emailAvailable: mailReady,
      vapidPublicKey: pushReady ? env.VAPID_PUBLIC_KEY : null,
      subscriptions: db
        .prepare('SELECT count(*) AS n FROM push_subscriptions WHERE principal=?')
        .get(principal).n,
    };
  }
  function settings(principal, body) {
    const old = profile(principal);
    const next = { ...defaults, email: body.email ?? old.email };
    if (next.email && !emailValid(next.email)) fail('invalid-email');
    for (const key of [
      'emailEnabled',
      'pushEnabled',
      'morning',
      'evening',
      'tasks',
      'events',
      'showDetails',
    ]) {
      if (body[key] !== undefined && typeof body[key] !== 'boolean') fail('invalid-settings');
      next[key] = body[key] ?? old[key];
    }
    db.prepare(
      'INSERT INTO notification_profiles VALUES(?,?,?) ON CONFLICT(principal) DO UPDATE SET settings=excluded.settings,verified=excluded.verified',
    ).run(
      principal,
      JSON.stringify(next),
      old.verified && old.email === next.email ? next.email : null,
    );
    return status(principal);
  }
  async function requestVerification(principal) {
    if (!mailReady) fail('email-not-configured', 503);
    const prefs = profile(principal);
    if (!emailValid(prefs.email)) fail('email-required');
    if (
      db
        .prepare('SELECT 1 FROM email_verifications WHERE principal=? AND expires>?')
        .get(principal, Date.now() + 55 * 60000)
    )
      fail('wait-before-verifying', 429);
    const token = randomBytes(32).toString('base64url');
    db.prepare('DELETE FROM email_verifications WHERE principal=? OR expires<?').run(
      principal,
      Date.now(),
    );
    db.prepare('INSERT INTO email_verifications VALUES(?,?,?,?)').run(
      hash(token),
      principal,
      prefs.email,
      Date.now() + 3600000,
    );
    try {
      await sendMail({
        to: prefs.email,
        subject: 'Dailgo · تأكيد بريد التذكيرات',
        text:
          'طلبت ربط البريد بتذكيرات Dailgo. الرابط صالح لساعة واحدة:\n' +
          env.APP_ORIGIN +
          '/verify-email#' +
          token +
          '\nلو لم تطلب ذلك، تجاهل الرسالة.',
      });
    } catch {
      db.prepare('DELETE FROM email_verifications WHERE token=?').run(hash(token));
      fail('verification-email-failed', 502);
    }
    return { sent: true };
  }
  function verify(token) {
    if (typeof token !== 'string' || token.length !== 43) fail('verification-invalid');
    const row = db
      .prepare('SELECT * FROM email_verifications WHERE token=? AND expires>?')
      .get(hash(token), Date.now());
    if (!row || profile(row.principal).email !== row.email) fail('verification-invalid');
    db.prepare('UPDATE notification_profiles SET verified=? WHERE principal=?').run(
      row.email,
      row.principal,
    );
    db.prepare('DELETE FROM email_verifications WHERE principal=?').run(row.principal);
    return { verified: true };
  }
  function subscribe(principal, body) {
    if (!pushReady) fail('push-not-configured', 503);
    if (!validPushSubscription(body)) fail('invalid-subscription');
    if (
      db.prepare('SELECT count(*) AS n FROM push_subscriptions WHERE principal=?').get(principal)
        .n >= 10 &&
      !db
        .prepare('SELECT 1 FROM push_subscriptions WHERE principal=? AND endpoint=?')
        .get(principal, body.endpoint)
    )
      fail('subscription-limit');
    const safe = {
      endpoint: body.endpoint,
      keys: { p256dh: body.keys.p256dh, auth: body.keys.auth },
    };
    db.prepare(
      'INSERT INTO push_subscriptions VALUES(?,?,?) ON CONFLICT(principal,endpoint) DO UPDATE SET data=excluded.data',
    ).run(principal, body.endpoint, JSON.stringify(safe));
    return { subscribed: true };
  }
  function unsubscribe(principal, endpoint) {
    db.prepare('DELETE FROM push_subscriptions WHERE principal=? AND endpoint=?').run(
      principal,
      endpoint,
    );
    return { subscribed: false };
  }
  async function deliver(principal, payload, prefs = profile(principal), test = false) {
    let sent = 0;
    if (pushReady && (prefs.pushEnabled || test)) {
      for (const row of db
        .prepare('SELECT endpoint,data FROM push_subscriptions WHERE principal=?')
        .all(principal)) {
        try {
          await sendPush(JSON.parse(row.data), payload);
          sent++;
        } catch (error) {
          if ([404, 410].includes(error.statusCode))
            db.prepare('DELETE FROM push_subscriptions WHERE principal=? AND endpoint=?').run(
              principal,
              row.endpoint,
            );
          else throw Error('push-delivery-failed');
        }
      }
    }
    if (mailReady && (prefs.emailEnabled || test) && prefs.verified) {
      await sendMail({
        to: prefs.email,
        subject: payload.title,
        text: payload.body + '\n' + env.APP_ORIGIN + payload.path,
      });
      sent++;
    }
    return sent;
  }
  async function claimed(id, principal, now, fn) {
    const inserted = db
      .prepare("INSERT OR IGNORE INTO notification_deliveries VALUES(?,?,'pending',1,?)")
      .run(id, principal, now);
    if (!inserted.changes) {
      const retry = db
        .prepare(
          "UPDATE notification_deliveries SET state='pending',attempts=attempts+1 WHERE id=? AND state='failed' AND attempts<3 AND next<=? RETURNING id",
        )
        .get(id, now);
      if (!retry) return false;
    }
    try {
      await fn();
      db.prepare("UPDATE notification_deliveries SET state='done' WHERE id=?").run(id);
      return true;
    } catch {
      db.prepare("UPDATE notification_deliveries SET state='failed',next=? WHERE id=?").run(
        now + 5 * 60000,
        id,
      );
      return false;
    }
  }
  async function test(principal) {
    const id = 'test:' + principal + ':' + Math.floor(Date.now() / 60000);
    if (db.prepare('SELECT 1 FROM notification_deliveries WHERE id=?').get(id))
      fail('test-rate-limit', 429);
    const prefs = profile(principal);
    let sent = 0;
    const ok = await claimed(id, principal, Date.now(), async () => {
      sent = await deliver(
        principal,
        { title: 'Dailgo', body: 'تذكير تجريبي طلبته من إعداداتك.', path: '/' },
        prefs,
        true,
      );
      if (!sent) throw Error('no-verified-destination');
    });
    if (!ok) fail('no-destination-or-delivery-failed', 502);
    return { sent };
  }
  let ticking = false;
  async function tick(now = new Date()) {
    if (ticking || (!pushReady && !mailReady)) return;
    ticking = true;
    try {
      for (const row of db.prepare('SELECT principal FROM notification_profiles').all()) {
        const prefs = profile(row.principal);
        if (
          !(
            pushReady &&
            prefs.pushEnabled &&
            db
              .prepare('SELECT 1 FROM push_subscriptions WHERE principal=? LIMIT 1')
              .get(row.principal)
          ) &&
          !(mailReady && prefs.emailEnabled && prefs.verified)
        )
          continue;
        const data = identities.workspace(row.principal).data;
        const zone = data['personal-os.planning.v1']?.timezone ?? 'UTC';
        const parts = new Intl.DateTimeFormat('en-CA', {
          timeZone: zone,
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
          hourCycle: 'h23',
        }).formatToParts(now);
        const part = (name) => parts.find((x) => x.type === name)?.value;
        const day = part('year') + '-' + part('month') + '-' + part('day'),
          clock = part('hour') + ':' + part('minute');
        const journey = data['personal-os.journey.v1'] ?? {};
        const messages = [];
        if (prefs.morning && clock >= (journey.wakeTime ?? '07:00') && clock < '12:00')
          messages.push({
            key: 'morning',
            body: 'دقيقة لتخطيط يومك واختيار خطوات التركيز.',
            path: '/',
          });
        if (
          prefs.evening &&
          clock >= (journey.eveningTime ?? '20:00') &&
          journey.eveningReviewedOn !== day
        )
          messages.push({
            key: 'evening',
            body: 'دقيقتين لمراجعة يومك واختيار خطوة لبكرة.',
            path: '/#daily-review',
          });
        if (prefs.tasks)
          for (const task of (data['personal-os.tasks.v1'] ?? [])
            .filter(
              (x) =>
                !x.done &&
                !x.archived &&
                !['cancelled', 'waiting', 'blocked', 'deferred'].includes(x.status) &&
                ((x.plannedDate === day && clock >= (x.plannedTime ?? '09:00')) ||
                  (x.dueDate && x.dueDate <= day && clock >= '09:00')),
            )
            .slice(0, 10))
            messages.push({
              key: 'task:' + task.id,
              body: prefs.showDetails ? task.title : 'عندك مهمة مخططة أو مستحقة محتاجة مراجعة.',
              path: '/today',
            });
        if (prefs.events) {
          const raw = data['personal-os.entries.v1'];
          const entries = Array.isArray(raw) ? raw : (raw?.entries ?? []);
          const minutes = (value) => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
          for (const event of entries
            .filter(
              (x) =>
                x.kind === 'event' &&
                !x.archived &&
                x.date === day &&
                /^([01]\d|2[0-3]):[0-5]\d$/.test(x.time),
            )
            .filter((x) => {
              const time = x.durationMinutes === 1440 && x.time === '00:00' ? '09:00' : x.time;
              const delay = minutes(clock) - minutes(time);
              return delay >= 0 && delay <= 15;
            })
            .slice(0, 10))
            messages.push({
              key: 'event:' + event.id,
              body: prefs.showDetails ? event.title : 'عندك موعد مخطط الآن. راجع تقويمك.',
              path: '/planner?tab=calendar&date=' + day,
            });
        }
        for (const message of messages)
          await claimed(
            row.principal + ':' + day + ':' + message.key,
            row.principal,
            now.getTime(),
            () =>
              deliver(
                row.principal,
                { title: 'Dailgo', body: message.body, path: message.path },
                prefs,
              ),
          );
      }
      db.prepare('DELETE FROM notification_deliveries WHERE next<?').run(
        now.getTime() - 30 * 86400000,
      );
      db.prepare('DELETE FROM email_verifications WHERE expires<?').run(now.getTime());
    } finally {
      ticking = false;
    }
  }
  return {
    status,
    settings,
    requestVerification,
    verify,
    subscribe,
    unsubscribe,
    test,
    tick,
    close: () => transport?.close(),
  };
}
