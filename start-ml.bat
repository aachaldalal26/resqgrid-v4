@echo off
title ResQGrid AI service
cd /d "%~dp0ml-service"
if not exist venv (
  echo Creating Python virtual environment...
  python -m venv venv
  call venv\Scripts\activate
  pip install -r requirements.txt
) else (
  call venv\Scripts\activate
)
python app.py
pause
