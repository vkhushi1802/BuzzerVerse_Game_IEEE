import React, { useState, useEffect, useRef } from 'react';
import { syncEngine } from '../shared/syncEngine';
import { useSyncEngine } from '../hooks/useSyncEngine';
import WastedOverlay from '../components/WastedOverlay';

const UserPage = ({ userData }) => {
  const syncState = useSyncEngine();
  const [localStatus, setLocalStatus] = useState('lobby'); // lobby, countdown, buzzer, wait_results
  const [countdown, setCountdown] = useState(10);
  const [wasted, setWasted] = useState({ show: false, text: '' });

  const timerRef = useRef(null);

  const currentRoundIndex = syncState.currentRoundIndex;
  const currentRound = syncState.rounds[currentRoundIndex];
  const myBuzz = currentRound.clicks.find(c => c.sapId === userData.sapId);

  // Sync internal UI status with global engine state
  useEffect(() => {
    if (syncState.tournamentStatus === 'registration' || currentRound.status === 'pending') {
      setLocalStatus('lobby');
      if (timerRef.current) clearInterval(timerRef.current);
    }
    else if (currentRound.status === 'active' && localStatus === 'lobby') {
      // Start countdown
      setLocalStatus('countdown');
      setCountdown(10);
      timerRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setLocalStatus('buzzer');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    else if (currentRound.status === 'finished') {
      setLocalStatus('results');
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [syncState, currentRound.status]);

  const handleBuzz = () => {
    if (localStatus !== 'buzzer' || myBuzz) return;

    const success = syncEngine.userBuzz(userData.name, userData.sapId, currentRoundIndex);
    if (success) {
      const randomTexts = ['TAGGED', 'BUSTED', 'WASTED', 'SMASHED'];
      setWasted({
        show: true,
        text: randomTexts[Math.floor(Math.random() * randomTexts.length)]
      });
      setTimeout(() => setWasted(prev => ({ ...prev, show: false })), 2000);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleBuzz();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [localStatus, myBuzz, syncState.frozen]);

  return (
    <div className="arena-box" style={{ height: 'auto', minHeight: 'unset' }}>
      <WastedOverlay show={wasted.show} text={wasted.text} />

      <div style={{ padding: '0.5rem 0', marginBottom: '0.5rem' }}>
        <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>PARTICIPANT</p>
        <p style={{ fontWeight: 800, fontSize: '0.9rem', color: 'var(--gta-cyan)' }}>{userData.name}</p>
        <p style={{ fontSize: '0.6rem', opacity: 0.3 }}>{userData.sapId}</p>
      </div>

      <h2 className="title" style={{ fontSize: 'clamp(1.5rem, 5vh, 2.5rem)', margin: '0.5rem 0' }}>ROUND {currentRoundIndex + 1}</h2>

      {/* Main Game Stage - Dynamic but spacious */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', minHeight: '32vh', padding: '1rem 0' }}>
        {localStatus === 'lobby' && (
          <div style={{ animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
            <p className="subtitle" style={{ fontSize: '0.9rem' }}>Awaiting Host Signal...</p>
            <div className="loader" style={{ margin: '1rem auto' }}></div>
          </div>
        )}

        {localStatus === 'countdown' && (
          <div style={{ animation: 'pulse 1s infinite', textAlign: 'center' }}>
            <h3 style={{ fontFamily: 'Bangers', fontSize: '1.4rem', color: 'var(--success-green)', marginBottom: '0.8rem', letterSpacing: '1px' }}>PREPARE TO TAP</h3>
            <div style={{ fontSize: '7.5rem', fontFamily: 'Bangers', textShadow: 'var(--neon-cyan)', lineHeight: 0.75 }}>
              {countdown}
            </div>
          </div>
        )}

        {localStatus === 'buzzer' && (
          <div className="buzzer-container">
            <div
              className={`buzzer-btn ${myBuzz ? 'disabled' : ''}`}
              onClick={handleBuzz}
            >
              {myBuzz ? 'LOCKED' : 'TAP'}
            </div>
            <p className="subtitle" style={{ marginTop: '1.5rem', height: '1.2rem', fontSize: '0.85rem', opacity: 0.8 }}>
              {myBuzz
                ? `SUCCESS: Position Registered`
                : (window.innerWidth > 600 ? 'PRESS SPACE OR TAP' : 'TAP THE BUZZER!')}
            </p>
          </div>
        )}
      </div>

      <div className="log-card" style={{ marginTop: 'auto', padding: '0.75rem' }}>
        <h4 style={{ fontSize: '0.7rem', color: 'var(--gta-cyan)', marginBottom: '0.4rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>PERSONAL PERFORMANCE</h4>
        {syncState.rounds.map((r, i) => {
          const click = r.clicks.find(c => c.sapId === userData.sapId);
          return (
            <div key={i} className="log-item" style={{ padding: '8px 0', opacity: i === currentRoundIndex ? 1 : 0.35 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Round {i + 1}</span>
              <span style={{ textAlign: 'center', fontSize: '0.6rem', letterSpacing: '1px' }}>{r.status.toUpperCase()}</span>
              <span style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.8rem', color: click ? 'var(--success-green)' : 'inherit' }}>
                {click ? `${(click.msDelta / 1000).toFixed(3)}s` : (r.status === 'finished' ? '---' : '...')}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default UserPage;
