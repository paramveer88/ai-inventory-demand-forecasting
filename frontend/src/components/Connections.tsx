import { useEffect, useState, useRef } from 'react';
import api from '../api';

type Status = {
  business: { name: string; timezone: string };
  ingestionState: string;
  unresolved: number;
  forecastReadiness: { state: string; reasons: string[] };
  connections: { id: string; adapter: string; collectionComplete: boolean; lastCollectedAt: string | null; lastError: string | null }[];
  products: { id: string; name: string; externalId: string; fulfilledUnits: number; stock: { quantity: number; quantityType: string; occurredAt: string } | null }[];
  inbox: { id: string; resource: string; externalId: string; status: string; error: string | null; attempts: number }[];
};
export default function Connections() {
  const session = useRef(0);
  const [draft, setDraft] = useState('');
  const [token, setToken] = useState('');
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!token) return;
    let active = true;
    const refresh = async () => {
      try {
        const result = await api.get<Status>('/integrations/status', { headers: { Authorization: `Bearer ${token}` } });
        if (active) { setStatus(result.data); setError(''); }
      } catch { if (active) { setStatus(null); setError('Unable to load this workspace. Check your access token and connection.'); } }
    };
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    return () => { active = false; clearInterval(timer); };
  }, [token]);
  const action = async (path: string) => {
    const generation = session.current;
    setBusy(true); setError('');
    try {
      await api.post(path, {}, { headers: { Authorization: `Bearer ${token}` } });
      const result = await api.get<Status>('/integrations/status', { headers: { Authorization: `Bearer ${token}` } });
      if (generation === session.current) setStatus(result.data);
    } catch { if (generation === session.current) setError('The action could not be completed. The reference connection may be disabled or unavailable.'); }
    finally { if (generation === session.current) setBusy(false); }
  };
  const panel = 'rounded-xl border p-5 space-y-3';
  return <div className="p-8 space-y-6" style={{ color: 'var(--text-primary)' }}>
    <div><h1 className="text-2xl font-bold">Connections</h1><p className="mt-2 text-sm">Automatic source synchronization and imported inventory.</p></div>
    <p className="rounded-lg border border-amber-500 p-3 text-sm">Reference integration · Synthetic data · Live business providers have not been validated.</p>
    {!token ? <form className={panel} onSubmit={e => { e.preventDefault(); setToken(draft.trim()); setDraft(''); }}>
      <label className="block" htmlFor="workspace-token">Workspace access token</label>
      <input id="workspace-token" type="password" autoComplete="off" required value={draft} onChange={e => setDraft(e.target.value)} className="w-full rounded border bg-transparent p-3" />
      <button className="rounded bg-amber-500 px-4 py-2 text-black">Open workspace</button>
      <p className="text-xs">Your token is kept in memory for this session.</p>
    </form> : <button onClick={() => { session.current++; setToken(''); setStatus(null); setError(''); setBusy(false); }} className="underline">Close workspace / change token</button>}
    {error && <p role="alert" className="rounded border border-red-500 p-3">{error}</p>}
    {token && !status && !error && <p role="status">Loading workspace…</p>}
    {status && <>
      <section className={panel}>
        <h2 className="font-bold">{status.business.name}</h2>
        <p>Business timezone: {status.business.timezone}</p>
        <p>Ingestion: {status.ingestionState} · Unresolved records: {status.unresolved}</p>
        <p>Forecasts: blocked — historical coverage is not yet established in this first integration slice.</p>
        {!status.connections.length && <button disabled={busy} onClick={() => void action('/integrations/connections')} className="rounded bg-amber-500 p-2 text-black">Connect reference source</button>}
        {status.connections.map(c => <div key={c.id} className="border-t pt-3">
          <p>{c.adapter} · {c.collectionComplete ? 'Collection complete' : 'Collection incomplete'}</p>
          <p>Last complete collection: {c.lastCollectedAt ? new Date(c.lastCollectedAt).toLocaleString() : 'Not yet collected'}</p>
          {c.lastError && <p role="alert">{c.lastError}</p>}
          <button disabled={busy} className="mt-2 underline" onClick={() => void action(`/integrations/connections/${c.id}/retry`)}>Retry eligible failed or unmapped records</button>
        </div>)}
      </section>
      <section className={panel}>
        <h2 className="font-bold">Imported products · Read only</h2>
        <p className="text-sm">Stock is reported by the source. Imported sales do not deduct it again.</p>
        {!status.products.length && <p>No imported products yet. Connected sources synchronize automatically while the worker is running.</p>}
        {status.products.map(p => <article key={p.id} className="border-t pt-3">
          <h3 className="font-semibold">{p.name}</h3><p className="text-sm">Source ID: {p.externalId}</p>
          <p>Recorded fulfilled units: {p.fulfilledUnits}</p>
          <p>Reported available stock: {p.stock?.quantity ?? 'Unknown'}</p>
          {p.stock && <p className="text-xs">Source stock timestamp: {new Date(p.stock.occurredAt).toLocaleString()}</p>}
          <p className="text-xs">Purchase suggestions unavailable: inbound supply and policy inputs are not established.</p>
        </article>)}
      </section>
      <section className={`${panel} overflow-x-auto`}>
        <h2 className="font-bold">Recent ingestion records</h2>
        <table className="w-full text-left text-sm"><thead><tr><th>Resource</th><th>Source ID</th><th>State</th><th>Attempts</th><th>Issue</th></tr></thead>
          <tbody>{status.inbox.map(r => <tr key={r.id} className="border-t"><td className="py-2">{r.resource}</td><td>{r.externalId}</td><td>{r.status}</td><td>{r.attempts}</td><td>{r.error ?? '—'}</td></tr>)}</tbody>
        </table>
      </section>
    </>}
  </div>;
}
