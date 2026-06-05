# RIS test suite

Automated tests for the RIS work (see the master plan).

## Prerequisites
- XAMPP **MySQL must be running** (the backend tests build a throwaway DB from the live schema).
- PHP 8.x at `C:\xampp\php\php.exe`, Node/npm available.

## Run everything
```powershell
powershell -ExecutionPolicy Bypass -File www\tests\run-all-tests.ps1
```
This rebuilds `dicom_viewer_pro_test`, runs the PHP suite, then runs Vitest. Exits non-zero on any failure.

## Backend (PHP) only
```powershell
powershell -ExecutionPolicy Bypass -File www\tests\setup-testdb.ps1   # (re)build test DB
C:\xampp\php\php.exe www\tests\run.php
```
- `tests/php/_harness.php` — zero-dependency assert framework + `testDb()` connection.
- `tests/php/*Test.php` — auto-discovered test files.
- Tests run against `dicom_viewer_pro_test` (schema cloned from live `dicom_viewer_pro`, **no data**, then migrations `016+` applied). Real patient data is never touched.

## Frontend (Vitest) only
```powershell
npm --prefix www test          # one-shot
npm --prefix www run test:watch
```
- Config: `www/vitest.config.ts` (node env, `@` alias).
- Test files: `www/src/**/*.test.ts`.

## Conventions
- New backend logic goes in a testable class/function under `www/includes/ris/` (dependency-injected `mysqli`), with a `*Test.php`.
- New frontend logic goes in a feature `lib/` or `stores/` file with a colocated `*.test.ts`.
- TDD: write the failing test first, watch it fail, then implement.
