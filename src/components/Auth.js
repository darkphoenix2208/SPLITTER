import React, { useState } from 'react';
import { apiFetch, setToken } from '../utils/api';

function Auth({ onLogin }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const body = isLogin ? { email, password } : { name, email, password };

    try {
      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      setToken(data.token);
      onLogin(data.user);
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="auth-container" style={{ padding: '2rem', maxWidth: '400px', margin: '0 auto', textAlign: 'center' }}>
      <h2>{isLogin ? 'Login to Expense Splitter' : 'Create an Account'}</h2>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {!isLogin && (
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            style={{ padding: '0.8rem', fontSize: '1rem' }}
          />
        )}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '0.8rem', fontSize: '1rem' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '0.8rem', fontSize: '1rem' }}
        />
        <button className="button" type="submit" style={{ padding: '1rem', marginTop: '1rem', fontSize: '1rem' }}>
          {isLogin ? 'Login' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: '1rem', cursor: 'pointer', textDecoration: 'underline' }} onClick={() => setIsLogin(!isLogin)}>
        {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
      </p>
    </div>
  );
}

export default Auth;
