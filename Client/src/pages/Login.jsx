/**
 * Client/src/pages/Login.jsx
 * 
 * Premium cinematic login UI (2026)
 * 
 * Features:
 *   - Your custom user.png & lock.png icons
 *   - Sub-100ms micro-interactions
 *   - Security-focused animations
 *   - Cinematic hover effects
 */
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Login = () => {
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isHovered, setIsHovered] = useState({ id: false, password: false });
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  // Dummy user for testing
  const dummyUser = {
    id: '12345',
    password: 'password123',
  };

const handleLogin = async (e) => {
  e.preventDefault();
  setError('');
  setIsLoading(true);

  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: id, password })
    });

    const data = await response.json();

    if (data.success) {
      // Store token
      localStorage.setItem('authToken', data.token);
      
      // Redirect based on role
      if (data.role === 'student') {
        navigate('/student-id');
      } else if (data.role === 'admin' || data.role === 'scanner') {
        navigate('/admin-dashboard');
      }
    } else {
      setError(data.message || 'Invalid credentials');
    }
  } catch (err) {
    setError('Network error. Please check server.');
  } finally {
    setIsLoading(false);
  }
};

  return (
    <div className="login-page">
      <div className="login-layout">
        {/* Header */}
        <div className="login-header">
          <img
            src="./NUTECH_logo.png"
            alt="NUTECH Logo"
            className="login-header__logo"
          />
          <h1 className="login-header__title">
            Digital Student Identity System
          </h1>
          <p className="login-header__subtitle">
            Secure, Offline-Capable Digital ID Verification
          </p>
        </div>

        {/* Form */}
        <div className="login-form">
          <div className="login-card">
            <h2 className="login-card__title">Login</h2>

            <form onSubmit={handleLogin}>
              {/* Identifier Field */}
              <div 
                className={`input-group ${isHovered.id ? 'input-group--hover' : ''} ${error ? 'input-group--error' : ''}`}
                onMouseEnter={() => setIsHovered(prev => ({ ...prev, id: true }))}
                onMouseLeave={() => setIsHovered(prev => ({ ...prev, id: false }))}
              >
                <div className="input-icon">
                  <img 
                    src="./user.png" 
                    alt="User" 
                    className="input-icon__img"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Student ID or Admin ID"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  required
                  onFocus={() => setIsHovered(prev => ({ ...prev, id: true }))}
                  onBlur={() => setIsHovered(prev => ({ ...prev, id: false }))}
                  className="input-field"
                />
              </div>

              {/* Password Field */}
              <div 
                className={`input-group ${isHovered.password ? 'input-group--hover' : ''} ${error ? 'input-group--error' : ''}`}
                onMouseEnter={() => setIsHovered(prev => ({ ...prev, password: true }))}
                onMouseLeave={() => setIsHovered(prev => ({ ...prev, password: false }))}
              >
                <div className="input-icon">
                  <img 
                    src="./lock.png" 
                    alt="Lock" 
                    className="input-icon__img"
                  />
                </div>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  onFocus={() => setIsHovered(prev => ({ ...prev, password: true }))}
                  onBlur={() => setIsHovered(prev => ({ ...prev, password: false }))}
                  className="input-field"
                />
              </div>

              {/* Error Message */}
              {error && (
                <div className="error-message">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.195 3 1.732 3z" />
                  </svg>
                  <span>{error}</span>
                </div>
              )}

              {/* Login Button */}
              <button 
                type="submit" 
                className={`login-btn ${isLoading ? 'btn-loading' : ''}`}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="spinner"></div>
                    <span>Authenticating...</span>
                  </>
                ) : 'Login'}
              </button>
            </form>

            {/* Security Badge */}
            <div className="security-badge">
              <div className="security-badge__icon">
                <img 
                    src="./lock.png" 
                    alt="User" 
                    className="input-icon__img"
                  />
              </div>
              <div className="security-badge__text">
                <strong>Secure System</strong>
                <p>Unauthorized access is monitored in real-time</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="login-footer">
          © 2024 National University of Technology. All rights reserved.
        </footer>
      </div>
    </div>
  );
};

export default Login;