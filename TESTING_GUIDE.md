# RHU II Patient Queuing System - Testing Guide

This comprehensive testing guide covers both manual and automated testing procedures for the RHU II Patient Queuing System with PostgreSQL integration.

## 📋 Prerequisites for Testing

### Required Software:
- **PHP 7.4+** with PDO PostgreSQL extension
- **PostgreSQL 12+** installed and running
- **Web Server** (Apache, Nginx, or PHP built-in server)
- **Modern web browser** (Chrome, Firefox, Edge, Safari)

### Database Setup:
1. Create database: `rhu_queue_system`
2. Run schema: `backend/database/schema.sql`
3. Configure credentials in `.env` file or `backend/database/config.php`

## 🧪 Testing Tools Provided

### 1. Database Connection Test
**File:** `test_db.php`
**Purpose:** Test PostgreSQL database connection and basic functionality

**How to run:**
```bash
# Start PHP server
php -S localhost:8000

# Open in browser
http://localhost:8000/test_db.php
```

**Expected Results:**
- ✅ Database connection successful
- ✅ All tables exist (patients, consultation_history, queue_management)
- ✅ Can read/write test data
- ✅ No connection errors

### 2. API Testing Script
**File:** `backend/database/test_api.php`
**Purpose:** Test both JSON and PostgreSQL API endpoints

**How to run:**
```bash
# Access in browser
http://localhost:8000/backend/database/test_api.php
```

**Features:**
- Test JSON backend (`?backend=json`)
- Test PostgreSQL backend (`?backend=postgres`)
- Test all API endpoints
- Check response formats
- Validate error handling

### 3. Frontend Testing Suite
**File:** `test_frontend.html`
**Purpose:** Comprehensive frontend JavaScript and HTML testing

**How to run:**
```bash
# Access in browser
http://localhost:8000/test_frontend.html
```

**Features:**
- HTML structure validation
- API integration tests
- JavaScript function tests
- Real-time sync testing
- Responsive design checks
- Authentication testing

### 4. Test Data Script
**File:** `backend/database/test_data.sql`
**Purpose:** Insert sample data for testing

**How to run:**
```bash
psql -U postgres -d rhu_queue_system -f backend/database/test_data.sql
```

**Or via pgAdmin:**
- Open Query Tool
- Copy and paste contents of `test_data.sql`
- Execute

## 📝 Manual Testing Procedures

### Phase 1: Database Setup Testing

#### Test 1.1: Database Connection
1. Open `test_db.php` in browser
2. Verify all checks pass
3. **Expected:** Green checkmarks for all tests

