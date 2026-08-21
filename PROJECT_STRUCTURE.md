# RHU II Patient Queuing System - Project Structure

## Overview
The project has been reorganized for better scalability, maintainability, and debugging capabilities.

## Directory Structure

```
QUEUING-SYSTEM/
├── backend/                    # Server-side PHP files
│   ├── api_postgres.php       # Main API endpoint (PostgreSQL)
│   ├── config.php             # Database configuration
│   ├── Database.php           # Database connection class
│   ├── schema.sql             # Database schema
│   └── migration_add_followup.sql  # Database migrations
├── public/                     # Public-facing files
│   ├── index.html             # Patient display panel
│   ├── admin.html             # Admin management panel
│   ├── doctor.html            # Doctor panel
│   ├── bhw.html               # Barangay Health Worker panel
│   └── assets/                # Static assets
│       ├── app.js             # Main JavaScript application
│       ├── styles.css         # Main stylesheet
│       └── logo.png           # Application logo
├── docs/                       # Documentation
│   ├── README.md              # Main documentation
│   ├── SETUP.md               # Setup instructions
│   ├── TESTING_GUIDE.md      # Testing guide
│   ├── TESTING_SUMMARY.md    # Testing summary
│   ├── FOLLOWUP_FEATURE_GUIDE.md  # Follow-up feature guide
│   └── LAN_SETUP_GUIDE.md    # LAN setup guide
├── tests/                      # Testing files
│   ├── test_api.php           # API testing script
│   ├── test_db.php            # Database connection test
│   ├── test_db_connection.php # Database connection diagnostics
│   ├── test_frontend.html     # Frontend testing
│   ├── test_lan.php           # LAN connectivity test
│   ├── test_login_api.php     # Login API test
│   └── test_data.sql          # Test data
├── .env                        # Environment variables (not in git)
├── .env.example               # Environment variables template
├── .gitignore                 # Git ignore rules
├── index.php                  # Root redirect to public folder
└── start-queue.bat           # Startup script for Windows
```

## Key Changes Made

### 1. File Organization
- **Public files moved to `public/`**: All HTML files are now in the public directory for better security and separation of concerns
- **Assets consolidated**: JavaScript, CSS, and images are in `public/assets/`
- **Documentation organized**: All documentation files moved to `docs/`
- **Tests isolated**: All testing files moved to `tests/`
- **Backend simplified**: Database files moved from `backend/database/` to `backend/` root

### 2. Removed Files
- `backend/api.php` (legacy JSON API - no longer needed)
- `backend/database/` directory (consolidated)
- `src/` directory (moved assets to public)
- `frontend/` directory (was empty)

### 3. Updated References
- All HTML files now reference assets with correct paths (`assets/` instead of root)
- JavaScript API calls updated to work with new structure
- Test files updated to reference correct file paths
- Startup script configured to serve from project root with redirect

### 4. Enhanced Configuration
- Updated `.gitignore` to exclude sensitive config files
- Added `index.php` redirect for clean root URL access
- Updated startup script to work with new structure

## Benefits of New Structure

### Scalability
- Clear separation between public and private files
- Easy to add new features in organized directories
- Simple to scale backend or frontend independently

### Debugging
- Logical file organization makes issues easier to locate
- Test files isolated for easy debugging
- Documentation centralized for reference

### Security
- Sensitive files in backend not directly accessible
- Public files separated from application logic
- Proper .gitignore for sensitive configuration

### Maintenance
- Clear file naming and organization
- Easy to onboard new developers
- Simplified deployment process

## Access Points

- **Main Application**: `http://localhost:8000/` (redirects to public/index.html)
- **Admin Panel**: `http://localhost:8000/public/admin.html`
- **Doctor Panel**: `http://localhost:8000/public/doctor.html`
- **BHW Panel**: `http://localhost:8000/public/bhw.html`
- **API Tests**: `http://localhost:8000/tests/test_api.php`

## Running the Application

Use the provided startup script:
```bash
start-queue.bat
```

This will start the PHP server and display the local IP address for LAN access.