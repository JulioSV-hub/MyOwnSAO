@echo off
rem Abre o jogo no navegador usando um servidor local (necessario para os modulos JavaScript).
cd /d "%~dp0"
start "" http://localhost:8765/index.html
python -m http.server 8765
