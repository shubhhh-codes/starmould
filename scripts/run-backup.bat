@echo off
REM ======================================================
REM   StarMould ERP - Automated Database Backup Script
REM   Target: C:\SM_soft_backup
REM ======================================================

setlocal enabledelayedexpansion

cd /d "D:\Repo\starmould"

echo ---------------------------------------------------------------- >> "C:\SM_soft_backup\backup.log"
echo [!date! !time!] Triggering Automated StarMould Backup... >> "C:\SM_soft_backup\backup.log"

node scripts/backup-db.mjs >> "C:\SM_soft_backup\backup.log" 2>&1

if %ERRORLEVEL% equ 0 (
    echo [!date! !time!] Backup completed successfully. >> "C:\SM_soft_backup\backup.log"
    exit /b 0
) else (
    echo [!date! !time!] [ERROR] Backup failed with exit code %ERRORLEVEL%. >> "C:\SM_soft_backup\backup.log"
    exit /b %ERRORLEVEL%
)
