# Axon Phase 3 - Testing Instructions

This document provides comprehensive testing instructions for Phase 3 features: Device Linking, Camera, and Gallery.

---

## Prerequisites

### Backend Setup

1. **Install Dependencies**
   ```bash
   cd axon-backend
   pip install -r requirements.txt
   ```

2. **Run Database Migrations**
   ```bash
   # Connect to your Supabase project and run:
   # migrations/0004_phase3_updates.sql
   ```
   
   Or via Supabase Dashboard:
   - Go to SQL Editor
   - Copy contents of `migrations/0004_phase3_updates.sql`
   - Execute the SQL

3. **Configure Supabase Storage**
   - Go to Supabase Dashboard → Storage
   - Create a new bucket called `photos`
   - Set bucket to **Public** (or configure RLS policies)
   - Enable image transformations (optional)

4. **Environment Variables**
   Verify `.env` has:
   ```bash
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

5. **Start Backend**
   ```bash
   uvicorn app.main:app --reload --port 8000
   ```

### Frontend Setup

1. **Install Dependencies**
   ```bash
   cd axon-frontend
   npm install
   ```
   
   This will install:
   - `qrcode.react` - QR code generation

2. **Environment Variables**
   Verify `.env` has:
   ```bash
   VITE_API_BASE_URL=http://localhost:8000
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

3. **Start Frontend**
   ```bash
   npm run dev
   ```
   
   App will be available at: `http://localhost:5173`

---

## Feature 1: Device Linking

### Test Flow: Mirror Startup (No Auth Required)

**Scenario:** Mirror generates QR code on first launch

1. **Open Mirror Interface**
   - Navigate to `http://localhost:5173`
   - If no user is authenticated, device linking screen should appear

2. **Verify QR Code Display**
   - QR code should appear in the center
   - Device code should be displayed (format: `AXN-XXXX`)
   - Status should show "Waiting for connection..."

3. **Check Backend**
   ```bash
   # API should have created a device code
   curl http://localhost:8000/v1/devices/codes \
     -X POST \
     -H "Content-Type: application/json"
   
   # Response should contain:
   # - id
   # - code (e.g., AXN-4832)
   # - status: "pending"
   # - expires_at (15 minutes from now)
   ```

### Test Flow: Phone Linking

**Scenario:** User scans QR code with phone

1. **Scan QR Code**
   - Use phone camera to scan QR code
   - Or manually navigate to: `http://localhost:5173/link/AXN-XXXX`

2. **Phone Linking Page**
   - Should see "Connect to Axon" page
   - Device code should be displayed prominently
   - "Sign in with Google" button should be visible

3. **Google Sign In**
   - Click "Sign in with Google"
   - Complete OAuth flow
   - Should redirect back to link page

4. **Verify Linking**
   - After OAuth, device should automatically link
   - Should see "Device linked successfully!" message
   - Redirect to home page

5. **Verify Mirror Updates**
   - Mirror should detect link within 3 seconds (polling)
   - Status should change to "Connected! Loading..."
   - Mirror should reload with user's display name in greeting

### Test API Endpoints

1. **Create Device Code**
   ```bash
   curl -X POST http://localhost:8000/v1/devices/codes \
     -H "Content-Type: application/json"
   ```
   
   Expected: `200 OK` with device code object

2. **Check Device Status**
   ```bash
   curl http://localhost:8000/v1/devices/codes/AXN-XXXX/status
   ```
   
   Expected: 
   - Initially: `{"status": "pending", "user_id": null}`
   - After linking: `{"status": "linked", "user_id": "...", "display_name": "..."}`

3. **Link Device (Authenticated)**
   ```bash
   curl -X POST http://localhost:8000/v1/devices/link \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -d '{"code": "AXN-XXXX"}'
   ```
   
   Expected: `200 OK` with success message

### Edge Cases

1. **Expired Code**
   - Wait 15 minutes
   - Code should show as expired
   - Should prompt to refresh

2. **Invalid Code**
   - Navigate to `/link/INVALID-CODE`
   - Should show "Invalid device code" error

3. **Already Linked Code**
   - Try to link same code twice
   - Should show "Device code already linked" error

---

## Feature 2: Camera

### Test Flow: Photo Capture

