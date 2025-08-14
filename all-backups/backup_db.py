#!/usr/bin/env python3
import sqlite3
import os
import sys
import json
from datetime import datetime

def backup_database():
    try:
        # Veritabanı yolu
        db_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'veriler', 'veritabani.db')
        backup_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'veriler', 'backups')
        
        # Backup klasörünü oluştur
        os.makedirs(backup_dir, exist_ok=True)
        
        # Backup dosya adı
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(backup_dir, f'backup_{timestamp}.db')
        
        # Veritabanı bağlantısı ve yedekleme
        source = sqlite3.connect(db_path)
        backup = sqlite3.connect(backup_file)
        
        with backup:
            source.backup(backup)
        
        result = {
            "success": True,
            "message": f"Backup created successfully at {backup_file}",
            "backup_file": backup_file,
            "timestamp": timestamp
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
        if 'source' in locals():
            source.close()
        if 'backup' in locals():
            backup.close()

if __name__ == "__main__":
    backup_database()