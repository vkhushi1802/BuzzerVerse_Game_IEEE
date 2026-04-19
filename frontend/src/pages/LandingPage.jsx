import React, { useState } from 'react';

const LandingPage = ({ onLogin }) => {
  const [role, setRole] = useState(null); // 'user' | 'admin'
  const [formData, setFormData] = useState({ name: '', sapId: '', adminId: '', password: '' });

  const handleInputChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (role === 'user') {
      if (formData.name && formData.sapId) {
        onLogin({ role: 'user', name: formData.name, sapId: formData.sapId });
      }
    } else if (role === 'admin') {
      try {
        const res = await fetch('http://localhost:8000/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: formData.password })
        });
        if (res.ok) {
          const data = await res.json();
          onLogin({ role: 'admin', token: data.token });
        } else {
          alert('Invalid Admin Credentials');
        }
      } catch (err) {
        alert('Cannot reach server');
      }
    }
  };

  return (
    <div className="arena-box">
      <h1 className="title">BuzzerVerse   </h1>

      {!role ? (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.2rem', padding: '1rem 0' }}>
          <p className="subtitle">Choose your Role</p>
          <button className="capsule-btn" onClick={() => setRole('user')} style={{ background: 'var(--success-green)', color: 'white' }}>Participant</button>
          <div style={{ display: 'flex', alignItems: 'center', width: '100%', maxWidth: '280px', gap: '10px' }}>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
            <span style={{ fontSize: '0.8rem', opacity: 0.4 }}>OR</span>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.1)', flex: 1 }}></div>
          </div>
          <button className="capsule-btn" onClick={() => setRole('admin')} style={{ border: '2px solid rgba(255,255,255,0.3)', background: 'transparent', color: 'white', fontSize: '0.9rem' }}>ADMIN</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ padding: '1rem 0' }}>
          <p className="subtitle" style={{ fontWeight: 700, color: 'var(--gta-cyan)' }}>{role === 'user' ? 'JOIN TOURNAMENT' : 'ADMIN AUTH'}</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {role === 'user' ? (
              <>
                <input
                  className="input-field"
                  name="name"
                  placeholder="Full Name"
                  required
                  onChange={handleInputChange}
                />
                <input
                  className="input-field"
                  name="sapId"
                  placeholder="SAP ID"
                  required
                  onChange={handleInputChange}
                />
              </>
            ) : (
              <>
                <input
                  className="input-field"
                  type="password"
                  name="password"
                  placeholder="Password"
                  required
                  onChange={handleInputChange}
                />
              </>
            )}
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            <button type="submit" className="capsule-btn" style={{ flex: '2 1 150px', margin: 0 }}>ENTER</button>
            <button type="button" className="capsule-btn" onClick={() => setRole(null)} style={{ flex: '1 1 80px', background: 'transparent', color: 'white', border: '1px solid rgba(255,255,255,0.1)', margin: 0, fontSize: '0.8rem' }}>Back</button>
          </div>
        </form>
      )}
    </div>
  );
};

export default LandingPage;
