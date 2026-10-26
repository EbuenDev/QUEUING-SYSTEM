@echo off
cd /d "%~dp0"
echo =======================================================
echo  Starting RHU II Queuing System (Docker)
echo =======================================================

if not exist ".env" (
    echo [INFO] .env not found. Creating from .env.example...
    copy .env.example .env
)

echo Starting Docker containers...
docker compose up -d

if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to start Docker containers. Make sure Docker Desktop is running!
    pause
    exit /b %ERRORLEVEL%
)

echo Waiting for database to initialize...
timeout /t 5 /nobreak >nul

echo Applying database migrations...
docker compose exec -T web php run_migrations.php

for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    set IP=%%a
    goto :foundip
)
:foundip
set IP=%IP: =%

echo =======================================================
echo  System is Ready!
echo =======================================================
echo  - Waiting Room (TV):  http://localhost:8081/index.html
echo  - Admin Panel:        http://localhost:8081/admin.html
echo  - Doctor Panel:       http://localhost:8081/doctor.html
echo  - Super Admin Panel:  http://localhost:8081/superadmin.html
echo  - LAN Access URL:     http://%IP%:8081/
echo =======================================================
pause
