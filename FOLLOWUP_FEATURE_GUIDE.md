# Return / Follow-up Patient Queue Feature

## Overview

This document describes the new Return/Follow-up Patient Queue feature added to the RHU II Patient Queuing System. This feature allows patients who have already been seen by the doctor to temporarily leave for laboratory, pharmacy, X-ray, or other procedures and return to the doctor without waiting behind newly queued patients.

## Feature Summary

**What was added:**
- Separate Return/Follow-up patient queue that operates independently from the normal queue
- Doctor can send currently serving patients to follow-up with specific reasons
- Staff can mark follow-up patients as "Ready for Doctor" when procedures are completed
- Doctor can call follow-up patients back when ready
- Public display shows follow-up patients separately from normal queue
- Follow-up patients maintain their original queue number and don't get renumbered

**What was NOT changed:**
- All existing queue logic remains unchanged
- Normal patient registration process unchanged
- Existing queue numbering system unchanged
- Existing patient sorting/order unchanged
- Currently serving logic unchanged
- Next patient logic unchanged
- Waiting queue logic unchanged
- Skip logic unchanged
- Recall logic unchanged
- Finish consultation logic unchanged
- Doctor workflow unchanged (except for new button)
- Admin workflow unchanged
- BHW workflow unchanged
- Existing HTML structure (except for new sections)
- Existing CSS design (except for new styles)
- Existing JavaScript functions (except for new additions)
- Existing PHP/API behavior (except for new endpoints)

## Database Changes

### New Columns Added to Patients Table

**FILE:** `backend/database/schema.sql`

**What was changed:**
- Added `follow_up_status` column (VARCHAR(20), default 'none')
- Added `follow_up_reason` column (VARCHAR(50), nullable)
- Updated status constraint to include 'follow-up'
- Added follow-up status constraint with values: 'none', 'needs_lab', 'ready_for_doctor'

**Why it was changed:**
- To track patients who are in the follow-up queue separately from normal queue
- To store the reason for follow-up (Laboratory, Pharmacy, X-Ray, Other)
- To track the current status of follow-up patients (waiting for procedure vs ready for doctor)

### Migration Script

**FILE:** `backend/database/migration_add_followup.sql`

**What was changed:**
- Created migration script to add new columns to existing databases
- Added proper constraints and indexes for follow-up functionality

**Why it was changed:**
- To allow existing installations to add the new feature without recreating the database
- To ensure database compatibility for existing users

## API Changes

### New API Endpoints

**FILE:** `backend/api_postgres.php`

**What was changed:**
- Updated `loadStateFromDatabase()` to include follow-up fields in patient data
- Updated `savePatientToDatabase()` to save follow-up fields
- Added `send-to-followup` action: moves patient to follow-up status with reason
- Added `ready-for-doctor` action: marks follow-up patient as ready for doctor
- Added `call-followup` action: calls follow-up patient back to serving status

**Why it was changed:**
- To support the new follow-up workflow through the existing API structure
- To maintain backward compatibility with existing API behavior
- To handle the different states of follow-up patients

## Frontend Changes

### JavaScript Helper Functions

**FILE:** `app.js`

**What was changed:**
- Added `getFollowUpPatients()` function to filter patients with follow-up status
- Updated `renderPatientBoard()` to render follow-up section in patient display
- Updated `renderDoctorQueue()` to show follow-up patients separately from normal queue
- Added event handlers for new follow-up buttons and modal

**Why it was changed:**
- To separate follow-up patients from normal queue in the UI
- To provide the necessary UI controls for the follow-up workflow
- To maintain existing rendering logic while adding new display sections

### Doctor Panel Changes

**FILE:** `doctor.html`

**What was changed:**
- Added "Send to Follow-up" button to the toolbar
- Added follow-up reason selection modal
- Added "Return / Follow-up Patients" section

**Why it was changed:**
- To give the doctor an interface to send patients to follow-up
- To allow selection of follow-up reason
- To display follow-up patients separately from normal queue

### Patient Display Changes

**FILE:** `index.html`

**What was changed:**
- Added "RETURN / FOLLOW-UP" section
- Added list container for follow-up patients

**Why it was changed:**
- To show patients waiting for follow-up procedures separately from normal queue
- To communicate to other patients why some patients may be called out of order

### CSS Styling Changes

**FILE:** `styles.css`

**What was changed:**
- Added `.badge.follow-up` style (yellow/gold background)
- Added `.badge.ready` style (green background)
- Added `.btn-info` style (blue background for follow-up button)

**Why it was changed:**
- To visually distinguish follow-up patients from normal queue patients
- To provide appropriate styling for the new button and badges
- To maintain visual consistency with existing design

## How the Feature Works

### Workflow 1: Doctor Sends Patient to Follow-up

1. Doctor is currently serving Patient 1
2. Doctor determines Patient 1 needs laboratory work
3. Doctor clicks "Send to Follow-up" button
4. Modal appears asking for follow-up reason
5. Doctor selects "Laboratory" and confirms
6. Patient 1 is moved to follow-up status with reason "Laboratory"
7. Patient 1 no longer appears as currently serving
8. Normal queue continues (Patient 2 can be served next)

### Workflow 2: Staff Marks Patient as Ready

1. Patient 1 completes laboratory procedure
2. Staff member (or doctor) clicks "Ready for Doctor" button on Patient 1
3. Patient 1's follow-up status changes to "ready_for_doctor"
4. Public display shows "✓ Laboratory Completed - Ready for Doctor"
5. Patient 1 appears in the "Call Patient" section for the doctor

### Workflow 3: Doctor Calls Follow-up Patient

