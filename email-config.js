// Email configuration for daily backups
// Bu dosyayı kendi email bilgilerinizle güncelleyin

module.exports = {
    // Gmail için örnek ayarlar
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.EMAIL_USER || 'your-email@gmail.com', // Kendi email adresinizi girin
        pass: process.env.EMAIL_PASS || 'your-app-password' // Gmail App Password girin
    }
};

// Gmail App Password oluşturma:
// 1. Gmail hesabınıza giriş yapın
// 2. Google Hesabı > Güvenlik > 2 Adımlı Doğrulama'yı açın
// 3. Uygulama Şifreleri > Diğer > Özel ad girin (örn: "Stok Yedekleme")
// 4. Oluşturulan 16 haneli şifreyi buraya yazın

// Environment variables ile kullanım:
// EMAIL_USER=your-email@gmail.com EMAIL_PASS=your-app-password node server.js