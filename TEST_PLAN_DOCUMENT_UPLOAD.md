# Document Upload Flow Redesign - Test Plan

## Test Environment Setup

1. **Start the development server**:
   ```bash
   npm run dev
   ```

2. **Access the application**: http://localhost:5000

3. **Navigate to**: Documents page or Crew Management → Upload Document

## Test Scenarios

### Test 1: Expired Document (BLOCKED) ❌

**Objective**: Verify that expired documents are rejected

**Steps**:
1. Click "Upload Document" or "Add Document"
2. Select document type (e.g., Passport)
3. Enter document number: `TEST123`
4. Enter issue date: `01/01/2020`
5. **Enter expiry date: `01/01/2023`** (expired)
6. Enter issuing authority: `Test Authority`
7. Click "Upload Document"

**Expected Result**:
- ❌ **ExpiredDocumentModal appears**
- Modal shows:
  - Red error icon
  - "Cannot Upload Expired Document" title
  - Document details (type, number, expiry date)
  - "Expired X days ago" status
  - Compliance warning message
  - Only "Close" button (no upload option)
- Document is **NOT** saved to database
- User must close modal and upload a valid document

**Verification**:
```sql
-- Check that no document was created
SELECT * FROM documents WHERE document_number = 'TEST123';
-- Should return 0 rows
```

---

### Test 2: Expiring Document (WARNING) ⚠️

**Objective**: Verify that expiring documents show warning but allow upload

**Steps**:
1. Click "Upload Document"
2. Select document type (e.g., CDC)
3. Enter document number: `CDC456`
4. Enter issue date: `01/01/2024`
5. **Enter expiry date: 45 days from today** (expiring soon)
6. Enter issuing authority: `Maritime Authority`
7. Click "Upload Document"

**Expected Result**:
- ⚠️ **ExpiringDocumentModal appears**
- Modal shows:
  - Amber warning icon
  - "Document Expiring Soon" title
  - Document details
  - "Expires in X days" status
  - Warning message about renewal
  - Two buttons: "Cancel" and "Proceed Anyway"

**Action**: Click "Proceed Anyway"

**Expected After Proceed**:
- Modal closes
- Document is **saved** to database
- Document status = `expiring`
- Success toast appears
- Renewal alert is created

**Verification**:
```sql
-- Check document was created with expiring status
SELECT * FROM documents WHERE document_number = 'CDC456';
-- Should show status = 'expiring'
```

---

### Test 3: Valid Document (NORMAL) ✅

**Objective**: Verify that valid documents upload normally

**Steps**:
1. Click "Upload Document"
2. Select document type (e.g., COC)
3. Enter document number: `COC789`
4. Enter issue date: `01/01/2024`
5. **Enter expiry date: 180 days from today** (valid)
6. Enter issuing authority: `Competency Board`
7. Click "Upload Document"

**Expected Result**:
- ✅ **No modal appears**
- Document is saved immediately
- Success toast: "Document uploaded successfully"
- Document status = `valid`
- No warnings or errors

**Verification**:
```sql
-- Check document was created with valid status
SELECT * FROM documents WHERE document_number = 'COC789';
-- Should show status = 'valid'
```

---

### Test 4: Edge Case - Exactly 90 Days (BOUNDARY)

**Objective**: Test the 90-day boundary condition

**Steps**:
1. Upload document with expiry date = **exactly 90 days from today**

**Expected Result**:
- ⚠️ **ExpiringDocumentModal appears** (90 days is the threshold)
- Shows "Expires in 90 days"
- User can proceed with warning

---

### Test 5: Edge Case - Missing Expiry Date

**Objective**: Test handling of documents without expiry dates

**Steps**:
1. Upload document without entering expiry date
2. Leave expiry date field empty

**Expected Result**:
- Form validation error (required field)
- Cannot submit until expiry date is entered

---

### Test 6: Document Update with Expired Date

**Objective**: Verify that updating to an expired date is also blocked

**Steps**:
1. Find an existing valid document
2. Click "Edit"
3. Change expiry date to a past date
4. Click "Save Changes"

**Expected Result**:
- ❌ **ExpiredDocumentModal appears**
- Update is **blocked**
- Document retains original expiry date

---

## Backend API Testing

### Test API Endpoint Directly

**Test Expired Document**:
```bash
curl -X POST http://localhost:5000/api/documents \
  -H "Content-Type: application/json" \
  -d '{
    "type": "passport",
    "documentNumber": "API-TEST-1",
    "issueDate": "2020-01-01",
    "expiryDate": "2023-01-01",
    "issuingAuthority": "Test",
    "crewMemberId": "<valid-crew-id>"
  }'
```

**Expected Response**:
```json
{
  "error": "EXPIRED_DOCUMENT",
  "message": "Cannot upload expired document",
  "expiryDate": "2023-01-01T00:00:00.000Z",
  "daysExpired": 1095,
  "validationMessage": "Document expired 1095 days ago"
}
```

**Status Code**: `400 Bad Request`

---

## Visual Verification Checklist

### ExpiredDocumentModal
- [ ] Red error icon displayed
- [ ] Clear error title
- [ ] Document details shown correctly
- [ ] Days expired calculated correctly
- [ ] Compliance warning message visible
- [ ] Only "Close" button present
- [ ] Modal styling is clean and professional

### ExpiringDocumentModal
- [ ] Amber warning icon displayed
- [ ] Warning title clear
- [ ] Days remaining calculated correctly
- [ ] Both "Cancel" and "Proceed Anyway" buttons present
- [ ] Warning message explains the situation
- [ ] Modal styling is clean and professional

### General UI
- [ ] Modals appear centered on screen
- [ ] Modals are responsive (mobile/tablet/desktop)
- [ ] Text is readable and well-formatted
- [ ] Colors match the design system
- [ ] Animations are smooth

---

## Regression Testing

Ensure existing functionality still works:

1. **Normal document upload** (valid dates) - Should work as before
2. **Document editing** (valid dates) - Should work as before
3. **Document deletion** - Should work as before
4. **Document viewing** - Should work as before
5. **OCR extraction** - Should still work in background

---

## Performance Testing

1. **Upload speed**: Should not be noticeably slower
2. **Modal rendering**: Should appear instantly
3. **Validation**: Should be fast (< 100ms)

---

## Browser Compatibility

Test in:
- [ ] Chrome
- [ ] Firefox
- [ ] Safari
- [ ] Edge

---

## Test Results Template

```
Test Date: ___________
Tester: ___________

Test 1 (Expired): ☐ PASS ☐ FAIL
Notes: _______________________________

Test 2 (Expiring): ☐ PASS ☐ FAIL
Notes: _______________________________

Test 3 (Valid): ☐ PASS ☐ FAIL
Notes: _______________________________

Test 4 (90 Days): ☐ PASS ☐ FAIL
Notes: _______________________________

Test 5 (Missing): ☐ PASS ☐ FAIL
Notes: _______________________________

Test 6 (Update): ☐ PASS ☐ FAIL
Notes: _______________________________

Overall: ☐ READY FOR PRODUCTION ☐ NEEDS FIXES
```

---

## Known Issues / Notes

- None currently

---

## Next Steps After Testing

1. Fix any issues found during testing
2. Update documentation if needed
3. Deploy to production
4. Monitor for any issues
5. Gather user feedback
