#!/usr/bin/env python3
import sqlite3
import os
import sys
import json
from datetime import datetime

def generate_report(report_type='monthly'):
    try:
        # Veritabanı yolu
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'veriler', 'veritabani.db')
        
        # Veritabanına bağlan
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        report = {
            "report_type": report_type,
            "generated_at": datetime.now().isoformat(),
            "data": {}
        }
        
        if report_type == 'monthly':
            # Aylık rapor
            current_month = datetime.now().strftime('%Y-%m')
            
            # Bu ay satış sayısı
            cursor.execute('SELECT COUNT(*) FROM satisGecmisi WHERE tarih LIKE ?', (f'{current_month}%',))
            monthly_sales_count = cursor.fetchone()[0]
            report['data']['monthly_sales_count'] = monthly_sales_count
            
            # Bu ay satış tutarı
            cursor.execute('SELECT SUM(toplam) FROM satisGecmisi WHERE tarih LIKE ?', (f'{current_month}%',))
            monthly_revenue = cursor.fetchone()[0] or 0
            report['data']['monthly_revenue'] = monthly_revenue
            
        elif report_type == 'inventory':
            # Stok raporu
            cursor.execute('SELECT COUNT(*) FROM stok')
            total_products = cursor.fetchone()[0]
            report['data']['total_products'] = total_products
            
            # Düşük stoklu ürünler
            cursor.execute('SELECT COUNT(*) FROM stok WHERE miktar <= 10')
            low_stock_count = cursor.fetchone()[0]
            report['data']['low_stock_count'] = low_stock_count
            
        elif report_type == 'customers':
            # Müşteri raporu
            cursor.execute('SELECT COUNT(*) FROM musteriler')
            total_customers = cursor.fetchone()[0]
            report['data']['total_customers'] = total_customers
            
        else:
            # Genel rapor
            tables = ['stok', 'satisGecmisi', 'musteriler', 'borclarim']
            for table in tables:
                try:
                    cursor.execute(f'SELECT COUNT(*) FROM {table}')
                    count = cursor.fetchone()[0]
                    report['data'][f'{table}_count'] = count
                except sqlite3.OperationalError:
                    report['data'][f'{table}_count'] = 0
        
        result = {
            "success": True,
            "report": report,
            "message": f"{report_type.capitalize()} report generated successfully"
        }
        
        print(json.dumps(result))
        return result
        
    except sqlite3.Error as e:
        error_result = {
            "success": False,
            "error": f"Database error: {str(e)}"
        }
        print(json.dumps(error_result))
        return error_result
    except Exception as e:
        error_result = {
            "success": False,
            "error": f"General error: {str(e)}"
        }
        print(json.dumps(error_result))
        return error_result
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    # Komut satırı argümanından rapor tipini al
    report_type = sys.argv[1] if len(sys.argv) > 1 else 'monthly'
    generate_report(report_type)