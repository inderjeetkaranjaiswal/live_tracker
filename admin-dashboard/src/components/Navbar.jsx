import React from 'react';
import { MapPin, RefreshCw, LogOut, Radio, Users, Activity } from 'lucide-react';

export default function Navbar({
  adminUser,
  socketConnected,
  totalCount,
  onlineCount,
  onRefresh,
  onLogout
}) {
  return (
    <header className="h-16 glass-panel border-b border-slate-800/80 px-6 flex items-center justify-between relative z-20">
      {/* Brand & Status */}
      <div className="flex items-center space-x-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-slate-950 flex items-center justify-center font-bold shadow-md shadow-emerald-500/20">
            <MapPin className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight flex items-center space-x-2">
              <span>LiveTracker</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-semibold border border-emerald-500/30">
                PRO ADMIN
              </span>
            </h1>
            <p className="text-xs text-slate-400">Employee GPS Real-Time Monitor</p>
          </div>
        </div>

        <div className="h-6 w-px bg-slate-800 hidden md:block" />

        {/* Real-time Socket status badge */}
        <div className="hidden md:flex items-center space-x-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-xs">
          <Radio className={`w-3.5 h-3.5 ${socketConnected ? 'text-emerald-400 animate-pulse' : 'text-amber-400'}`} />
          <span className="text-slate-300">
            {socketConnected ? 'Real-Time Sync Active' : 'Connecting WebSocket...'}
          </span>
        </div>
      </div>

      {/* Center Metrics */}
      <div className="hidden lg:flex items-center space-x-6">
        <div className="flex items-center space-x-2 text-xs">
          <Users className="w-4 h-4 text-indigo-400" />
          <span className="text-slate-400">Total Tracked:</span>
          <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md">{totalCount}</span>
        </div>

        <div className="flex items-center space-x-2 text-xs">
          <Activity className="w-4 h-4 text-emerald-400" />
          <span className="text-slate-400">Active Online:</span>
          <span className="font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-md">
            {onlineCount}
          </span>
        </div>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        <button
          onClick={onRefresh}
          title="Refresh employee data"
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
        </button>

        <div className="flex items-center space-x-3 pl-3 border-l border-slate-800">
          <div className="hidden sm:block text-right">
            <div className="text-xs font-semibold text-white">{adminUser?.name || 'Administrator'}</div>
            <div className="text-[10px] text-slate-400">{adminUser?.email || 'admin@livetracker.com'}</div>
          </div>

          <button
            onClick={onLogout}
            title="Log Out"
            className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        </div>
      </div>
    </header>
  );
}
