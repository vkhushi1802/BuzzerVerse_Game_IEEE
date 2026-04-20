import React, { useState } from 'react';
import { useSyncEngine } from '../hooks/useSyncEngine';

const LeaderboardPage = () => {
  const syncState = useSyncEngine();
  const [viewRound, setViewRound] = useState(0);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');

  const roundData = syncState.rounds[viewRound];
  const questions = roundData?.questions || [];
  const latestQuestion = questions[questions.length - 1] || { clicks: [] };

  // Calculate ranks based on total points
  const participantsList = Object.keys(syncState.participants).map(sapId => {
    const p = syncState.participants[sapId];

    // Find buzz time for latest question in this round
    const buzz = latestQuestion.clicks.find(c => c.sapId === sapId);
    const msDelta = buzz ? buzz.msDelta : Infinity;

    return {
      sapId,
      ...p,
      msDelta
    };
  });

  // Sort by points descending, then by buzz time ascending
  participantsList.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.msDelta - b.msDelta;
  });

  if (!isAuthenticated) {
    return (
      <div className="arena-box" style={{ maxWidth: '400px', width: '95%', padding: '2rem', marginTop: '10vh' }}>
        <h2 className="title" style={{ fontSize: '2rem', textShadow: 'var(--neon-cyan)', marginBottom: '1.5rem' }}>RESTRICTED ACCESS</h2>
        <form onSubmit={(e) => { e.preventDefault(); if (password === 'ieee2025') setIsAuthenticated(true); else alert('Incorrect Password'); }}>
          <input
            type="password"
            className="input-field"
            placeholder="Enter Admin Password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            style={{ width: '100%', marginBottom: '1rem', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.05)', color: 'white' }}
          />
          <button type="submit" className="capsule-btn" style={{ width: '100%' }}>UNLOCK LEADERBOARD</button>
        </form>
      </div>
    );
  }

  return (
    <div className="arena-box" style={{ maxWidth: '850px', width: '95%', height: 'auto', maxHeight: '100%', flex: 1, padding: '1.5rem', marginTop: '3rem', display: 'flex', flexDirection: 'column' }}>
      <h1 className="title" style={{ fontSize: 'clamp(2rem, 5vh, 3rem)', textShadow: 'var(--neon-magenta)', marginBottom: '1rem', flexShrink: 0 }}>
        GLOBAL STANDINGS
      </h1>

      {/* Navbar for Rounds */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginBottom: '1.5rem', justifyContent: 'center', flexShrink: 0 }}>
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setViewRound(i)}
            style={{
              padding: '0.6rem 1.5rem',
              background: viewRound === i ? 'var(--gta-magenta)' : 'transparent',
              color: viewRound === i ? 'white' : 'var(--gta-cyan)',
              border: `2px solid ${viewRound === i ? 'var(--gta-magenta)' : 'rgba(34, 211, 238, 0.3)'}`,
              borderRadius: '20px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '1rem',
              transition: 'all 0.3s'
            }}
          >
            {syncState.rounds[i].name.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '20px', marginBottom: '1rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="log-card" style={{ flex: 1, overflowY: 'auto', margin: 0, background: 'transparent' }}>
          <div className="log-item" style={{ 
            display: 'grid', 
            gridTemplateColumns: syncState.showPointsOnLeaderboard ? '50px 60px 1fr 100px 80px' : '50px 60px 1fr 100px', 
            gap: '10px', 
            paddingBottom: '0.8rem', 
            borderBottom: '1px solid rgba(255,255,255,0.1)', 
            opacity: 0.5, 
            fontSize: '0.65rem', 
            fontWeight: 800 
          }}>
            <div style={{ textAlign: 'center' }}>RANK</div>
            <div style={{ textAlign: 'center' }}>PROFILE</div>
            <div>PARTICIPANT</div>
            <div style={{ textAlign: 'right' }}>SPEED</div>
            {syncState.showPointsOnLeaderboard && (
              <div style={{ textAlign: 'right', color: '#ffd700' }}>POINTS</div>
            )}
          </div>

          {participantsList.length === 0 ? (
            <div style={{ padding: '3rem', textAlign: 'center', opacity: 0.5 }}>NO PARTICIPANTS YET</div>
          ) : (
            participantsList.map((p, index) => (
              <div key={p.sapId} className="log-item" style={{
                display: 'grid',
                gridTemplateColumns: syncState.showPointsOnLeaderboard ? '50px 60px 1fr 100px 80px' : '50px 60px 1fr 100px',
                gap: '10px',
                alignItems: 'center',
                padding: '10px 8px',
                borderBottom: '1px solid rgba(255,255,255,0.05)',
                background: index === 0 ? 'linear-gradient(90deg, rgba(255,215,0,0.1) 0%, transparent 100%)' : 'rgba(255,255,255,0.02)',
                borderLeft: index === 0 ? '3px solid #ffd700' : (index === 1 ? '3px solid #c0c0c0' : (index === 2 ? '3px solid #cd7f32' : '3px solid transparent'))
              }}>
                <div style={{ textAlign: 'center', fontWeight: 800, color: index === 0 ? '#ffd700' : (index === 1 ? '#c0c0c0' : (index === 2 ? '#cd7f32' : 'white')), fontSize: '1.2rem', opacity: 0.8 }}>
                  #{index + 1}
                </div>
                <div style={{ textAlign: 'center', fontSize: '1.8rem' }}>
                  {p.profilePic}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontWeight: 800, color: index === 0 ? '#ffd700' : 'white', fontSize: '0.9rem' }}>{p.name}</span>
                  <span style={{ fontSize: '0.6rem', opacity: 0.4 }}>{p.sapId}</span>
                </div>
                <div style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: p.msDelta !== Infinity ? 'var(--success-green)' : 'rgba(255,255,255,0.2)', fontSize: '0.85rem' }}>
                  {p.msDelta !== Infinity ? `+${(p.msDelta / 1000).toFixed(3)}s` : '---'}
                </div>
                {syncState.showPointsOnLeaderboard && (
                  <div style={{ textAlign: 'right', fontWeight: 900, fontSize: '1.1rem', color: '#ffd700' }}>
                    {p.points}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div style={{ textAlign: 'center', marginTop: '1rem', opacity: 0.5, fontSize: '0.8rem', flexShrink: 0 }}>
        Question {questions.length} / Status: {roundData.status.toUpperCase()}
      </div>
    </div>
  );
};

export default LeaderboardPage;
