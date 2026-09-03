import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Compass, Layers, Info, ExternalLink, Radio } from 'lucide-react';

export default function LiveMap({
  employees,
  selectedEmployee,
  onSelectEmployee,
  googleMapsApiKey
}) {
  const mapRef = useRef(null);
  const leafletMapRef = useRef(null);
  const leafletMarkersRef = useRef({});

  const [mapLoaded, setMapLoaded] = useState(false);
  const [mapError, setMapError] = useState(false);
  const [leafletReady, setLeafletReady] = useState(false);
  const [googleMapInstance, setGoogleMapInstance] = useState(null);
  const googleMarkersRef = useRef({});

  // 1. Dynamic Google Maps Script Loading
  useEffect(() => {
    if (!googleMapsApiKey || window.google?.maps) {
      if (window.google?.maps) setMapLoaded(true);
      else setMapError(true); // Trigger Leaflet fallback if no key
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${googleMapsApiKey}&libraries=places`;
    script.async = true;
    script.defer = true;
    script.onload = () => setMapLoaded(true);
    script.onerror = () => {
      console.warn('[Google Maps] Failed to load Google Maps script. Falling back to OpenStreetMap.');
      setMapError(true);
    };
    document.head.appendChild(script);
  }, [googleMapsApiKey]);

  // 2. Initialize Google Maps Instance when script is ready
  useEffect(() => {
    if (mapLoaded && !mapError && mapRef.current && !googleMapInstance && window.google?.maps) {
      try {
        const defaultCenter = { lat: 37.7749, lng: -122.4194 };
        const map = new window.google.maps.Map(mapRef.current, {
          center: defaultCenter,
          zoom: 12,
          styles: [
            { elementType: 'geometry', stylers: [{ color: '#0f172a' }] },
            { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
            { elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
            { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#94a3b8' }] },
            { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#64748b' }] },
            { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
            { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
            { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#0f172a' }] },
            { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#334155' }] },
            { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#020617' }] },
          ],
          disableDefaultUI: false,
          zoomControl: true
        });
        setGoogleMapInstance(map);
      } catch (e) {
        setMapError(true);
      }
    }
  }, [mapLoaded, mapError, googleMapInstance]);

  // 3. Update Markers on Google Map
  useEffect(() => {
    if (!googleMapInstance || !window.google?.maps) return;

    const bounds = new window.google.maps.LatLngBounds();
    let hasValidCoords = false;

    employees.forEach((emp) => {
      if (emp.latitude == null || emp.longitude == null) return;

      const pos = { lat: emp.latitude, lng: emp.longitude };
      bounds.extend(pos);
      hasValidCoords = true;

      let marker = googleMarkersRef.current[emp.employeeId];

      if (!marker) {
        marker = new window.google.maps.Marker({
          position: pos,
          map: googleMapInstance,
          title: emp.name,
          icon: {
            path: window.google.maps.SymbolPath.CIRCLE,
            scale: 9,
            fillColor: emp.isOnline ? '#22c55e' : '#64748b',
            fillOpacity: 1,
            strokeWeight: 3,
            strokeColor: '#020617',
          }
        });

        const infoWindow = new window.google.maps.InfoWindow({
          content: `
            <div style="color: #0f172a; padding: 6px; font-family: sans-serif;">
              <strong style="font-size: 14px;">${emp.name}</strong><br/>
              <span style="font-size: 12px; color: #475569;">${emp.email}</span><br/>
              <div style="margin-top: 4px; font-size: 11px;">
                <strong>Lat:</strong> ${emp.latitude.toFixed(5)}<br/>
                <strong>Lng:</strong> ${emp.longitude.toFixed(5)}<br/>
                <strong>Updated:</strong> ${new Date(emp.updatedAt).toLocaleTimeString()}
              </div>
            </div>
          `
        });

        marker.addListener('click', () => {
          infoWindow.open(googleMapInstance, marker);
          onSelectEmployee(emp);
        });
        googleMarkersRef.current[emp.employeeId] = marker;

      } else {
        marker.setPosition(pos);
        marker.setIcon({
          path: window.google.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: emp.isOnline ? '#22c55e' : '#64748b',
          fillOpacity: 1,
          strokeWeight: 3,
          strokeColor: '#020617',
        });
      }
    });

    if (selectedEmployee?.latitude != null) {
      googleMapInstance.panTo({ lat: selectedEmployee.latitude, lng: selectedEmployee.longitude });
      googleMapInstance.setZoom(15);
    } else if (hasValidCoords && employees.length > 0) {
      googleMapInstance.fitBounds(bounds);
    }
  }, [googleMapInstance, employees, selectedEmployee]);

  // 4. Dynamic Leaflet (OpenStreetMap) Loading & Setup for crisp real map fallback
  useEffect(() => {
    const showGoogleMap = googleMapsApiKey && mapLoaded && !mapError;
    if (showGoogleMap || window.L) {
      if (window.L) setLeafletReady(true);
      return;
    }

    // Include Leaflet CSS
    if (!document.getElementById('leaflet-css')) {
      const link = document.createElement('link');
      link.id = 'leaflet-css';
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Include Leaflet JS
    if (!document.getElementById('leaflet-js')) {
      const script = document.createElement('script');
      script.id = 'leaflet-js';
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.async = true;
      script.onload = () => setLeafletReady(true);
      document.head.appendChild(script);
    }
  }, [mapLoaded, mapError, googleMapsApiKey]);

  // Initialize Leaflet Map
  useEffect(() => {
    const showGoogleMap = googleMapsApiKey && mapLoaded && !mapError;
    if (showGoogleMap || !leafletReady || !window.L || !mapRef.current || leafletMapRef.current) return;

    const initialLat = employees.find(e => e.latitude != null)?.latitude ?? 37.7749;
    const initialLng = employees.find(e => e.longitude != null)?.longitude ?? -122.4194;

    const map = window.L.map(mapRef.current, {
      zoomControl: true,
      attributionControl: true
    }).setView([initialLat, initialLng], 13);

    // CartoDB Dark Matter / Voyager High-Res Tile Layer
    window.L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19,
      subdomains: 'abcd',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    }).addTo(map);

    leafletMapRef.current = map;
  }, [leafletReady, mapLoaded, mapError, googleMapsApiKey]);

  // Update Markers on Leaflet Map
  useEffect(() => {
    const map = leafletMapRef.current;
    if (!map || !window.L) return;

    const bounds = window.L.latLngBounds();
    let hasCoords = false;

    employees.forEach(emp => {
      if (emp.latitude == null || emp.longitude == null) return;
      const latLng = [emp.latitude, emp.longitude];
      bounds.extend(latLng);
      hasCoords = true;

      let marker = leafletMarkersRef.current[emp.employeeId];

      const pulseColor = emp.isOnline ? '#22c55e' : '#64748b';
      const customIcon = window.L.divIcon({
        className: 'custom-leaflet-marker',
        html: `
          <div style="
            position: relative;
            width: 24px;
            height: 24px;
            background: ${pulseColor};
            border: 3px solid #020617;
            border-radius: 50%;
            box-shadow: 0 0 12px ${pulseColor};
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
          ">
            ${emp.isOnline ? `<div style="width: 8px; height: 8px; background: #ffffff; border-radius: 50%;"></div>` : ''}
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const popupContent = `
        <div style="font-family: sans-serif; padding: 4px;">
          <strong style="font-size: 14px; color: #0f172a;">${emp.name}</strong><br/>
          <span style="font-size: 12px; color: #64748b;">${emp.email}</span><br/>
          <div style="margin-top: 6px; font-size: 11px; color: #334155;">
            <strong>Status:</strong> ${emp.isOnline ? '<span style="color: green; font-weight: bold;">ONLINE</span>' : 'OFFLINE'}<br/>
            <strong>Lat:</strong> ${emp.latitude.toFixed(5)}<br/>
            <strong>Lng:</strong> ${emp.longitude.toFixed(5)}<br/>
            <strong>Last Updated:</strong> ${new Date(emp.updatedAt).toLocaleTimeString()}
          </div>
        </div>
      `;

      if (!marker) {
        marker = window.L.marker(latLng, { icon: customIcon }).addTo(map);
        marker.bindPopup(popupContent);
        marker.on('click', () => onSelectEmployee(emp));
        leafletMarkersRef.current[emp.employeeId] = marker;
      } else {
        marker.setLatLng(latLng);
        marker.setIcon(customIcon);
        marker.setPopupContent(popupContent);
      }
    });

    if (selectedEmployee?.latitude != null) {
      map.setView([selectedEmployee.latitude, selectedEmployee.longitude], 15, { animate: true });
    } else if (hasCoords && employees.length > 0) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [employees, selectedEmployee, leafletReady]);

  const showGoogleMap = googleMapsApiKey && mapLoaded && !mapError;

  return (
    <div className="flex-1 h-[calc(100vh-4rem)] relative bg-slate-950 overflow-hidden">
      {/* Map Container for Google Maps or Leaflet */}
      <div ref={mapRef} className="w-full h-full absolute inset-0 z-0" />

      {/* Control overlay */}
      <div className="absolute top-4 right-4 glass-panel p-3 rounded-xl text-xs z-20 space-y-1 shadow-2xl flex items-center space-x-2">
        <div className="flex items-center space-x-2 text-emerald-400 font-bold">
          <Radio className="w-4 h-4 animate-pulse text-emerald-400" />
          <span>{showGoogleMap ? 'Google Maps Engine Active' : 'OpenStreetMap Engine Active'}</span>
        </div>
      </div>

      {/* Floating Control Bar */}
      <div className="absolute bottom-6 right-6 glass-panel p-2 rounded-2xl flex items-center space-x-2 z-20 shadow-2xl">
        <button
          onClick={() => {
            if (employees.length > 0 && employees[0].latitude != null) {
              onSelectEmployee(employees[0]);
            }
          }}
          className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white text-xs font-semibold flex items-center space-x-1.5 transition-colors border border-slate-700/50"
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
          <span>Focus Active Employee</span>
        </button>
      </div>
    </div>
  );
}
