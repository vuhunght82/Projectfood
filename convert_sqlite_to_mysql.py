import sqlite3

sqlite_file = 'database.db'
output_sql = 'chayhoasen_mysql.sql'

def sqlite_to_mysql(sqlite_db, output_file):
    conn = sqlite3.connect(sqlite_db)
    cursor = conn.cursor()
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("SET FOREIGN_KEY_CHECKS=0;\n")
        f.write("SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';\n")
        f.write("SET NAMES utf8mb4;\n\n")
        
        cursor.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%';")
        tables = [row[0] for row in cursor.fetchall()]
        
        for table in tables:
            cursor.execute(f"PRAGMA table_info(`{table}`);")
            columns = cursor.fetchall()
            
            create_cols = []
            pk_cols = []
            for col in columns:
                col_id, col_name, col_type, notnull, dflt_val, pk = col
                col_type = col_type.upper() if col_type else "TEXT"
                
                # Nếu cột là Primary Key hoặc Unique, bắt buộc dùng VARCHAR thay vì TEXT để tránh lỗi 1170
                if pk:
                    if "INT" in col_type:
                        m_type = "INT AUTO_INCREMENT"
                    else:
                        m_type = "VARCHAR(255)"
                    pk_cols.append(f"`{col_name}`")
                else:
                    if "INT" in col_type:
                        m_type = "INT"
                    elif "CHAR" in col_type or "TEXT" in col_type:
                        m_type = "LONGTEXT" if "TEXT" in col_type else col_type
                    elif "BLOB" in col_type:
                        m_type = "LONGBLOB"
                    elif "REAL" in col_type or "FLOA" in col_type or "DOUB" in col_type:
                        m_type = "DOUBLE"
                    else:
                        m_type = "VARCHAR(255)"
                    
                col_def = f"`{col_name}` {m_type}"
                create_cols.append(col_def)
                
            if pk_cols:
                create_cols.append(f"PRIMARY KEY ({', '.join(pk_cols)})")
                
            f.write(f"DROP TABLE IF EXISTS `{table}`;\n")
            f.write(f"CREATE TABLE `{table}` (\n  " + ",\n  ".join(create_cols) + "\n) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;\n\n")
            
            cursor.execute(f"SELECT * FROM `{table}`;")
            rows = cursor.fetchall()
            col_names = [f"`{col[1]}`" for col in columns]
            
            for row in rows:
                vals = []
                for val in row:
                    if val is None:
                        vals.append("NULL")
                    elif isinstance(val, (int, float)):
                        vals.append(str(val))
                    else:
                        val_str = str(val).replace("\\", "\\\\").replace("'", "\\'")
                        vals.append(f"'{val_str}'")
                f.write(f"INSERT INTO `{table}` ({', '.join(col_names)}) VALUES ({', '.join(vals)});\n")
            f.write("\n")
            
        f.write("SET FOREIGN_KEY_CHECKS=1;\n")
    conn.close()
    print("Xuat file thanh cong!")

sqlite_to_mysql(sqlite_file, output_sql)