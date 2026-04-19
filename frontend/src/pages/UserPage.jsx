import React, { useState, useEffect, useRef, useCallback } from 'react';
import WastedOverlay from '../components/WastedOverlay';

const WS_URL = 'ws://localhost:8000/ws';

const UserPage = ({ userData }) => {
  const [isActive, setIsActive] = useState(false);
  const [round, setRound] = useState(1);
  const [responses, setResponses] = useState([]);
  const [hasBuzzed, setHasBuzzed] = useState(false);
  const [wasted, setWasted] = useState({ show: false, text: '' });
  const [connected, setConnected] = useState(false);

  const wsRef = useRef(null);

  // Check if current user already buzzed this round
  const checkIfBuzzed = (responseList) => {
    return responseList.some(r => r.name === userData.name);
  };

  useEffect(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      switch (msg.type) {
        case 'init':
          setIsActive(msg.is_active);
          setRound(msg.round);
          setResponses(msg.responses || []);
          setHasBuzzed(checkIfBuzzed(msg.responses || []));
          break;

        case 'new_buzz':
          setResponses(prev => {
            const updated = [...prev, msg.data];
            // Check if the new buzz is ours
            if (msg.data.name === userData.name) {
              setHasBuzzed(true);
            }
            return updated;
          });
          break;

        case 'state':
          setIsActive(msg.is_active);
          break;

        case 'reset':
          // New round — clear buzz state so user can re-press
          setRound(msg.round);
          setResponses([]);
          setHasBuzzed(false);
          setIsActive(false); // buzzer disabled until admin enables
          break;

        default:
          break;
      }
    };

    ws.onclose = () => {
      setConnected(false);
    };

    ws.onerror = () => {
      setConnected(false);
    };

    // Keep connection alive — do NOT close on reset
    return () => {
      ws.close();
    };
  }, [userData.name]);

  const handleBuzz = useCallback(() => {
    if (!isActive || hasBuzzed || !wsRef.current) return;

    wsRef.current.send(JSON.stringify({
      type: 'buzz',
      name: userData.name
    }));

    // Wasted overlay effect
    const randomTexts = ['TAGGED', 'BUSTED', 'WASTED', 'SMASHED'];
    setWasted({
      show: true,
      text: randomTexts[Math.floor(Math.random() * randomTexts.length)]
    });
    setTimeout(() => setWasted(prev => ({ ...prev, show: false })), 2000);
  }, [isActive, hasBuzzed, userData.name]);

  // Spacebar support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        handleBuzz();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleBuzz]);

  return (
    <div className="arena-box user-arena">
      <WastedOverlay show={wasted.show} text={wasted.text} />

      {/* Player Info */}
      <div className="player-info">
        <span className="player-label">PARTICIPANT</span>
        <span className="player-name">{userData.name}</span>
        <span className="player-id">{userData.sapId}</span>
      </div>

      {/* Round + Connection */}
      <h2 className="title" style={{ fontSize: 'clamp(1.4rem, 5vh, 2.2rem)', margin: '0.3rem 0' }}>
        ROUND {round}
      </h2>
      <p className={`connection-status ${connected ? 'online' : 'offline'}`}>
        {connected ? '● CONNECTED' : '○ RECONNECTING...'}
      </p>

      {/* Main Buzzer Area */}
      <div className="buzzer-zone">
        {!isActive ? (
          <div className="waiting-state">
            <p className="subtitle">Awaiting Host Signal...</p>
            <div className="loader"></div>
          </div>
        ) : (
          <div className="buzzer-container">
            <div
              className={`buzzer-btn ${hasBuzzed ? 'disabled' : ''}`}
              onClick={handleBuzz}
              style={hasBuzzed ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {hasBuzzed ? 'LOCKED' : 'TAP'}
            </div>
            <p className="buzz-hint">
              {hasBuzzed
                ? '✓ Position Registered'
                : (window.innerWidth > 600 ? 'PRESS SPACE OR TAP' : 'TAP THE BUZZER!')}
            </p>
          </div>
        )}
      </div>

      {/* Responses Log — compact for mobile */}
      <div className="log-card user-log">
        <h4 className="log-title">BUZZ ORDER</h4>
        {responses.length === 0 ? (
          <div className="empty-state">No buzzes yet</div>
        ) : (
          responses.slice(0, 10).map((r, i) => (
            <div key={i} className={`log-item ${r.name === userData.name ? 'highlight-self' : ''}`}>
              <span className={`rank-num ${i === 0 ? 'rank-first' : ''}`}>
                #{i + 1}
              </span>
              <span>{r.name}</span>
              <span style={{ textAlign: 'right', fontSize: '0.75rem', opacity: 0.5 }}>
                {r.name === userData.name ? '★ YOU' : ''}
              </span>
            </div>
          ))
        )}
        {responses.length > 10 && (
          <p style={{ textAlign: 'center', fontSize: '0.65rem', opacity: 0.3, padding: '0.5rem' }}>
            +{responses.length - 10} more
          </p>
        )}
      </div>
    </div>
  );
};

export default UserPage;
