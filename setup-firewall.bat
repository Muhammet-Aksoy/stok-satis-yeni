@echo off
echo ===============================================
echo    Otomotiv Stok Sistemi - Ağ Ayarları
echo ===============================================
echo.

echo 🔥 Windows Defender Güvenlik Duvarı kuralları ekleniyor...
echo.

REM Port 3000 için gelen bağlantılara izin ver
netsh advfirewall firewall add rule name="Otomotiv Stok Sistemi - Port 3000 (TCP)" dir=in action=allow protocol=TCP localport=3000
if %errorlevel% equ 0 (
    echo ✅ TCP Port 3000 kuralı eklendi
) else (
    echo ❌ TCP Port 3000 kuralı eklenemedi
)

REM Port 3000 için giden bağlantılara izin ver
netsh advfirewall firewall add rule name="Otomotiv Stok Sistemi - Port 3000 (TCP Out)" dir=out action=allow protocol=TCP localport=3000
if %errorlevel% equ 0 (
    echo ✅ TCP Port 3000 çıkış kuralı eklendi
) else (
    echo ❌ TCP Port 3000 çıkış kuralı eklenemedi
)

echo.
echo 📱 Artık aynı ağdaki cihazlardan sisteme erişebilirsiniz!
echo 💡 Ana uygulamada "QR Bağlantı" butonuna tıklayarak
echo    telefonunuzla bağlanabilirsiniz.
echo.

echo ===============================================
echo          Kurulum Tamamlandı!
echo ===============================================
echo.
echo Mevcut güvenlik duvarı kurallarını görmek için:
echo netsh advfirewall firewall show rule name="Otomotiv Stok Sistemi*"
echo.

pause