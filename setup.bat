@echo off
REM Run the setup script using Windows PowerShell 5 (built-in to Windows)
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-windows-ps.ps1"
pause
