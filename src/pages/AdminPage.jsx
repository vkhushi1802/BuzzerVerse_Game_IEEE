import React, { useState } from 'react';
import { syncEngine } from '../shared/syncEngine';
import { useSyncEngine } from '../hooks/useSyncEngine';

const AdminPage = () => {
  const syncState = useSyncEngine();
  const [viewRound, setViewRound] = useState(syncState.currentRoundIndex);

  const currentRound = syncState.rounds[syncState.currentRoundIndex];

  const handleStartRound = () => {
    syncEngine.adminStartRound(syncState.currentRoundIndex);
    setViewRound(syncState.currentRoundIndex);
  };

  const handleEndRound = () => {
    syncEngine.adminEndRound(syncState.currentRoundIndex);
    if (syncState.currentRoundIndex < 2) {
      // Logic to prepare for next round
      // advance to next round index in state
      let state = syncEngine.getState();
      state.currentRoundIndex += 1;
      syncEngine.saveState(state);
    } else {
      let state = syncEngine.getState();
      state.tournamentStatus = 'finished';
      syncEngine.saveState(state);
    }
  };

  const handleResetTournament = () => {
    if (window.confirm('Are you sure you want to reset the entire tournament?')) {
      syncEngine.adminResetTournament();
      setViewRound(0);
    }
  };

  const roundData = syncState.rounds[viewRound];
  const sortedClicks = [...roundData.clicks].sort((a, b) => a.msDelta - b.msDelta);

  return (
    <div className="arena-box" style={{ maxWidth: '850px', width: '95%', height: 'auto', maxHeight: '90vh' }}>
      <h1 className="title" style={{ fontSize: 'clamp(1.5rem, 5vh, 2.5rem)', marginBottom: '1rem' }}>TOURNAMENT DASHBOARD</h1>

      {/* Round Selection Tabs - Compact & Focused */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setViewRound(i)}
            style={{
              padding: '0.6rem',
              background: viewRound === i ? 'var(--gta-cyan)' : 'rgba(255,255,255,0.05)',
              color: viewRound === i ? 'black' : 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.8rem',
              flex: 1,
              transition: 'all 0.2s'
            }}
          >
            RD {i + 1}
          </button>
        ))}
      </div>

      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '20px', marginBottom: '1rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ color: 'var(--gta-magenta)', fontSize: '0.9rem', fontWeight: 800 }}>
            {viewRound === syncState.currentRoundIndex ? 'LIVE MONITOR' : `ROUND ${viewRound + 1} LOGS`}
          </h3>

          {viewRound === syncState.currentRoundIndex && currentRound.status !== 'finished' && (
            <button
              className="capsule-btn"
              onClick={currentRound.status === 'active' ? handleEndRound : handleStartRound}
              style={{
                margin: 0,
                padding: '0.5rem 1.2rem',
                fontSize: '0.8rem',
                width: 'auto',
                background: currentRound.status === 'active' ? 'var(--upes-accent)' : 'var(--success-green)',
                color: 'white'
              }}
            >
              {currentRound.status === 'active' ? 'END ROUND' : 'START ROUND'}
            </button>
          )}
        </div>

        <div className="log-card" style={{ flex: 1, overflowY: 'auto', margin: 0, background: 'transparent' }}>
          <div className="log-item" style={{ opacity: 0.5, fontSize: '0.65rem', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span>PARTICIPANT</span>
            <span style={{ textAlign: 'center' }}>ID</span>
            <span style={{ textAlign: 'right' }}>DELTA</span>
          </div>

          {sortedClicks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.3, fontSize: '0.9rem' }}>Awaiting signals...</div>
          ) : (
            sortedClicks.map((click, index) => (
              <div key={index} className="log-item" style={{
                background: index < 3 ? 'rgba(34, 211, 238, 0.05)' : 'transparent',
                borderLeft: index < 3 ? '3px solid var(--gta-cyan)' : 'none',
                padding: '10px 8px'
              }}>
                <div>
                  <span style={{ fontWeight: 800, color: index < 3 ? 'var(--gta-cyan)' : 'white', fontSize: '0.85rem' }}>#{index + 1} {click.name}</span>
                </div>
                <div style={{ textAlign: 'center', opacity: 0.5, fontSize: '0.75rem' }}>{click.sapId}</div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: index === 0 ? 'var(--success-green)' : 'white' }}>+{(click.msDelta / 1000).toFixed(3)}s</div>
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <button onClick={handleResetTournament} style={{ background: 'transparent', color: 'rgba(255,255,255,0.2)', border: 'none', fontSize: '0.6rem', cursor: 'pointer' }}>Reset Tournament</button>
        {syncState.tournamentStatus === 'finished' && <span style={{ color: 'var(--success-green)', fontWeight: 800, fontSize: '0.8rem' }}>COMPLETE</span>}
      </div>
    </div>
  );
};

export default AdminPage;
