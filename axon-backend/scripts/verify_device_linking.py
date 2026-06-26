#!/usr/bin/env python3
"""Verify device linking backend (run from axon-backend with venv active)."""

from __future__ import annotations

import asyncio
import sys
from pathlib import Path

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))


async def main() -> int:
    from app.services.device_service import DeviceService
    from app.db.supabase import get_supabase_admin

    admin = get_supabase_admin()
    if not admin:
        print("ERROR: Supabase admin client not configured in .env")
        return 1

    svc = DeviceService(admin)
    created = await svc.create_device_code()
    code = created["code"]
    print(f"Created code: {code}")
    print(f"Backend mode: {DeviceService._storage_backend}")

    fetched = await svc.get_device_code(code)
    print(f"Lookup ok: {fetched is not None}")

    if DeviceService._storage_backend == "db":
        print("OK: device_codes table exists — Vercel + Railway linking will work.")
    elif DeviceService._storage_backend == "storage":
        print("PARTIAL: using Supabase Storage fallback.")
        print("  Phone via Vercel needs Railway backend with same fallback OR run SQL:")
        print(f"  {BACKEND.parent / 'SUPABASE_DEVICE_CODES_FIX.sql'}")
    else:
        print("BROKEN: in-memory only — phone cannot link. Run SUPABASE_DEVICE_CODES_FIX.sql")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main()))