**Scenario:** User takes a photo

1. **Navigate to Camera**
   - Click "Camera" in sidebar
   - Or navigate to `/camera`

2. **Camera Permissions**
   - Browser should request camera permission
   - Grant permission
   - Live camera preview should appear

3. **Capture Photo**
   - Click the blue circular capture button
   - Camera should freeze on captured frame
   - Caption input should appear

4. **Add Caption (Optional)**
   - Enter caption (e.g., "Test Photo")
   - Or leave empty

5. **Save Photo**
   - Click "Save Photo"
   - Should show "Saving..." during upload
   - Should redirect to Gallery on success

6. **Verify Upload**
   - Check Supabase Storage → `photos` bucket
   - Should see two files:
     - `{user_id}/{timestamp}_photo.jpg` (original)
     - `{user_id}/thumbnails/{timestamp}_photo.jpg` (thumbnail)

### Test Flow: Retake Photo

1. **Capture Photo**
2. **Click "Retake"**
   - Camera should restart
   - Should return to live preview mode

### Test API Endpoints

1. **Upload Photo**
   ```bash
   curl -X POST http://localhost:8000/v1/photos \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
     -F "file=@test.jpg" \
     -F "caption=Test Photo"
   ```
   
   Expected: `200 OK` with photo object

### Edge Cases

1. **Camera Permission Denied**
   - Deny camera permission
   - Should show error message
   - Should offer "Go Back" button

2. **No Camera Available**
   - Test on device without camera
   - Should show appropriate error

3. **Large File Upload**
   - Try uploading >10MB image
   - Should show "Image too large" error

---

## Feature 3: Gallery

### Test Flow: View Photos

**Scenario:** User views their photo gallery

1. **Navigate to Gallery**
   - Click "Gallery" in sidebar
   - Or navigate to `/gallery`

2. **Verify Grid Layout**
   - Photos should display in responsive grid
   - 2 columns on mobile, 5+ on desktop
   - Thumbnails should load efficiently

3. **Empty State**
   - If no photos, should show "No photos yet"
   - Should show "Take Your First Photo" button

### Test Flow: View Photo Details

1. **Click Photo**
   - Modal should open
   - Photo should display at larger size
   - Caption and date should be visible

2. **Close Modal**
   - Click X button or outside modal
   - Should return to grid

### Test Flow: Photo Sharing

**Scenario:** User generates QR code to share photo

1. **Open Photo Details**
2. **Click "Share" Button**
   - QR code should appear
   - "Scan to download" text should show
   - "Expires in 24 hours" notice should display

3. **Scan QR Code**
   - Use phone to scan QR code
   - Should open signed URL in browser
   - Photo should download or display

4. **Hide QR Code**
   - Click "Share" button again (becomes "Hide QR Code")
   - QR code should disappear

### Test Flow: Delete Photo

1. **Open Photo Details**
2. **Click "Delete" Button**
   - Confirmation dialog should appear
3. **Confirm Deletion**
   - Photo should be removed from gallery
   - Modal should close
   - Grid should update (soft delete)

### Test Flow: Pagination

1. **Upload 25+ Photos**
2. **Scroll to Bottom**
   - "Load More" button should appear after 20 photos
3. **Click "Load More"**
   - Next 20 photos should load
   - Button should disappear if no more photos

### Test API Endpoints

1. **List Photos**
   ```bash
   curl http://localhost:8000/v1/photos?page=1&page_size=20 \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```
   
   Expected: `200 OK` with paginated photo list

2. **Get Photo**
   ```bash
   curl http://localhost:8000/v1/photos/PHOTO_ID \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```
   
   Expected: `200 OK` with photo object

3. **Delete Photo**
   ```bash
   curl -X DELETE http://localhost:8000/v1/photos/PHOTO_ID \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```
   
   Expected: `200 OK` with deleted photo object

4. **Create Share URL**
   ```bash
   curl -X POST http://localhost:8000/v1/photos/PHOTO_ID/share \
     -H "Authorization: Bearer YOUR_ACCESS_TOKEN"
   ```
   
   Expected: `200 OK` with signed URL and expiry

### Edge Cases

1. **Unauthorized Access**
   - Try accessing another user's photo
   - Should return 404 (RLS enforced)

