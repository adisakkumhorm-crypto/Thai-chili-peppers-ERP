# Scripts Safety Guardrails

## Overview

This directory contains all scripts that interact with the production database. These scripts have been classified and moved to prevent accidental execution on production environments.

## Directory Structure

```
scripts/
├── tests/         # Test scripts (test_*.js)
├── seeds/         # Seed scripts (seed-*.js)
└── maintenance/   # Maintenance scripts (step*, audit*, check*, finish_*)
```

## Safety Guards

### 1. Production Environment Protection

All scripts now have a production guard at the top:

```javascript
// === PRODUCTION SAFETY GUARD ===
if (process.env.NODE_ENV === "production") {
  throw new Error("🚫 This script is NOT allowed to run on production. Set NODE_ENV=development or use maintenance mode.");
}
```

### 2. Explicit Permission Required

High-risk maintenance scripts require the `ALLOW_DANGEROUS_DB_SCRIPT=true` environment variable:

```javascript
if (!process.env.ALLOW_DANGEROUS_DB_SCRIPT) {
  throw new Error("🚫 ALLOW_DANGEROUS_DB_SCRIPT=true required to run this script.");
}
```

### 3. Service Role Key Validation

All scripts validate that `SUPABASE_SERVICE_ROLE_KEY` is set:

```javascript
if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("🚫 SUPABASE_SERVICE_ROLE_KEY environment variable is required but missing.");
}
```

## Risk Categories

### CRITICAL RISK (Requires explicit ALLOW_DANGEROUS_DB_SCRIPT)
- Scripts that delete inventory data
- Scripts that update product stock quantities
- Scripts that modify inventory balances

### MEDIUM RISK (Production guard only)
- Scripts that audit production data
- Scripts that query production data

### LOW RISK (Production guard only)
- Test scripts (should run on test databases)
- Seed scripts (should run on dev/test databases)

## Running Scripts

### Development/Test Environment

```bash
# Set environment
export NODE_ENV=development

# For high-risk maintenance scripts
export ALLOW_DANGEROUS_DB_SCRIPT=true
export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Run script
node scripts/maintenance/step22_execution_v2.js
```

### Production Environment

**WARNING:** Production environment is blocked by design. Use the Supabase Dashboard or pg_dump for production database changes.

## Files Classification

### TEST SCRIPTS (`scripts/tests/`)
- `test_phased1.js` - Phase D1 tests (inventory issue/ship flow)
- `test_phased2.js` - Phase D2 tests (inventory transaction)
- `test_adjust_rpc.js` - Test rpc_adjust_stock
- `test_step19_rpc*.js` - Step 19 RPC tests
- `test_step20*.js` - Step 20 tests

### SEED SCRIPTS (`scripts/seeds/`)
- `seed-full*.js` - Full seeding scripts
- `seed-mock.js` - Mock data seeding
- `seed-channels.js` - Channel seeding
- `seed-employees.js` - Employee seeding
- `seed-leave-balances.js` - Leave balance seeding
- `seed-locations.js` - Location seeding
- `seed-massive.js` - Massive seeding
- `seed-po.js` - PO seeding
- `seed-projects.js` - Project seeding

### MAINTENANCE SCRIPTS (`scripts/maintenance/`)
- **High Risk:**
  - `step22_execution_v2.js` - Step 22 execution
  - `step22_execution.js` - Step 22 execution

- **Medium Risk:**
  - `audit_step20.js` - Step 20 inventory audit
  - `audit_step21.js` - Step 21 root cause audit
  - `audit_step21_full.js` - Step 21 full audit
  - `step22_dryrun.js` - Step 22 dry run
  - `step22_precheck.js` - Step 22 pre-check
  - `step22_precheck_final.js` - Step 22 pre-check final
  - `step22_final_check.js` - Step 22 final check
  - `step22_reconciliation_dryrun.js` - Step 22 reconciliation dry run

- **Low Risk:**
  - `audit_rpc.js` - Audit RPC
  - `audit_step23*.js` - Step 23 audits
  - `check_current_state.js` - Check current state
  - `check_db_now.js` - Check DB now
  - `finish_cleanup.js` - Finish cleanup
  - `patch-project-inventory.js` - Patch inventory

## Security Best Practices

1. **Never hardcode service keys** - All keys should come from environment variables
2. **Use .env files** - Store sensitive data in `.env` (never commit to git)
3. **Validate inputs** - All scripts should validate input parameters
4. **Use transactions** - Database modifications should be wrapped in transactions
5. **Idempotency** - Use idempotency keys for retry-safe operations
6. **Audit logging** - Log all script executions for compliance

## Emergency Procedures

### If a script accidentally runs on production:

1. **STOP** - Do not run any more scripts
2. **ASSESS** - Check what data was modified
3. **ROLLBACK** - Use database backups to restore
4. **REPORT** - Notify the engineering team

### Contact for Production Changes:

- Slack: #engineering
- Email: engineering@company.com

## Version History

- **2026-09-12** - Initial script safety remediation
  - Moved all scripts to organized directories
  - Added production guards to all scripts
  - Added ALLOW_DANGEROUS_DB_SCRIPT validation for high-risk scripts
