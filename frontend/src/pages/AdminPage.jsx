import React, { useState } from 'react';
import { syncEngine } from '../shared/syncEngine';
import { useSyncEngine } from '../hooks/useSyncEngine';

const AdminPage = () => {
  const syncState = useSyncEngine();
  const [viewRound, setViewRound] = useState(syncState.currentRoundIndex);

  const roundData = syncState.rounds[viewRound];
  const qIndex = roundData.currentQuestionIndex;
  const currentQuestion = roundData.questions?.[qIndex] || { clicks: [], evaluations: {}, status: 'pending' };

  const handleStartRound = () => {
    if (window.confirm(`Start Round ${viewRound + 1}: ${roundData.name}?`)) {
      syncEngine.adminStartRound(viewRound);
    }
  };

  const handleNextQuestion = () => {
    syncEngine.adminNextQuestion(viewRound);
  };

  const handleEndRound = () => {
    syncEngine.adminConcludeRound(viewRound);
  };

  const handleResetTournament = () => {
    if (window.confirm('Are you sure you want to reset the entire tournament?')) {
      syncEngine.adminResetTournament();
      setViewRound(0);
    }
  };

  const handleTogglePoints = () => {
    syncEngine.toggleLeaderboardPoints();
  };

  const sortedClicks = [...currentQuestion.clicks].sort((a, b) => a.msDelta - b.msDelta);

  return (
    <div className="arena-box" style={{ maxWidth: '850px', width: '95%', height: 'auto', maxHeight: '90vh', marginRight: '1rem', marginTop: '3rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <h1 className="title" style={{ fontSize: 'clamp(1.5rem, 4vh, 2rem)', margin: 0 }}>ADMIN CONTROL</h1>
        <button 
          onClick={handleTogglePoints} 
          className="capsule-btn" 
          style={{ padding: '0.4rem 0.8rem', margin: 0, fontSize: '0.7rem', background: syncState.showPointsOnLeaderboard ? 'var(--success-green)' : 'rgba(255,255,255,0.1)', color: 'white', width: 'auto' }}
        >
          {syncState.showPointsOnLeaderboard ? 'POINTS: VISIBLE' : 'POINTS: HIDDEN'}
        </button>
      </div>

      {/* Round Selection Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginBottom: '1rem' }}>
        {[0, 1, 2].map(i => (
          <button
            key={i}
            onClick={() => setViewRound(i)}
            style={{
              padding: '0.6rem',
              background: viewRound === i ? 'var(--gta-magenta)' : 'rgba(255,255,255,0.05)',
              color: 'white',
              border: 'none',
              borderRadius: '12px',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.8rem',
              flex: 1,
              transition: 'all 0.2s'
            }}
          >
            {syncState.rounds[i].name} (RD{i+1})
          </button>
        ))}
      </div>

      <div style={{ background: 'rgba(0,0,0,0.25)', padding: '1.25rem', borderRadius: '20px', marginBottom: '1rem', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ color: 'var(--gta-cyan)', fontSize: '1rem', fontWeight: 900 }}>
            {roundData.name.toUpperCase()} - Q{qIndex + 1} ({currentQuestion.status.toUpperCase()})
          </h3>

          <div style={{ display: 'flex', gap: '10px' }}>
            {roundData.status === 'pending' && (
              <button className="capsule-btn" onClick={handleStartRound} style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.75rem', background: 'var(--success-green)', color: 'white', width: 'auto' }}>
                START ROUND
              </button>
            )}
            
            {roundData.status === 'active' && currentQuestion.status === 'active' && (
              <button className="capsule-btn" onClick={handleNextQuestion} style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.75rem', background: 'var(--gta-cyan)', color: 'black', width: 'auto' }}>
                NEXT Q ({roundData.questions.length + 1})
              </button>
            )}

            {roundData.status === 'active' && (
               <button className="capsule-btn" onClick={handleEndRound} style={{ margin: 0, padding: '0.5rem 1rem', fontSize: '0.75rem', background: 'var(--ieee-blue)', color: 'white', width: 'auto' }}>
                 CONCLUDE ROUND
               </button>
            )}
          </div>
        </div>

        <div className="log-card" style={{ flex: 1, overflowY: 'auto', margin: 0, background: 'transparent' }}>
          <div className="log-item" style={{ opacity: 0.5, fontSize: '0.65rem', fontWeight: 800, borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
            <span style={{ width: '40px' }}>RANK</span>
            <span style={{ flex: 1 }}>PARTICIPANT</span>
            <span style={{ width: '80px', textAlign: 'right' }}>DELTA</span>
            <span style={{ width: '90px', textAlign: 'center' }}>EVALUATE</span>
          </div>

          {sortedClicks.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', opacity: 0.3, fontSize: '0.9rem' }}>Awaiting signals...</div>
          ) : (
            sortedClicks.map((click, index) => {
              const sapId = click.sapId;
              const evalRes = currentQuestion.evaluations[sapId];

              return (
                <div key={index} className="log-item" style={{
                  background: evalRes === true ? 'rgba(34, 197, 94, 0.1)' : evalRes === false ? 'rgba(239, 68, 68, 0.1)' : 'transparent',
                  borderLeft: evalRes === true ? '3px solid var(--success-green)' : evalRes === false ? '3px solid var(--upes-accent)' : '3px solid transparent',
                  padding: '10px 8px',
                  alignItems: 'center'
                }}>
                  <div style={{ width: '40px', fontWeight: 800, opacity: 0.5 }}>#{index + 1}</div>
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontWeight: 800, color: 'white', fontSize: '0.9rem' }}>{syncState.participants[sapId]?.name} {syncState.participants[sapId]?.profilePic}</span>
                     <span style={{ opacity: 0.4, fontSize: '0.6rem' }}>{sapId}</span>
                  </div>
                  <div style={{ width: '80px', textAlign: 'right', fontWeight: 700, fontSize: '0.85rem', color: index === 0 ? 'var(--success-green)' : 'rgba(255,255,255,0.6)' }}>
                    +{(click.msDelta / 1000).toFixed(3)}s
                  </div>
                  <div style={{ width: '90px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
                    <button 
                      onClick={() => syncEngine.adminEvaluateUser(sapId, viewRound, qIndex, true)}
                      style={{ 
                        background: evalRes === true ? 'var(--success-green)' : 'rgba(255,255,255,0.1)', 
                        border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' 
                      }}
                    >
                      ✅
                    </button>
                    <button 
                      onClick={() => syncEngine.adminEvaluateUser(sapId, viewRound, qIndex, false)}
                      style={{ 
                        background: evalRes === false ? 'var(--upes-accent)' : 'rgba(255,255,255,0.1)', 
                        border: 'none', borderRadius: '50%', width: '28px', height: '28px', cursor: 'pointer', 
                        display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.2s' 
                      }}
                    >
                      ❌
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 'auto' }}>
        <button onClick={handleResetTournament} style={{ background: 'transparent', color: 'var(--upes-accent)', border: 'none', fontSize: '0.7rem', fontWeight: 800, cursor: 'pointer' }}>RESTORE TOURNAMENT (DANGER)</button>
        {syncState.tournamentStatus === 'finished' && <span style={{ color: 'var(--success-green)', fontWeight: 800, fontSize: '0.8rem' }}>COMPLETE</span>}
      </div>
    </div>
  );
};

export default AdminPage;
