import { useEffect, useState } from 'react';

type Health = { status: 'ok'; service: string };

export default function App() {
  const [health, setHealth] = useState<Health | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/health')
      .then(async (response) => {
        if (!response.ok) throw new Error(`服务器响应 ${response.status}`);
        return (await response.json()) as Health;
      })
      .then(setHealth)
      .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : '连接失败'));
  }, []);

  return (
    <main className="shell">
      <div className="table-mark" aria-hidden="true">
        <span />
      </div>
      <p className="eyebrow">TURN-BASED TABLE TENNIS STRATEGY</p>
      <h1>Paddle Tactics</h1>
      <p className="intro">用构筑与临场判断，打好每一分。</p>
      <section className="status" aria-live="polite">
        <span className={`dot ${health ? 'online' : ''}`} />
        {health ? `服务已连接 · ${health.service}` : error ? `服务未连接 · ${error}` : '正在连接服务…'}
      </section>
      <footer>工程骨架 · Phase 0</footer>
    </main>
  );
}
