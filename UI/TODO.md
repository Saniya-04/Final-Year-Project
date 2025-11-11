# TODO List for Web Dashboard

## Backend Setup

- [x] Initialize Node.js/Express server in UI folder
- [x] Install backend dependencies (express, mongoose, cors, dotenv)
- [x] Create MongoDB connection and schema for processed_data collection
- [x] Implement API endpoints:
  - [x] GET /api/local/:systemId - Fetch data for local user (average RAM, per-program)
  - [x] GET /api/admin - Fetch data for admin (average across systems, per-system comparison)
  - [x] GET /api/alerts - Fetch alerts for memory leaks/abnormal patterns
- [x] Add data processing logic for averages, charts, and alert detection

## Frontend Setup

- [x] Initialize React app in UI folder
- [x] Install frontend dependencies (react-router-dom, recharts, axios, bootstrap or similar for styling)
- [x] Create component structure:
  - [x] App.js with routing
  - [x] Login.js for role selection
  - [x] LocalDashboard.js (average RAM, per-program line chart)
  - [x] AdminDashboard.js (average usage, per-system comparison)
  - [x] AlertComponent.js for displaying alerts
  - [x] Chart components using recharts
- [x] Implement navigation between views
- [x] Add API calls to fetch and display data
- [x] Style the dashboard for user-friendliness

## Testing and Finalization

- [x] Test backend API endpoints
- [x] Test frontend components and navigation
- [x] Ensure alerts are shown for leaks/abnormal patterns
- [x] Run the full app and verify functionality

## UI/UX Improvements

- [x] Improve CSS with modern styling, gradients, and animations
- [x] Add Font Awesome icons for better visual appeal
- [x] Enhance login page with header and better layout
- [x] Update dashboard components with icons, better cards, and visual hierarchy
- [x] Add Bootstrap and Font Awesome to HTML
- [x] Improve chart styling and responsiveness
