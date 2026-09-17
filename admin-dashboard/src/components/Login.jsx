import React, { useState } from 'react';
import axios from 'axios';
import { Lock, Mail, Shield, AlertCircle, MapPin, User, CheckCircle, Eye, EyeOff, Cloud, Check, Loader2, Sparkles } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('inderjeetkaranjaiswal@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Clear any old localhost cache on load
  React.useEffect(() => {
    try {
      const savedUrl = localStorage.getItem('admin_backend_url');
      if (savedUrl && (savedUrl.includes('localhost') || savedUrl.includes('8080'))) {
        localStorage.setItem('admin_backend_url', '/api');
      }
    } catch (e) {}
  }, []);

  const executeLogin = async (targetEmail, targetPassword) => {
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const endpoint = isRegister ? '/api/auth/register' : '/api/auth/login';
      const payload = isRegister
        ? { name: name.trim(), email: targetEmail.trim().toLowerCase(), password: targetPassword, role: 'admin' }
        : { email: targetEmail.trim().toLowerCase(), password: targetPassword };

      const response = await axios.post(endpoint, payload);
      const { token, user } = response.data;

      if (user.role !== 'admin') {
        setError('Access denied: Only administrator accounts can access this dashboard.');
        setLoading(false);
        return;
      }

      if (isRegister) {
        setSuccessMsg('Admin registration successful! Logging you in...');
      }

      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(user));
      localStorage.setItem('admin_backend_url', '/api');

      setTimeout(() => {
        onLoginSuccess(user, token);
      }, isRegister ? 600 : 0);
    } catch (err) {
      console.error('Authentication error on Render Cloud:', err);
      if (!err.response) {
        setError('Network Connection Failed: Could not reach Render server. Please check internet connection.');
        return;
      }
      const validationErr = err.response?.data?.errors?.[0]?.msg;
      const serverMsg = typeof err.response?.data === 'object' ? (err.response?.data?.message || err.response?.data?.error) : null;
      const msg = validationErr || serverMsg || (isRegister ? 'Registration failed. Check details.' : 'Authentication failed. Please verify email and password.');
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await executeLogin(email, password);
  };

  // Fill Admin email
  const handleQuickLoginInderjeet = () => {
    setEmail('inderjeetkaranjaiswal@gmail.com');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 relative overflow-hidden">
      {/* Background Decorative Blur Gradients */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md space-y-5 glass-panel p-8 rounded-2xl shadow-2xl relative z-10 border border-slate-800/80">
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-slate-950 font-bold mb-1 shadow-lg shadow-emerald-500/20">
            <MapPin className="w-8 h-8" />
          </div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Admin Live Tracker</h2>
          <p className="text-sm text-slate-400">
            {isRegister ? 'Register administrator on Render' : 'Sign in to monitor live employee locations'}
          </p>

          {/* Render Cloud Live Indicator Badge */}
          <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/30 text-emerald-400 text-xs font-semibold mt-1 shadow-sm">
            <Cloud className="w-3.5 h-3.5 animate-pulse text-emerald-400" />
            <span>Connected to Render Cloud</span>
          </div>
        </div>

        {error && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm space-y-2 animate-fadeIn">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
            <button
              type="button"
              onClick={handleQuickLoginInderjeet}
              className="w-full mt-2 py-2 px-3 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium rounded-lg text-xs flex items-center justify-center space-x-1.5 border border-emerald-500/30 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>⚡ Click to Auto-Sign In as Inderjeet</span>
            </button>
          </div>
        )}

        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start space-x-3 text-emerald-400 text-sm animate-fadeIn">
            <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <span>{successMsg}</span>
          </div>
        )}

        {!isRegister && (
          <div className="space-y-2 pt-1">
            <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
              <span>Administrator Account:</span>
              <span className="text-emerald-400 text-[10px]">Verified on Render</span>
            </div>
            <button
              type="button"
              disabled={loading}
              onClick={handleQuickLoginInderjeet}
              className="w-full p-3.5 rounded-xl text-xs font-medium border bg-slate-900/90 hover:bg-emerald-950/40 hover:border-emerald-500/50 text-slate-200 border-slate-800 transition-all cursor-pointer shadow-md group disabled:opacity-50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-sm">
                    IK
                  </div>
                  <div className="text-left">
                    <div className="font-bold text-white text-sm group-hover:text-emerald-300 transition-colors">
                      Inderjeet Karan Jaiswal
                    </div>
                    <div className="text-[11px] text-slate-400 font-mono">
                      inderjeetkaranjaiswal@gmail.com
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-1 text-emerald-400 font-semibold text-xs px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  {loading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <>
                      <span>1-Click Login</span>
                      <Sparkles className="w-3 h-3 ml-0.5" />
                    </>
                  )}
                </div>
              </div>
            </button>
          </div>
        )}

        <div className="relative flex py-1 items-center">
          <div className="flex-grow border-t border-slate-800"></div>
          <span className="flex-shrink mx-3 text-slate-600 text-xs uppercase font-medium">Or verify credentials</span>
          <div className="flex-grow border-t border-slate-800"></div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isRegister && (
            <div>
              <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
                Full Name
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                  <User className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Inderjeet Karan Jaiswal"
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Email Address
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Mail className="w-5 h-5" />
              </div>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setError('');
                }}
                placeholder="inderjeetkaranjaiswal@gmail.com"
                className="w-full pl-11 pr-4 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 uppercase tracking-wider mb-2">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-500">
                <Lock className="w-5 h-5" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="••••••••"
                className="w-full pl-11 pr-11 py-3 bg-slate-900/80 border border-slate-800 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all text-sm"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-500 hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 font-bold rounded-xl shadow-lg shadow-emerald-500/25 focus:outline-none focus:ring-2 focus:ring-emerald-400 transition-all disabled:opacity-50 flex justify-center items-center space-x-2 text-sm mt-2 cursor-pointer"
          >
            {loading ? (
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                <span>Authenticating with Render...</span>
              </div>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                <span>{isRegister ? 'Register as Admin on Render' : 'Sign In as Admin'}</span>
              </>
            )}
          </button>
        </form>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setError('');
              setSuccessMsg('');
            }}
            className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors cursor-pointer"
          >
            {isRegister
              ? 'Already registered? Sign in with your credentials'
              : 'Need to create or reset admin account? Register here'}
          </button>
        </div>

        <div className="pt-3 border-t border-slate-800/80 text-center text-[11px] text-slate-500 flex items-center justify-center space-x-2">
          <span>Target Backend:</span>
          <code className="bg-slate-900 px-2 py-0.5 rounded text-emerald-400 font-mono">
            https://live-tracker-ahr5.onrender.com
          </code>
        </div>
      </div>
    </div>
  );
}
