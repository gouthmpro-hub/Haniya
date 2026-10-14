@echo off
title GPS-Based Auto Tracking System - Spring Boot Server
echo ===================================================================
echo   GPS-Based Auto Tracking System - Launching Web Application
echo ===================================================================
echo.

set JAVA_HOME=C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot
set Path=%JAVA_HOME%\bin;C:\Tools\apache-maven-3.9.6\bin;%Path%

echo [1/2] Checking Java & Maven...
java -version
if %errorlevel% neq 0 (
    echo Error: Java not found. Please install JDK 17.
    pause
    exit /b 1
)

echo.
echo [2/2] Starting Spring Boot Server (Zero-setup Dev Profile with H2)...
echo Web UI will be available at: http://localhost:8080
echo.
call mvn spring-boot:run "-Dspring-boot.run.profiles=dev"

pause