2. **Invalid Photo ID**
   - Try accessing non-existent photo
   - Should return 404

3. **Expired Share URL**
   - Generate share URL
   - Wait 24+ hours
   - URL should be expired (Supabase handles this)

---

## Security Testing

### Row Level Security (RLS)

1. **Verify User Isolation**
   - Create photos with User A
   - Try to access with User B's token
   - Should return 404 or empty results

2. **Test Device Codes**
   - Device codes can be created without auth ✓
   - Device codes can be checked without auth ✓
   - Linking requires authentication ✓

### Authentication

1. **Protected Routes**
   - Try accessing `/camera` without auth
   - Should redirect to login or show auth error

2. **Protected API Endpoints**
   ```bash
   # Try without Authorization header
   curl http://localhost:8000/v1/photos
   ```
   
   Expected: `401 Unauthorized`

---

## Performance Testing

### Raspberry Pi Optimization

1. **Camera Performance**
   - Camera preview should maintain 30fps
   - Capture should be instant
   - Upload should complete within 5 seconds (on good connection)

2. **Gallery Performance**
   - Thumbnails should load lazy
   - Scrolling should be smooth (60fps)
   - Grid should render within 1 second

3. **Device Linking**
   - QR code should generate instantly
   - Polling should not cause UI lag

---

## Integration Testing

### End-to-End Flow

1. **Fresh Mirror Setup**
   - Clear browser storage
   - Navigate to mirror
   - Should see device linking screen

2. **Complete Device Link**
   - Scan QR code with phone
   - Sign in with Google
   - Verify mirror updates

3. **Take Photos**
   - Navigate to camera
   - Take 3-5 photos with captions
   - Save each photo

4. **View Gallery**
   - Navigate to gallery
   - Verify all photos appear
   - Open each photo detail

5. **Share Photos**
   - Generate QR codes for 2 photos
   - Scan with phone
   - Download photos to phone

6. **Delete Photos**
   - Delete 1 photo
   - Verify it's removed from gallery
   - Verify it's soft-deleted in database

---

## Troubleshooting

### Common Issues

1. **QR Code Not Displaying**
   - Check console for errors
   - Verify backend is running
   - Check device code API endpoint

2. **Camera Not Working**
   - Check browser permissions
   - Verify HTTPS or localhost (required for camera)
   - Check for camera access by other apps

3. **Photos Not Uploading**
   - Check Supabase Storage bucket exists
   - Verify bucket is public or has RLS policies
   - Check file size (<10MB)
   - Check network connection

4. **Gallery Empty**
   - Verify user is authenticated
   - Check RLS policies allow user to read own photos
   - Check console for API errors

5. **Device Not Linking**
   - Verify backend is running
   - Check device code hasn't expired
   - Verify OAuth redirect URL is correct
   - Check browser console for errors

### Debug Commands

```bash
# Check device codes in database
# Via Supabase Dashboard → SQL Editor:
SELECT * FROM device_codes ORDER BY created_at DESC LIMIT 10;

# Check photos in database
SELECT id, user_id, caption, created_at FROM photos 
WHERE deleted_at IS NULL 
ORDER BY created_at DESC LIMIT 10;

# Check Supabase Storage
# Via Dashboard → Storage → photos bucket

# Backend logs
# Check terminal running uvicorn for error messages
```

---

## Success Criteria

Phase 3 is complete when:

- ✅ Mirror can generate QR code on startup
- ✅ Phone can scan QR code and link device
- ✅ Mirror updates greeting after device link
- ✅ Camera can capture photos with live preview
- ✅ Photos upload with thumbnails to Supabase Storage
- ✅ Gallery displays photos in responsive grid
- ✅ Photos can be shared via QR code
- ✅ Photos can be deleted (soft delete)
- ✅ Pagination works for 20+ photos
- ✅ All endpoints respect RLS policies
- ✅ Performance is acceptable on Raspberry Pi

---

## Next Steps

After Phase 3 is complete:

1. **Phase 4:** Voice Assistant Integration
2. **Phase 5:** InterviewGPT Module
3. **Phase 6:** Face Recognition
4. **Phase 7:** Music Playback

---

**Last Updated:** June 20, 2026
