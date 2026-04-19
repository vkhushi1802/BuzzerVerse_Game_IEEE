import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import './styles/global.css';

import ieeeLogo from './assets/ieee_logo.png';

function App() {
  const [user, setUser] = useState(null); // { role: 'user' | 'admin', name?, sapId? }
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    if (userData.role === 'admin') {
      history.pushState({}, '', '/admin');
      setCurrentPath('/admin');
    } else {
      history.pushState({}, '', '/game');
      setCurrentPath('/game');
    }
  };

  const handleLogout = () => {
    setUser(null);
    history.pushState({}, '', '/');
    setCurrentPath('/');
  };

  const Branding = () => (
    <div className="brand-logos">
      <img src={ieeeLogo} alt="IEEE" className="logo-ieee" onError={(e) => e.target.style.display='none'} />
    </div>
  );

  if (!user) {
    return (
      <div className="layout-wrapper">
        <div className="watermark">IEEE</div>
        <Branding />
        <main className="main-content">
          <LandingPage onLogin={handleLogin} />
        </main>
      </div>
    );
  }

  return (
    <div className="layout-wrapper">
      <div className="watermark">IEEE</div>
      <Branding />
      <main className="main-content">
        {user.role === 'admin' ? (
          <AdminPage />
        ) : (
          <UserPage userData={user} />
        )}
      </main>
      <div className="exit-container">
        <button className="exit-btn" onClick={handleLogout}>Exit</button>
      </div>
    </div>
  );
}

export default App;