#### Test 1.2: Schema Installation
1. Connect to PostgreSQL via pgAdmin or command line
2. Run `backend/database/schema.sql`
3. **Expected:** No errors, 3 tables created
4. Verify tables exist:
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public';
   ```

#### Test 1.3: Test Data Insertion
1. Run `backend/database/test_data.sql`
2. **Expected:** 6 test patients, 3 consultation history entries
3. Verify data:
   ```sql
   SELECT COUNT(*) FROM patients WHERE name LIKE 'Test%';
   SELECT COUNT(*) FROM consultation_history WHERE name LIKE 'Completed%';
   ```

### Phase 2: Backend API Testing

#### Test 2.1: JSON Backend (Legacy)
1. Open `backend/database/test_api.php?backend=json`
2. Click "Run Add Patient Test"
3. **Expected:** Patient added successfully
4. Check `backend/queue.json` file updated

#### Test 2.2: PostgreSQL Backend (New)
1. Open `backend/database/test_api.php?backend=postgres`
2. Click "Run Add Patient Test"
3. **Expected:** Patient added successfully
4. Verify in database:
   ```sql
   SELECT * FROM patients ORDER BY queue_number DESC LIMIT 1;
   ```

#### Test 2.3: API Endpoint Testing
1. Test GET request: Visit `backend/api_postgres.php`
2. **Expected:** JSON response with success: true and state object
3. Test POST with invalid data
4. **Expected:** Appropriate error response

### Phase 3: Frontend Integration Testing

#### Test 3.1: Patient Display (index.html)
1. Open `index.html` in browser
2. **Expected:**
   - RHU II branding displayed
   - Live clock working
   - "Waiting for first patient" message
   - No JavaScript errors in console

#### Test 3.2: Admin Panel (admin.html)
1. Open `admin.html`
2. **Expected:**
   - Login form displayed
   - Navigation links work
   - Login form validation works

#### Test 3.3: Admin Authentication
1. Login with username: `admin`, password: `admin123`
2. **Expected:** Successful login, admin panel appears
3. Try wrong credentials
4. **Expected:** Login failed with error message

#### Test 3.4: Patient Registration
1. Log in as admin
2. Fill patient form:
   - Name: "Test Patient"
   - PhilHealth ID: "TEST123"
   - Status: "Regular"
   - PhilHealth: "Registered"
3. Click "Add Patient"
4. **Expected:**
   - Patient appears in patient list
   - Queue number assigned sequentially
   - No page reload needed

#### Test 3.5: Queue Management
1. Click "Serve" on a patient
2. **Expected:** Patient status changes to "serving"
3. Click "Finish" on serving patient
4. **Expected:** Patient moves to consultation history
5. Click "Skip" on a patient
6. **Expected:** Patient status changes to "skipped"
7. Click "Recall" on skipped patient
8. **Expected:** Patient returns to "waiting"

#### Test 3.6: Doctor Panel (doctor.html)
1. Open `doctor.html`
2. **Expected:** Doctor interface loads
3. Serve a patient
4. **Expected:** Patient appears in doctor's current patient section
5. Add ICD code and consultation details
6. Click "Finish"
7. **Expected:** Consultation saved with details

#### Test 3.7: BHW Panel (bhw.html)
1. Open `bhw.html`
2. **Expected:** Simplified interface loads
3. Add patient as BHW
4. **Expected:** Patient added successfully

### Phase 4: Real-time Features Testing

#### Test 4.1: Multi-tab Sync
1. Open `index.html` in two browser tabs
2. Add patient in admin panel
3. **Expected:** Both tabs update simultaneously
4. Check console for BroadcastChannel messages

#### Test 4.2: LocalStorage Sync
1. Add patient
2. Refresh page
3. **Expected:** Patient list persists
4. Check browser localStorage for queue-state-sync

### Phase 5: Database Persistence Testing

#### Test 5.1: Data Persistence
1. Add several patients
2. Complete some consultations
3. Stop server
4. Restart server
5. **Expected:** All data persists in database

#### Test 5.2: Data Verification
1. Check database directly:
   ```sql
   SELECT * FROM patients;
   SELECT * FROM consultation_history;
   ```
2. **Expected:** All data matches what was entered via UI

### Phase 6: Error Handling Testing

#### Test 6.1: Invalid Input
1. Try adding patient without name
2. **Expected:** Validation error, no patient added
3. Try negative queue numbers (if possible)
4. **Expected:** Appropriate error handling

#### Test 6.2: Database Connection Failure
1. Stop PostgreSQL service
2. Try using application
3. **Expected:** Graceful error message
4. Restart PostgreSQL
5. **Expected:** Application recovers

#### Test 6.3: Network Errors
1. Disconnect network (if testing locally)
2. Try API calls
3. **Expected:** Appropriate error handling
4. Reconnect network
5. **Expected:** Application recovers

### Phase 7: Cross-browser Testing

Test the application in:
- ✅ Chrome/Edge (Chromium)
- ✅ Firefox
- ✅ Safari (if available)
- ✅ Mobile browsers (if possible)

**Expected:** Consistent functionality across browsers

### Phase 8: Performance Testing

#### Test 8.1: Load Testing
1. Add 50+ patients
2. Navigate between pages
3. **Expected:** UI remains responsive
4. Check database query performance

#### Test 8.2: Concurrent Users
1. Open multiple tabs
2. Perform simultaneous operations
3. **Expected:** No data corruption
4. Proper locking behavior

## 🐛 Common Issues and Solutions

### Issue: "Database connection failed"
**Solution:**
- Verify PostgreSQL is running
- Check credentials in config
- Ensure database exists
- Test with `test_db.php`

### Issue: "Table does not exist"
**Solution:**
- Run schema.sql again
- Check for error messages
- Verify you're connected to correct database

### Issue: "PHP PostgreSQL extension not found"
**Solution:**
- Enable extension in php.ini: `extension=pdo_pgsql`
- Restart web server
- Verify with `php -m | grep pdo`

### Issue: "API returns 500 error"
**Solution:**
- Check PHP error logs
- Verify file permissions
- Test with `test_api.php`

### Issue: "Frontend not updating"
**Solution:**
- Check browser console for errors
- Verify API endpoint is correct
- Check network tab in developer tools

## 📊 Test Results Documentation

### Test Checklist
Use this checklist to track testing progress:

- [ ] Database connection established
- [ ] Schema installed successfully
- [ ] Test data inserted
- [ ] JSON API working
- [ ] PostgreSQL API working
- [ ] Patient display loads
- [ ] Admin authentication works
- [ ] Patient registration works
- [ ] Queue management works
- [ ] Doctor panel functions
- [ ] BHW panel functions
- [ ] Real-time sync works
- [ ] Data persists correctly
- [ ] Error handling works
- [ ] Cross-browser compatible
- [ ] Performance acceptable

### Expected Test Results Summary

**Database Tests:**
- Connection: ✅ Success
- Schema: ✅ 3 tables created
- Test Data: ✅ 6 patients, 3 history entries

**API Tests:**
- JSON Backend: ✅ All endpoints functional
- PostgreSQL Backend: ✅ All endpoints functional
- Error Handling: ✅ Proper error responses

**Frontend Tests:**
- Page Load: ✅ All pages load correctly
- Authentication: ✅ Login/logout works
- Patient Management: ✅ CRUD operations work
- Queue Management: ✅ Serve/finish/skip works
- Real-time: ✅ Multi-tab sync works

**Integration Tests:**
- End-to-End: ✅ Complete workflow works
- Data Persistence: ✅ Database stores correctly
- Error Recovery: ✅ Graceful error handling

## 🚀 Deployment Testing

Before deploying to production:

1. **Security Testing:**
   - [ ] Change default admin password
   - [ ] Use environment variables for credentials
   - [ ] Enable HTTPS
   - [ ] Implement proper session management

2. **Performance Testing:**
   - [ ] Test with expected user load
   - [ ] Monitor database performance
   - [ ] Optimize slow queries
   - [ ] Set up database indexing

3. **Backup Testing:**
   - [ ] Test database backup procedures
   - [ ] Verify restore process
   - [ ] Set up automated backups

4. **Monitoring:**
   - [ ] Set up error logging
   - [ ] Monitor database connections
   - [ ] Track application performance

## 📞 Support and Troubleshooting

If tests fail:
1. Check browser console for JavaScript errors
2. Review PHP error logs
3. Verify PostgreSQL logs
4. Test components individually
5. Check network connectivity
6. Verify file permissions

## ✅ Success Criteria

The testing is considered successful when:
- All database tests pass
- Both JSON and PostgreSQL APIs work correctly
- All frontend pages load and function properly
- Real-time synchronization works across tabs
- Data persists correctly in the database
- Error handling is graceful
- Application performs acceptably under load
- Cross-browser compatibility is confirmed

---

**Note:** This testing guide assumes a local development environment. For production deployment, additional security, performance, and scalability testing should be conducted.