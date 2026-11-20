@echo off
REM Installs Speed Ease for Premiere Pro (Windows). Double-click to run.
set DEST=%APPDATA%\Adobe\CEP\extensions\SpeedEase
for %%v in (9 10 11 12) do reg add "HKCU\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul
if exist "%DEST%" rmdir /s /q "%DEST%"
mkdir "%DEST%"
xcopy /e /i /y "%~dp0CSXS" "%DEST%\CSXS" >nul
xcopy /e /i /y "%~dp0css" "%DEST%\css" >nul
xcopy /e /i /y "%~dp0js" "%DEST%\js" >nul
xcopy /e /i /y "%~dp0jsx" "%DEST%\jsx" >nul
copy /y "%~dp0index.html" "%DEST%\" >nul
echo Installed. Restart Premiere Pro, then Window ^> Extensions ^> Speed Ease
pause
