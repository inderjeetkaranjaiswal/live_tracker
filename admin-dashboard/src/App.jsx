import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import Login from './components/Login';
import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import LiveMap from './components/LiveMap';
import EmployeeDetailModal from './components/EmployeeDetailModal';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '/api';
const RENDER_DIRECT_URL = 'https://live-tracker-ahr5.onrender.com';
const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

export default function App() {
  const [adminUser, setAdminUser] = useState(() => {
    const saved = localStorage.getItem('admin_user');
    return saved ? JSON.parse(saved) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem('admin_token') || '');

  const [employees, setEmployees] = useState([]);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [socketConnected, setSocketConnected] = useState(false);
  const [loading, setLoading] = useState(false);

  // Fetch all employee locations from backend
  const fetchEmployeeLocations = useCallback(async () => {
    if (!token) return;
    setLoading(true);

    try {
      const response = await axios.get(`${BACKEND_URL}/location/all`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setEmployees(response.data.employees || []);
    } catch (err) {
      console.error('Failed to fetch employee locations:', err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  // Handle Login
  const handleLoginSuccess = (user, jwtToken) => {
    setAdminUser(user);
    setToken(jwtToken);
  };

  // Handle Logout
  const handleLogout = () => {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    setAdminUser(null);
    setToken('');
    setEmployees([]);
    setSelectedEmployee(null);
  };

  // Initial Load & Periodic Refresh Fallback
  useEffect(() => {
    if (token) {
      fetchEmployeeLocations();
      const interval = setInterval(fetchEmployeeLocations, 15000); // 15s fallback poll
      return () => clearInterval(interval);
    }
  }, [token, fetchEmployeeLocations]);

  // Real-time Socket.IO Connection & Listener
  useEffect(() => {
    if (!token) return;

    const socketUrl = BACKEND_URL.startsWith('http') ? BACKEND_URL : RENDER_DIRECT_URL;
    const socket = io(socketUrl, {
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      console.log('[Dashboard Socket.IO] Connected to server ID:', socket.id);
      setSocketConnected(true);
    });

    socket.on('disconnect', () => {
      console.log('[Dashboard Socket.IO] Disconnected from server');
      setSocketConnected(false);
    });

    const handleLocationUpdate = (updatedData) => {
      console.log('[Dashboard Real-time Event] Location update received:', updatedData);
      const empId = updatedData.employeeId;
      const empName = updatedData.employeeName || updatedData.name;
      const empEmail = updatedData.employeeEmail || updatedData.email;
      const time = updatedData.timestamp || updatedData.updatedAt || new Date().toISOString();

      setEmployees((prevEmployees) => {
        const index = prevEmployees.findIndex(e => e.employeeId === empId);
        const existingEmp = index !== -1 ? prevEmployees[index] : {};

        const updatedEmp = {
          ...existingEmp,
          employeeId: empId,
          name: empName || existingEmp.name || 'Employee',
          email: empEmail || existingEmp.email || '',
          role: 'employee',
          latitude: updatedData.latitude,
          longitude: updatedData.longitude,
          updatedAt: time,
          timestamp: time,
          isOnline: true
        };

        if (index !== -1) {
          const newArray = [...prevEmployees];
          newArray[index] = updatedEmp;
          return newArray;
        } else {
          return [updatedEmp, ...prevEmployees];
        }
      });

      setSelectedEmployee((prev) => {
        if (prev && prev.employeeId === empId) {
          return {
            ...prev,
            latitude: updatedData.latitude,
            longitude: updatedData.longitude,
            updatedAt: time,
            timestamp: time,
            isOnline: true
          };
        }
        return prev;
      });
    };

    // Listen for both event names for maximum compatibility
    socket.on('location_updated', handleLocationUpdate);
    socket.on('employeeLocationUpdated', handleLocationUpdate);

    return () => {
      socket.disconnect();
    };
  }, [token]);

  // Periodic recalculation of online/offline status based on 30-second threshold
  useEffect(() => {
    if (!token) return;
    const interval = setInterval(() => {
      const now = new Date().getTime();
      setEmployees((prevEmployees) =>
        prevEmployees.map((emp) => {
          if (!emp.updatedAt) return emp;
          const lastUpdate = new Date(emp.updatedAt).getTime();
          const isOnline = now - lastUpdate < 60000; // 60 seconds threshold
          return emp.isOnline !== isOnline ? { ...emp, isOnline } : emp;
        })
      );
    }, 5000);

    return () => clearInterval(interval);
  }, [token]);

  if (!token || !adminUser) {
    return <Login onLoginSuccess={handleLoginSuccess} backendUrl={BACKEND_URL} />;
  }

  const onlineCount = employees.filter(e => e.isOnline).length;

  return (
    <div className="h-screen flex flex-col bg-slate-950 text-slate-100 overflow-hidden">
      {/* Top Header */}
      <Navbar
        adminUser={adminUser}
        socketConnected={socketConnected}
        totalCount={employees.length}
        onlineCount={onlineCount}
        onRefresh={fetchEmployeeLocations}
        onLogout={handleLogout}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Left Sidebar */}
        <Sidebar
          employees={employees}
          selectedEmployee={selectedEmployee}
          onSelectEmployee={setSelectedEmployee}
        />

        {/* Center Live Map */}
        <LiveMap
          employees={employees}
          selectedEmployee={selectedEmployee}
          onSelectEmployee={setSelectedEmployee}
          googleMapsApiKey={GOOGLE_MAPS_API_KEY}
        />

        {/* Selected Employee Detail Drawer */}
        {selectedEmployee && (
          <EmployeeDetailModal
            employee={selectedEmployee}
            onClose={() => setSelectedEmployee(null)}
          />
        )}
      </div>
    </div>
  );
}
