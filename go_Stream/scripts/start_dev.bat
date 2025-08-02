@echo off
echo Starting P9_MicroStream Development Environment...

echo.
echo Starting Redis...
docker run --name p9_redis -p 6379:6379 -d redis:7-alpine redis-server --appendonly yes

echo.
echo Waiting for Redis to start...
timeout /t 3 /nobreak > nul

echo.
echo Starting P9_MicroStream...
go run cmd/main.go

echo.
echo Cleaning up...
docker stop p9_redis
docker rm p9_redis

pause
