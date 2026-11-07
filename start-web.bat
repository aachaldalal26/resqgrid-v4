@echo off
title ResQGrid web app
cd /d "%~dp0web"
if not exist .env.local copy .env.example .env.local
if not exist node_modules (
  echo Installing packages, this takes a few minutes the first time...
  call npm install
)
echo Open http://localhost:3000 in your browser
call npm run dev
pause
