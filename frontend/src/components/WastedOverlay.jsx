import React from 'react';

const WastedOverlay = ({ show, text }) => {
  if (!show) return null;

  return (
    <div id="wastedOverlay" className="wasted-overlay">
      <div id="wastedText" className="wasted-text">
        {text}
      </div>
    </div>
  );
};

export default WastedOverlay;
