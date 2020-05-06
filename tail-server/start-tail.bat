:start
cls
node --max-old-space-size=128 --gc_interval=100 tail
pause
goto start