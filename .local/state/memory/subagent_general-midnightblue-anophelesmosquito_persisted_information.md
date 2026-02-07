# Date Formatting Task Progress

## Task
Update all date formatting in 5 files to use `formatDate()` from '@/lib/utils' instead of `.toLocaleDateString()`.

## Completed

### 1. crew-table.tsx - DONE
- Import added ✓
- All 14 occurrences replaced ✓

### 2. crew-management-dialog.tsx - DONE
- Import added ✓
- All 8 occurrences replaced ✓

### 3. app-layout.tsx - NEEDS REPLACEMENT
- Import added ✓
- Still need to replace line 170: `new Date(alert.document.expiryDate).toLocaleDateString()`

### 4. contract-status-badges.tsx - NEEDS REPLACEMENTS
- Import added ✓
- Still need to replace lines 197-198:
  - `new Date(contract.startDate).toLocaleDateString()`
  - `new Date(contract.endDate).toLocaleDateString()`

### 5. ex-hand.tsx - NEEDS REPLACEMENTS
- Import added ✓
- Still need to replace 2 occurrences:
  - Line ~469: `history.leaveDate ? new Date(history.leaveDate).toLocaleDateString() : 'N/A'` (in desktop table)
  - Line ~573: `member.signOffDate ? new Date(member.signOffDate).toLocaleDateString() : 'N/A'`

## Next Steps
1. Use grep to find exact context for remaining replacements in:
   - ex-hand.tsx (2 occurrences)
   - app-layout.tsx (1 occurrence)  
   - contract-status-badges.tsx (2 occurrences)
2. Make edits with more context to uniquely identify each occurrence
3. Verify no remaining toLocaleDateString calls in any of the 5 files
