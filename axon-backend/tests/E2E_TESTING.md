# Axon E2E Testing Guide

## Running E2E Tests with Real Supabase

The `test_e2e.py` file contains a manual E2E test function that validates the complete user flow against a real Supabase instance.

### Prerequisites

1. **Supabase Project Setup**
   - Go to https://supabase.com/dashboard
   - Create a new project or use an existing test project
   - Apply all migrations from `axon-backend/migrations/`:
     ```bash
     # In Supabase SQL Editor, run in order:
     # 1. migrations/0001_init.sql
     # 2. migrations/0002_schema.sql
     # 3. migrations/0003_rls.sql
     ```

2. **Create Test User**
   - In Supabase Dashboard → Authentication → Users
   - Click "Add user" → Choose email authentication
   - Create user: `test@axon.dev` / `TestPassword123!`
   - Copy the UUID from the user's `id` column

3. **Configure Backend Environment**
   
   Update `axon-backend/.env`:
   ```bash
   SUPABASE_URL=https://your-project-ref.supabase.co
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   SUPABASE_JWT_SECRET=your-jwt-secret
   ```

   Get these values from:
   - Supabase Dashboard → Settings → API
   - `URL` = Project URL
   - `service_role` key = Service role (secret)
   - `JWT Secret` = JWT Secret (for HS256 verification)

### Running the E2E Test

```bash
cd axon-backend
.venv/Scripts/activate  # Windows
# source .venv/bin/activate  # macOS/Linux

python -c "
from tests.test_e2e import manual_e2e_with_real_supabase
manual_e2e_with_real_supabase(
    user_id='<PASTE_USER_UUID_HERE>',
    email='test@axon.dev'
)
"
```

### Expected Output

```
============================================================
AXON E2E TEST - Real Supabase Integration
============================================================

[1/6] Testing health endpoint...
✓ Health endpoint OK

[2/6] Creating test JWT...
✓ JWT created for user: test@axon.dev

[3/6] Loading user profile...
✓ Profile loaded: test (test@axon.dev)

[4/6] Loading user settings...
✓ Settings loaded: theme=black-mirror

[5/6] Updating theme to 'cyber'...
✓ Theme updated successfully

[6/6] Verifying persistence...
✓ Theme persisted across reload

[Cleanup] Restoring original theme: black-mirror...
✓ Cleanup complete

============================================================
ALL E2E TESTS PASSED ✓
============================================================
```

### What This Tests

✅ **Authentication**: JWT creation and verification  
✅ **Database Integration**: Real Supabase queries  
✅ **Profile Loading**: `GET /api/v1/users/me`  
✅ **Settings Loading**: `GET /api/v1/users/me/settings`  
✅ **Settings Update**: `PATCH /api/v1/users/me/settings`  
✅ **Data Persistence**: Settings survive backend restart  

### Automated Tests

The automated test suite (`pytest tests/`) runs without Supabase and validates:
- Health endpoints
- System endpoints  
- Authentication rejection (401 without token)
- Placeholder endpoints (501 responses)

```bash
pytest tests/ -v
```

All tests pass without Supabase configuration, confirming graceful degradation.

## Troubleshooting

**Error: "Database not configured"**
- Check that `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set
- Verify credentials in Supabase Dashboard → Settings → API

**Error: "Profile not found"**
- The auto-provisioning trigger creates profile + settings on user signup
- If you created the user before applying migrations, manually insert:
  ```sql
  INSERT INTO public.profiles (id, display_name)
  VALUES ('your-user-uuid', 'test');
  
  INSERT INTO public.settings (user_id, theme, preferences)
  VALUES ('your-user-uuid', 'black-mirror', '{}');
  ```

**Error: "Invalid authentication token"**
- Verify `SUPABASE_JWT_SECRET` matches your project's JWT Secret
- Check token hasn't expired (tokens are valid for 1 hour)
