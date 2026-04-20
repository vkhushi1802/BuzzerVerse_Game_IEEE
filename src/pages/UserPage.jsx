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
  
  const qIndex = currentRound.currentQuestionIndex;
  const currentQuestion = currentRound.questions?.[qIndex];
  
  const myParticipantState = syncState.participants[userData.sapId] || {};
  const myBuzz = currentQuestion?.clicks?.find(c => c.sapId === userData.sapId);

  // Master UI State Sync
  useEffect(() => {
    if (syncState.tournamentStatus === 'registration' || currentRound.status === 'pending') {
      setLocalStatus('lobby');
    } else if (currentQuestion?.status === 'finished') {
      setLocalStatus('results');
    }
  }, [syncState.tournamentStatus, currentRound.status, currentQuestion?.status]);

  // Handle new active questions
  useEffect(() => {
    if (currentRound.status === 'active' && currentQuestion?.status === 'active') {
      setLocalStatus('countdown');
    }
  }, [qIndex, currentRound.status, currentQuestion?.status]);

  // Handle the countdown timer separately
  useEffect(() => {
    if (localStatus === 'countdown') {
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

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [localStatus]);

  const handleBuzz = () => {
    if (localStatus !== 'buzzer' || myBuzz) return;

    const success = syncEngine.userBuzz(userData.sapId, currentRoundIndex);
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
  }, [localStatus, myBuzz]);

  return (
    <div className="arena-box" style={{ height: 'auto', minHeight: 'unset', marginTop: '4rem' }}>
      <WastedOverlay show={wasted.show} text={wasted.text} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '0.5rem 0', marginBottom: '0.5rem' }}>
        <div>
          <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>PARTICIPANT</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
             <span style={{ fontSize: '1.5rem' }}>{myParticipantState.profilePic}</span>
             <p style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--gta-cyan)' }}>{userData.name}</p>
          </div>
          <p style={{ fontSize: '0.6rem', opacity: 0.3 }}>{userData.sapId}</p>
        </div>
        
        <div style={{ textAlign: 'right' }}>
           <p style={{ fontSize: '0.6rem', opacity: 0.5 }}>BALANCE</p>
           <p style={{ fontWeight: 900, fontSize: '1.2rem', color: '#ffd700' }}>🪙 {myParticipantState.points || 0}</p>
        </div>
      </div>

      <h2 className="title" style={{ fontSize: 'clamp(1.5rem, 4vh, 2rem)', margin: '0.2rem 0', color: 'var(--gta-magenta)' }}>
         {currentRound.name.toUpperCase()}
      </h2>
      <p style={{ textAlign: 'center', fontSize: '0.8rem', opacity: 0.8, fontWeight: 700, letterSpacing: '2px', marginBottom: '1rem' }}>
         QUESTION {currentRound.questions?.length || 1}
      </p>

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

        {localStatus === 'results' && (
           <div style={{ animation: 'fadeIn 0.5s ease', textAlign: 'center' }}>
             <p className="subtitle" style={{ fontSize: '1.2rem', color: 'var(--success-green)' }}>ROUND PAUSED</p>
             <p style={{ opacity: 0.6, fontSize: '0.8rem', marginTop: '0.5rem' }}>Look at the main screen for results!</p>
           </div>
        )}
      </div>

      <div className="log-card" style={{ marginTop: 'auto', padding: '0.75rem' }}>
        <h4 style={{ fontSize: '0.7rem', color: 'var(--gta-cyan)', marginBottom: '0.4rem', fontWeight: 800, opacity: 0.6, letterSpacing: '1px' }}>CURRENT ROUND PERFORMANCE</h4>
        {currentRound.questions?.map((q, i) => {
          const click = q.clicks.find(c => c.sapId === userData.sapId);
          const evalRes = q.evaluations[userData.sapId];
          
          return (
            <div key={i} className="log-item" style={{ padding: '8px 0', opacity: i === qIndex ? 1 : 0.4 }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Q{i + 1}</span>
              <span style={{ textAlign: 'center', fontSize: '0.6rem', letterSpacing: '1px' }}>
                 {evalRes === true ? '✅' : evalRes === false ? '❌' : q.status.toUpperCase()}
              </span>
              <span style={{ textAlign: 'right', fontWeight: 800, fontSize: '0.8rem', color: click ? 'var(--success-green)' : 'inherit' }}>
                {click ? `+ ${(click.msDelta / 1000).toFixed(3)}s` : '---'}
              </span>
            </div>
          );
        }) || <div style={{ opacity: 0.5, fontSize: '0.7rem' }}>No data</div>}
      </div>
    </div>
  );
};

export default UserPage;
