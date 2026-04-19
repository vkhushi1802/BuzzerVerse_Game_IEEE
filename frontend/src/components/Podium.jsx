import React from 'react';

const Podium = ({ clicks }) => {
  const sorted = [...clicks].sort((a, b) => a.msDelta - b.msDelta);

  const Slot = ({ user, place }) => (
    <div className={`podium-slot place-${place}`}>
      <div className="podium-name">{user ? user.user : '-'}</div>
      <div className="podium-bar">#{place}</div>
    </div>
  );

  return (
    <div className="podium-container">
      <Slot user={sorted[1]} place={2} />
      <Slot user={sorted[0]} place={1} />
      <Slot user={sorted[2]} place={3} />
    </div>
  );
};

export default Podium;
