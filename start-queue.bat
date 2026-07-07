@echo off
cd /d "%~dp0"
echo Starting queue system...
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    set IP=%%a
    goto :foundip
)
:foundip
set IP=%IP: =%
echo Access the site at http://%IP%:8000
if exist "C:\xampp\php\php.exe" (
    "C:\xampp\php\php.exe" -S 0.0.0.0:8000 -t "%~dp0"
) else (
    php -S 0.0.0.0:8000 -t "%~dp0"
)
