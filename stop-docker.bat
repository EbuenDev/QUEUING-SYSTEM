@echo off
cd /d "%~dp0"
echo Stopping RHU II Queuing System Docker containers...
docker compose down
echo Stopped.
pause
