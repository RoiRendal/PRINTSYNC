import React, { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Lock, Mail } from 'lucide-react';
import { BRAND_LOGO_URL } from '../../../shared/constants/branding';
import { useUserContext } from '../../users/state/UserContext';

export default function LoginPage() {
  const { login, currentUser } = useUserContext();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  if (currentUser) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = login(email, password);
    if (!ok) {
      setError('Invalid email or password.');
      return;
    }
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-5">
          <img src={BRAND_LOGO_URL} alt="PRINTSYNC logo" className="h-10 w-auto object-contain mb-3" />
          <p className="text-sm font-semibold text-gray-800">Login to PRINTSYNC</p>
        </div>

        <div className="bg-white border border-gray-200 rounded-md p-6 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="relative">
              <Mail className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-gray-100 border border-gray-200 rounded text-xs text-gray-800 focus:outline-none focus:border-gray-400"
                required
              />
            </div>

            <div className="relative">
              <Lock className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full h-9 pl-9 pr-3 bg-gray-100 border border-gray-200 rounded text-xs text-gray-800 focus:outline-none focus:border-gray-400"
                required
              />
            </div>

            {error && <p className="text-[11px] text-red-600">{error}</p>}

            <button
              type="submit"
              className="w-full h-9 bg-zinc-900 text-white text-xs font-semibold rounded hover:bg-zinc-800"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
