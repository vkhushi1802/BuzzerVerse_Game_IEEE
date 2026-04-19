import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = 'http://localhost:8000';
const WS_URL = 'ws://localhost:8000/ws';

// Medal helper
const medal = (pos) => {
  if (pos === 1) return '🥇';
  if (pos === 2) return '🥈';
  if (pos === 3) return '🥉';
  return `#${pos}`;
};

const AdminPage = ({ userData }) => {
  const token = userData?.token || '';
  const tokenRef = useRef(token); // stable ref so WS closure always has fresh token
  useEffect(() => { tokenRef.current = token; }, [token]);

  const [isActive, setIsActive]     = useState(false);
  const [round, setRound]           = useState(1);
  const [responses, setResponses]   = useState([]);
  const [status, setStatus]         = useState('');
  const [connected, setConnected]   = useState(false);
  const [history, setHistory]       = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [expandedRound, setExpandedRound] = useState(null); // accordion state

  const wsRef = useRef(null);

  // ─── Fetch history ───────────────────────────────────────────────────────────
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/history`, {
        headers: { 'Authorization': `Bearer ${tokenRef.current}` }
      });
      if (res.ok) {
        const data = await res.json();
        setHistory(data.history || []);
      }
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []); // stable — never re-created

  // ─── WebSocket ───────────────────────────────────────────────────────────────
  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'init':
          setIsActive(msg.is_active);
          setRound(msg.round);
          setResponses(msg.responses || []);
          break;

        case 'new_buzz':
          // Append without full re-render of existing items
          setResponses(prev => [...prev, msg.data]);
          break;

        case 'state':
          setIsActive(msg.is_active);
          break;

        case 'reset':
          // Instant UI update — no waiting
          setRound(msg.round);
          setResponses([]);
          setIsActive(false);
          // Small delay so the background DB write has time to persist
          // before we fetch the updated history (150ms is negligible to UX)
          setTimeout(fetchHistory, 150);
          break;

        default:
          break;
      }
    };

    ws.onclose = () => setConnected(false);
    ws.onerror = () => setConnected(false);

    return () => ws.close();
  }, [fetchHistory]);

  // ─── Load history on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ─── Admin API calls ─────────────────────────────────────────────────────────
  const adminFetch = async (endpoint) => {
    setStatus('...');
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const data = await res.json();
      if (!res.ok) {
        setStatus(`Error: ${data.detail || res.statusText}`);
      } else {
        setStatus(`OK: ${data.status}`);
        // Clear status message after 2s
        setTimeout(() => setStatus(''), 2000);
      }
    } catch (err) {
      setStatus(`Network error: ${err.message}`);
    }
  };

  // ─── Accordion toggle ────────────────────────────────────────────────────────
  const toggleRound = (roundNum) => {
    setExpandedRound(prev => prev === roundNum ? null : roundNum);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="admin-layout">

      {/* ── Main Panel ── */}
      <div className="arena-box admin-main">
        <h1 className="title" style={{ fontSize: 'clamp(1.3rem, 4vh, 2rem)', marginBottom: '0.75rem' }}>
          TOURNAMENT DASHBOARD
        </h1>

        {/* Status Bar */}
        <div className="admin-status-bar">
          <span className={connected ? 'status-dot online' : 'status-dot offline'}>
            {connected ? '● LIVE' : '○ OFFLINE'}
          </span>
          <span className="status-badge">ROUND {round}</span>
          <span className={`status-badge ${isActive ? 'active' : 'inactive'}`}>
            {isActive ? '🟢 BUZZER ON' : '🔴 BUZZER OFF'}
          </span>
        </div>

        {/* Admin Controls */}
        <div className="admin-controls">
          <button className="ctrl-btn ctrl-enable"  onClick={() => adminFetch('/admin/enable')}>▶ ENABLE</button>
          <button className="ctrl-btn ctrl-disable" onClick={() => adminFetch('/admin/disable')}>■ DISABLE</button>
          <button className="ctrl-btn ctrl-reset"   onClick={() => adminFetch('/admin/reset')}>↻ RESET</button>
        </div>

        {/* Status Feedback */}
        {status && (
          <p style={{ fontSize: '0.65rem', opacity: 0.4, marginBottom: '0.5rem', textAlign: 'center' }}>{status}</p>
        )}

        {/* Live Monitor */}
        <div className="live-monitor">
          <div className="monitor-header">
            <h3>LIVE MONITOR</h3>
            <span className="buzz-count">{responses.length} buzz{responses.length !== 1 ? 'es' : ''}</span>
          </div>

          <div className="log-card" style={{ flex: 1, overflowY: 'auto', margin: 0, background: 'transparent', maxHeight: '35vh' }}>
            <div className="log-item log-header">
              <span>#</span>
              <span>NAME</span>
              <span style={{ textAlign: 'right' }}>RANK</span>
            </div>

            {responses.length === 0 ? (
              <div className="empty-state">Awaiting signals...</div>
            ) : (
              responses.map((r, index) => (
                <div key={index} className={`log-item ${index < 3 ? 'top-entry' : ''}`}>
                  <span className={`rank-num ${index < 3 ? 'rank-top' : ''}`}>#{index + 1}</span>
                  <span style={{ fontSize: '0.85rem' }}>{r.name}</span>
                  <span style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: index === 0 ? 'var(--success-green)' : 'white' }}>
                    {medal(index + 1)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── History Side Panel ── */}
      <div className={`history-panel ${showHistory ? 'open' : ''}`}>
        <button className="history-toggle" onClick={() => setShowHistory(s => !s)}>
          {showHistory ? '✕' : '📋'} {showHistory ? 'CLOSE' : 'HISTORY'}
        </button>

        {showHistory && (
          <div className="history-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h3 className="history-title" style={{ margin: 0 }}>ROUND HISTORY</h3>
              <button
                onClick={fetchHistory}
                style={{
                  background: 'rgba(34,211,238,0.1)', border: '1px solid rgba(34,211,238,0.3)',
                  color: 'var(--gta-cyan)', borderRadius: '6px', padding: '0.2rem 0.5rem',
                  fontSize: '0.6rem', cursor: 'pointer', fontWeight: 700, letterSpacing: '0.5px'
                }}
              >
                ↺ REFRESH
              </button>
            </div>

            {history.length === 0 ? (
              <p className="empty-state" style={{ padding: '2rem 0' }}>No completed rounds yet</p>
            ) : (
              history.map((r) => {
                const isOpen = expandedRound === r.round;
                const winner = r.top_users?.[0];

                return (
                  <div key={r.round} className="history-card" style={{ flexDirection: 'column', alignItems: 'stretch', cursor: 'pointer', gap: 0, padding: 0, overflow: 'hidden' }}>
                    {/* Round header — click to expand */}
                    <div
                      onClick={() => toggleRound(r.round)}
                      style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.6rem' }}
                    >
                      <div className="history-round-badge">R{r.round}</div>
                      <div className="history-details">
                        <div className="history-winner">
                          🏆 {winner ? winner.name : 'No buzzes'}
                        </div>
                        <div className="history-meta">
                          {r.total_buzzes} buzz{r.total_buzzes !== 1 ? 'es' : ''}
                          {r.top_users?.length >= 2 && <span> · 2nd: {r.top_users[1].name}</span>}
                          {r.top_users?.length >= 3 && <span> · 3rd: {r.top_users[2].name}</span>}
                        </div>
                      </div>
                      <span style={{ fontSize: '0.65rem', opacity: 0.4, marginLeft: 'auto', paddingRight: '0.4rem' }}>
                        {isOpen ? '▲' : '▼'}
                      </span>
                    </div>

                    {/* Expanded top-10 leaderboard */}
                    {isOpen && (
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '0.5rem 0.6rem 0.6rem' }}>
                        {r.top_users?.length === 0 ? (
                          <p style={{ fontSize: '0.7rem', opacity: 0.3, textAlign: 'center', padding: '0.5rem 0' }}>No data</p>
                        ) : (
                          r.top_users.map((u) => (
                            <div
                              key={u.position}
                              style={{
                                display: 'grid',
                                gridTemplateColumns: '1.5rem 1fr auto',
                                gap: '0.5rem',
                                alignItems: 'center',
                                padding: '0.3rem 0.25rem',
                                borderBottom: '1px solid rgba(255,255,255,0.04)',
                                fontSize: '0.78rem'
                              }}
                            >
                              <span style={{
                                fontWeight: 800,
                                color: u.position <= 3 ? 'var(--gta-cyan)' : 'rgba(255,255,255,0.5)',
                                fontSize: '0.7rem'
                              }}>
                                {medal(u.position)}
                              </span>
                              <span style={{ color: u.position === 1 ? 'var(--success-green)' : 'white' }}>
                                {u.name}
                              </span>
                              <span style={{ fontSize: '0.6rem', opacity: 0.3, textAlign: 'right' }}>
                                #{u.position}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPage;