1. Doctor sees Patient 1 in "Return / Follow-up Patients" section
2. Doctor clicks "Call Patient" button
3. Any currently serving normal patient is completed/moved to history
4. Patient 1 becomes the currently serving patient
5. Doctor completes the follow-up consultation
6. Patient 1 is moved to consultation history using existing finish logic

## Queue Separation

### Normal Queue (Unchanged)
- Contains patients waiting for their first consultation
- Operates exactly as before
- Sequential queue numbering (Patient 2, Patient 3, etc.)
- Normal serving/skip/recall/finish logic

### Return/Follow-up Queue (New)
- Contains patients who have had initial consultation and need procedures
- Separate from normal queue
- Maintains original queue number (Patient 1 stays Patient 1)
- Different serving logic (can be called independently)
- Does not affect normal queue numbering

## Important Queue Rules

1. **Follow-up patients never rejoin the normal queue**
   - They maintain their original queue number
   - They don't get new queue numbers
   - They don't wait behind newly registered patients

2. **Normal queue operates independently**
   - Follow-up operations don't affect normal queue order
   - Normal queue continues sequentially regardless of follow-up activity

3. **Only one patient serves at a time**
   - Follow-up patients use the existing "currently serving" mechanism
   - When calling a follow-up patient, any current serving patient is completed first

4. **Follow-up completion uses existing logic**
   - When doctor finishes follow-up consultation, existing finish logic is used
   - Patient is moved to consultation history normally

## Data Structure Changes

### Patient Object (Minimal Addition)

**New fields added to existing patient object:**
```javascript
{
  // ... existing fields unchanged ...
  followUpStatus: 'none' | 'needs_lab' | 'ready_for_doctor',
  followUpReason: 'Laboratory' | 'Pharmacy' | 'X-Ray' | 'Other' | ''
}
```

**Why minimal changes:**
- Only two new fields added to existing patient structure
- Existing fields remain unchanged
- No restructuring of patient data model
- Backward compatible with existing code

## Status Flow

### Normal Patient Status Flow (Unchanged)
```
waiting → serving → [consultation history]
waiting → skipped → waiting
```

### Follow-up Patient Status Flow (New)
```
serving → follow-up (needs_lab) → follow-up (ready_for_doctor) → serving → [consultation history]
```

## Button Reference

### Doctor Panel Buttons

**Existing buttons (unchanged):**
- Next Patient: Calls next normal patient
- Recall: Recalls a skipped patient
- Skip: Skips current patient
- Finish: Completes current patient consultation

**New buttons:**
- Send to Follow-up: Opens modal to send current patient to follow-up
- Ready for Doctor: Marks follow-up patient as ready (for staff use)
- Call Patient: Calls a ready follow-up patient back to serving

## Testing the Feature

### Test Scenario 1: Basic Follow-up Flow

1. Register Patient 1 and Patient 2
2. Serve Patient 1
3. Send Patient 1 to follow-up (Laboratory)
4. Verify Patient 1 appears in follow-up section
5. Verify Patient 2 can be served normally
6. Mark Patient 1 as ready for doctor
7. Call Patient 1 back
8. Complete Patient 1 consultation
9. Verify Patient 1 is in consultation history

### Test Scenario 2: Multiple Follow-up Patients

1. Send multiple patients to follow-up with different reasons
2. Verify they appear in follow-up section with correct reasons
3. Mark them ready at different times
4. Call them back in any order
5. Verify normal queue is unaffected

### Test Scenario 3: Queue Number Preservation

1. Register Patient 1, Patient 2, Patient 3
2. Send Patient 1 to follow-up
3. Register Patient 4, Patient 5
4. Call Patient 1 back
5. Verify Patient 1 still has queue number 1
6. Verify Patient 4 has queue number 4

## Troubleshooting

### Issue: Follow-up section not appearing
**Solution:** Ensure database migration has been run and columns exist

### Issue: Follow-up button not working
**Solution:** Check browser console for JavaScript errors, verify API endpoint is responding

### Issue: Follow-up patients appearing in normal queue
**Solution:** Check that `getFollowUpPatients()` function is working correctly and status filtering is applied

### Issue: Queue numbers changing for follow-up patients
**Solution:** Verify that follow-up logic doesn't modify queue numbers, only status

## Database Port Configuration

**Note:** You mentioned setting up port 8080. The database configuration has been kept at the default PostgreSQL port 5432. If you need to change the database port, you can:

1. Set the `DB_PORT` environment variable to 8080
2. Or modify the default in `backend/database/config.php`

The database port is separate from your web server port.

## Backward Compatibility

All changes are designed to be backward compatible:

- Existing installations can run the migration script
- New database columns have default values
- New API endpoints don't interfere with existing ones
- Frontend gracefully handles missing follow-up data
- Normal queue operations continue unchanged

## Files Modified Summary

1. **backend/database/schema.sql** - Added follow-up columns and constraints
2. **backend/database/migration_add_followup.sql** - Migration script for existing databases
3. **backend/database/config.php** - No functional changes (port noted for user info)
4. **backend/api_postgres.php** - Added follow-up API endpoints and updated patient loading/saving
5. **app.js** - Added follow-up helper functions and event handlers
6. **doctor.html** - Added follow-up button, modal, and section
7. **index.html** - Added follow-up display section
8. **styles.css** - Added follow-up button and badge styles

## Conclusion

The Return/Follow-up Patient Queue feature has been successfully added to your existing RHU II Patient Queuing System with minimal changes to your current codebase. All existing functionality remains unchanged, and the new feature operates independently using the existing architecture and patterns.