import React, { useState } from 'react';
import { X, MapPin, Copy, Check, ExternalLink, User, Mail, Shield, Clock, Radio } from 'lucide-react';

export default function EmployeeDetailModal({ employee, onClose }) {
  const [copied, setCopied] = useState(false);

  if (!employee) return null;

  const copyCoordinates = () => {
    if (employee.latitude != null && employee.longitude != null) {
      navigator.clipboard.writeText(`${employee.latitude}, ${employee.longitude}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const googleMapsUrl = employee.latitude != null
    ? `https://www.google.com/maps?q=${employee.latitude},${employee.longitude}`
    : '#';

  return (
    <div className="absolute top-16 right-0 bottom-0 w-96 glass-panel border-l border-slate-800/80 p-6 flex flex-col justify-between z-30 shadow-2xl animate-in slide-in-from-right duration-300">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span className={`w-3 h-3 rounded-full ${employee.isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              {employee.isOnline ? 'Active Online' : 'Offline'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Card */}
        <div className="flex items-center space-x-4 p-4 rounded-2xl bg-slate-900/80 border border-slate-800">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-emerald-500 to-emerald-400 text-slate-950 font-extrabold text-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            {employee.name.charAt(0).toUpperCase()}
          </div>
          <div className="overflow-hidden">
            <h2 className="text-lg font-bold text-white truncate">{employee.name}</h2>
            <p className="text-xs text-slate-400 truncate">{employee.email}</p>
            <span className="inline-block mt-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-800 text-slate-300 border border-slate-700">
              Role: {employee.role}
            </span>
          </div>
        </div>

        {/* GPS Coordinates Card */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center space-x-1.5">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <span>GPS Location Coordinates</span>
          </h3>

          <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 space-y-3">
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Latitude</span>
                <span className="font-mono font-bold text-white">
                  {employee.latitude != null ? employee.latitude.toFixed(6) : 'N/A'}
                </span>
              </div>

              <div className="bg-slate-950/60 p-3 rounded-xl border border-slate-800/80">
                <span className="text-[10px] text-slate-500 block">Longitude</span>
                <span className="font-mono font-bold text-white">
                  {employee.longitude != null ? employee.longitude.toFixed(6) : 'N/A'}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-1 text-slate-400">
              <div className="flex items-center space-x-1">
                <Clock className="w-3.5 h-3.5 text-slate-500" />
                <span>Last Updated:</span>
              </div>
              <span className="text-white font-medium">
                {employee.updatedAt ? new Date(employee.updatedAt).toLocaleString() : 'Never'}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-2">
          <button
            onClick={copyCoordinates}
            disabled={employee.latitude == null}
            className="w-full py-2.5 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-bold text-slate-200 flex items-center justify-center space-x-2 transition-colors disabled:opacity-50"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? 'Coordinates Copied!' : 'Copy Lat/Lng String'}</span>
          </button>

          {employee.latitude != null && (
            <a
              href={googleMapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-xs font-bold text-emerald-400 flex items-center justify-center space-x-2 transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Open in Google Maps</span>
            </a>
          )}
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 text-center text-[10px] text-slate-500">
        Employee ID: <code className="text-slate-400">{employee.employeeId}</code>
      </div>
    </div>
  );
}
