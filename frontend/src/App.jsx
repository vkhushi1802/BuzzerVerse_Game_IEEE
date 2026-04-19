import React, { useState, useEffect } from 'react';
import LandingPage from './pages/LandingPage';
import UserPage from './pages/UserPage';
import AdminPage from './pages/AdminPage';
import './styles/global.css';

// Logo Assets (Paths provided by user's plan)
import ieeeLogo from './assets/ieee_logo.png';
import upesLogo from './assets/upes_logo.png';

function App() {
  // Restore session from localStorage on mount
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('buzzer_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  // On mount: if user exists from localStorage, navigate to correct page
  useEffect(() => {
    if (user) {
      const targetPath = user.role === 'admin' ? '/admin' : '/game';
      if (window.location.pathname === '/') {
        history.replaceState({}, '', targetPath);
        setCurrentPath(targetPath);
      }
    }
  }, []);

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  const handleLogin = (userData) => {
    setUser(userData);
    // Persist session to localStorage
    localStorage.setItem('buzzer_user', JSON.stringify(userData));

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
    // Clear persisted session
    localStorage.removeItem('buzzer_user');
    history.pushState({}, '', '/');
    setCurrentPath('/');
  };

  // Logos Component
  const Branding = () => (
    <div className="brand-logos">
      <img src={ieeeLogo} alt="IEEE" className="logo-ieee" onError={(e) => e.target.style.display='none'} />
      <img src={upesLogo} alt="UPES" className="logo-upes" onError={(e) => e.target.style.display='none'} />
    </div>
  );

  if (!user) {
    return (
      <>
        <Branding />
        <LandingPage onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      <div className="watermark">IEEE</div>
      <Branding />
      <div className="exit-container">
        <button className="exit-btn" onClick={handleLogout}>Exit</button>
      </div>
      
      <main style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
        {user.role === 'admin' ? (
          <AdminPage userData={user} />
        ) : (
          <UserPage userData={user} />
        )}
      </main>
    </>
  );
}

export default App;
