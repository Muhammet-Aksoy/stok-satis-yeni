@echo off
echo ===============================================
echo       SABANCIOGLU OTOMOTIV SERVER BASLAT
echo ===============================================
echo.

REM Proje dizinine git
cd /d "C:\Users\musta\stok-satis-api"

echo 📍 Mevcut dizin: %CD%
echo.

echo 🔍 IP adresleri kontrol ediliyor...
echo.

REM IP adreslerini göster
echo 💻 BILGISAYAR IP ADRESLERI:
echo ----------------------------------------
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /c:"IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do (
        echo    http://%%b:3000
    )
)
echo.

echo 🚀 Node.js sunucu başlatılıyor...
echo ----------------------------------------
echo.

echo 🔧 Dependencies kontrol ediliyor...
if not exist "node_modules" (
    echo Node modules yükleniyor...
    npm install
    echo ✅ Dependencies yüklendi
) else (
    echo ✅ Dependencies mevcut
)
echo.

REM Sunucuyu başlat
node server.js

echo.
echo ❌ Sunucu durduruldu!
echo ⌨️  Çıkmak için herhangi bir tuşa basın...
pause > nul