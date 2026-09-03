import React, { useState } from 'react';
import { Search, MapPin, Clock, Signal, SignalZero, ChevronRight, User } from 'lucide-react';

export default function Sidebar({
  employees,
  selectedEmployee,
  onSelectEmployee
}) {
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all'); // 'all' | 'online' | 'offline'

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch =
      emp.name?.toLowerCase().includes(search.toLowerCase()) ||
      emp.email?.toLowerCase().includes(search.toLowerCase());

    if (filterStatus === 'online') return matchesSearch && emp.isOnline;
    if (filterStatus === 'offline') return matchesSearch && !emp.isOnline;
    return matchesSearch;
  });

  const formatLastUpdated = (timestamp) => {
    if (!timestamp) return 'No updates yet';
    const date = new Date(timestamp);
    const now = new Date();
    const diffSecs = Math.floor((now - date) / 1000);

    if (diffSecs < 10) return 'Just now';
    if (diffSecs < 60) return `${diffSecs}s ago`;
    if (diffSecs < 3600) return `${Math.floor(diffSecs / 60)}m ago`;
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <aside className="w-80 glass-panel border-r border-slate-800/80 flex flex-col h-[calc(100vh-4rem)] z-10">
      {/* Search Header */}
      <div className="p-4 border-b border-slate-800/80 space-y-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search employee..."
            className="w-full pl-9 pr-4 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800/60 text-xs">
          <button
            onClick={() => setFilterStatus('all')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              filterStatus === 'all'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            All ({employees.length})
          </button>
          <button
            onClick={() => setFilterStatus('online')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              filterStatus === 'online'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Online ({employees.filter(e => e.isOnline).length})
          </button>
          <button
            onClick={() => setFilterStatus('offline')}
            className={`flex-1 py-1.5 rounded-lg font-medium transition-all ${
              filterStatus === 'offline'
                ? 'bg-emerald-500 text-slate-950 font-bold shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Offline ({employees.filter(e => !e.isOnline).length})
          </button>
        </div>
      </div>

      {/* Employee List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {filteredEmployees.length === 0 ? (
          <div className="text-center py-10 space-y-2">
            <User className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-xs text-slate-400">No employees found</p>
          </div>
        ) : (
          filteredEmployees.map((emp) => {
            const isSelected = selectedEmployee?.employeeId === emp.employeeId;

            return (
              <div
                key={emp.employeeId}
                onClick={() => onSelectEmployee(emp)}
                className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                  isSelected
                    ? 'bg-emerald-500/10 border-emerald-500/50 shadow-lg shadow-emerald-500/10'
                    : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 hover:bg-slate-900'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="relative">
                      <div className="w-9 h-9 rounded-xl bg-slate-800 text-slate-300 font-bold flex items-center justify-center text-sm border border-slate-700">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <span
                        className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-950 ${
                          emp.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'
                        }`}
                      />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white leading-snug">{emp.name}</h3>
                      <p className="text-[11px] text-slate-400">{emp.email}</p>
                    </div>
                  </div>

                  <ChevronRight className={`w-4 h-4 transition-transform ${isSelected ? 'text-emerald-400 translate-x-0.5' : 'text-slate-600'}`} />
                </div>

                {/* Location summary */}
                <div className="mt-3 pt-2.5 border-t border-slate-800/60 flex items-center justify-between text-[11px] text-slate-400">
                  <div className="flex items-center space-x-1.5">
                    <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      {emp.latitude != null ? `${emp.latitude.toFixed(4)}, ${emp.longitude.toFixed(4)}` : 'No GPS data'}
                    </span>
                  </div>

                  <div className="flex items-center space-x-1 text-slate-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatLastUpdated(emp.updatedAt)}</span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
