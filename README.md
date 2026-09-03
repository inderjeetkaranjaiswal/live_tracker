# Secure Employee Live Location Tracking System

A full-stack, production-quality solution for real-time employee GPS tracking. Built with a Node.js/Express/MongoDB/Socket.IO backend, a React + Tailwind CSS Admin Dashboard, and a Flutter Material Design 3 Employee App.

---

## Architecture & Features

```
                      +-----------------------------+
                      |   Flutter Employee Mobile   |
                      |   (Location Updates 10s)    |
                      +--------------+--------------+
                                     |
                          HTTP POST / WebSocket
                                     |
                                     v
                      +-----------------------------+
                      |  Node.js / Express Backend  |
                      |  - JWT Auth / Bcrypt        |
                      |  - MongoDB (Users/Locations)|
                      |  - Socket.IO Server         |
                      +--------------+--------------+
                                     |
                              WebSocket Emit
                                     v
                      +-----------------------------+
                      |    React Admin Dashboard    |
                      |   - Google Maps JS / Markers|
                      |   - Real-time Socket Listener|
                      +-----------------------------+
```

### Key Highlights

- **Role-Based Access Control (RBAC)**: Secure isolation between Employee and Admin accounts. Employees can only transmit their own GPS location; only authenticated Admins can view map tracking data.
- **Zero-Refresh Real-Time Updates**: Powered by Socket.IO, location updates sent by employee apps immediately broadcast to active Admin maps without requiring page refreshes.
- **Security Hardening**: Passwords hashed with `bcryptjs`, JWT verification with `HS256`, Helmet HTTP headers, express rate limiters, input validation, and multi-tiered fallback for secrets.
- **Interactive Google Maps**: Real-time marker animations, custom popup info windows, coordinates drawer, online/offline status indicators, and fallback radar canvas.

---

## Directory Structure

```
live_tracker/
├── backend/                  # Node.js Express & Socket.IO Backend Server
│   ├── src/
│   │   ├── middleware/       # JWT & RBAC Auth middleware
│   │   ├── models/           # Mongoose schemas (User & Location)
│   │   ├── routes/           # Auth and Location API controllers
│   │   ├── utils/            # Secret Manager & In-Memory Store Fallback
│   │   └── server.js         # Server entry point
│   ├── test/                 # Integration test suite
│   ├── .env.example
│   └── package.json
│
├── admin-dashboard/          # React.js + Tailwind CSS + Google Maps Admin Web App
│   ├── src/
│   │   ├── components/       # Login, Navbar, Sidebar, LiveMap, EmployeeDetailModal
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
└── employee_app/             # Flutter Mobile App (Material Design 3)
    ├── lib/
    │   ├── screens/          # LoginScreen, PermissionScreen, StatusScreen
    │   ├── services/         # ApiService & LocationService (10s periodic GPS stream)
    │   └── main.dart
    └── pubspec.yaml
```

---

## Setup & Quick Start Guide

### Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm**: v9.0.0 or higher
- **MongoDB**: MongoDB Atlas connection URI configured via `MONGO_URI` in `.env` (Note: The server includes an automatic in-memory fallback if MongoDB is offline)
- **Flutter SDK**: v3.0.0+ (for mobile app build)

---

### 1. Backend Server Setup

Navigate to the `backend` folder and install dependencies:

```bash
cd backend
npm install
```

Configure Environment Variables (`backend/.env`):

```env
PORT=8080
HOST=127.0.0.1
MONGO_URI=mongodb+srv://<user>:<password>@cluster.mongodb.net/live_tracker
JWT_SECRET=super_secret_jwt_key_change_in_production_32bytes_min
CORS_ORIGIN=http://127.0.0.1:5173
NODE_ENV=development
```

Start the Backend Server:

```bash
# Production mode
npm start

# Development mode with auto-reload
npm run dev
```

Run Automated API Integration Tests:

```bash
npm test
```

---

### 2. Admin Dashboard Setup

Navigate to the `admin-dashboard` folder and install dependencies:

```bash
cd admin-dashboard
npm install
```

Configure Environment Variables (`admin-dashboard/.env`):

```env
VITE_BACKEND_URL=http://127.0.0.1:8080
VITE_GOOGLE_MAPS_API_KEY=YOUR_GOOGLE_MAPS_API_KEY_HERE
```

Start the React Vite Development Server:

```bash
npm run dev
```

Build Production Web Bundle:

```bash
npm run build
```

---

### 3. Employee Mobile App Setup (Flutter)

Navigate to the `employee_app` folder:

```bash
cd employee_app
flutter pub get
```

Run the app on connected emulator or device:

```bash
flutter run
```

---

## API Documentation

### Authentication Endpoints

#### `POST /auth/register`
Registers a new user (Admin or Employee).

- **Request Body**:
  ```json
  {
    "name": "John Doe",
    "email": "employee@livetracker.com",
    "password": "Password123!",
    "role": "employee"
  }
  ```
- **Response (201 Created)**:
  ```json
  {
    "message": "User registered successfully",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6...",
    "user": {
      "id": "60d5ec49f1a2c82348a",
      "name": "John Doe",
      "email": "employee@livetracker.com",
      "role": "employee"
    }
  }
  ```

#### `POST /auth/login`
Authenticates a user and returns a Bearer JWT.

---

### Location Endpoints

#### `POST /location/update` (Employee Only)
Transmits current GPS coordinates. (Requires `Authorization: Bearer <Employee_JWT>`).

- **Request Body**:
  ```json
  {
    "latitude": 37.7749,
    "longitude": -122.4194
  }
  ```

#### `GET /location/all` (Admin Only)
Fetches real-time status and coordinates for all employees. (Requires `Authorization: Bearer <Admin_JWT>`).

#### `GET /location/:employeeId` (Admin Only)
Fetches tracking details for a specific employee.

---

## Security Audit Summary

- **Authentication**: JWT token validation using `HS256` with strict expiration checks and tamper protection.
- **Passwords**: Salted hashing with `bcryptjs` (10 rounds).
- **Data Protection**: Parameterized queries via Mongoose, input sanitization via `express-validator`.
- **Headers & CORS**: Guarded by `helmet()` security middleware and restrictive CORS origin policy.
