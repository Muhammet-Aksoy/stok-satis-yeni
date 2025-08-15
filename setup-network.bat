@echo off
echo Yerel ağ bağlantısı için güvenlik duvarı kuralları ekleniyor...

netsh advfirewall firewall add rule name="Stok Yönetim Sistemi - HTTP" dir=in action=allow protocol=TCP localport=3000
netsh advfirewall firewall add rule name="Stok Yönetim Sistemi - Outbound" dir=out action=allow protocol=TCP localport=3000

echo.
echo IP Adresi bilgileri:
ipconfig | findstr "IPv4"

echo.
echo Yerel ağ erişimi için şu adreslerden birini kullanın:
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr "IPv4"') do (
    for /f "tokens=1" %%b in ("%%a") do echo http://%%b:3000
)

echo.
echo Güvenlik duvarı kuralları başarıyla eklendi!
pause