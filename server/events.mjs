export function createWorkspaceEvents(identities, session) {
  const clients = new Map();
  const stop = identities.onChange((principal, revision) => {
    for (const client of clients.get(principal) ?? [])
      client.res.write(
        'data: ' + JSON.stringify(typeof revision === 'string' ? { revision } : revision) + '\n\n',
      );
  });
  function open(req, res, principal, expected) {
    if (expected !== principal) {
      res.writeHead(401);
      res.end();
      return;
    }
    const group = clients.get(principal) ?? new Set();
    if (group.size >= 8) {
      res.writeHead(429);
      res.end();
      return;
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-store',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write(
      'data: ' + JSON.stringify({ revision: identities.workspace(principal).revision }) + '\n\n',
    );
    const client = { res };
    group.add(client);
    clients.set(principal, group);
    const timer = setInterval(() => {
      if (!session(req)) {
        res.write('event: session-expired\ndata: {}\n\n');
        res.end();
      } else res.write(': heartbeat\n\n');
    }, 15000);
    timer.unref();
    res.on('close', () => {
      clearInterval(timer);
      group.delete(client);
      if (!group.size) clients.delete(principal);
    });
  }
  function close() {
    stop();
    for (const group of clients.values()) for (const client of group) client.res.end();
    clients.clear();
  }
  return { open, close };
}
