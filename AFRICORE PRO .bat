@echo off
start "Backend" cmd /k "cd /d C:\Users\HomePC\Desktop\AFRICORE EPR PRO\backend && npm run dev"
timeout /t 5 /nobreak >nul
start "Frontend" cmd /k "cd /d C:\Users\HomePC\Desktop\AFRICORE EPR PRO\frontend && npm run dev"
timeout /t 8 /nobreak >nul
start "" "http://localhost:5173"