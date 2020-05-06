:start
cls
node --max-old-space-size=512 --gc_interval=100 server
pause
goto start