#!/usr/bin/env python3
import sqlite3
import os
import sys
import json
from datetime import datetime

def analyze_data():
    try:
        # Veritabanı yolu
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'veriler', 'veritabani.db')
        
        # Veritabanına bağlan
        conn = sqlite3.connect(db_path)
        cursor = conn.cursor()
        
        # Analiz verilerini topla
        analysis = {}
        
        # Tablo sayılarını al
        tables = ['stok', 'satisGecmisi', 'musteriler', 'borclarim']
        table_counts = {}
        
        for table in tables:
            try:
                cursor.execute(f'SELECT COUNT(*) FROM {table}')
                count = cursor.fetchone()[0]
                table_counts[table] = count
            except sqlite3.OperationalError:
                table_counts[table] = 0
        
        analysis['table_counts'] = table_counts
        
        # Toplam kayıt sayısı
        total_records = sum(table_counts.values())
        analysis['total_records'] = total_records
        
        # Son güncelleme zamanı
        analysis['analysis_timestamp'] = datetime.now().isoformat()
        
        result = {
            "success": True,
            "data": analysis,
            "message": "Data analysis completed successfully"
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
    analyze_data()