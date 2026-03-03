const mysql = require('mysql2/promise');

async function checkAdminStatus() {
  const pool = mysql.createPool({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  try {
    const [rows] = await pool.execute('SELECT id, username, is_admin FROM user WHERE username = ?', ['asd4859098']);
    console.log('User admin status:', rows);
    
    if (Array.isArray(rows) && rows.length > 0) {
      console.log(`User ${rows[0].username} has is_admin: ${rows[0].is_admin}`);
    } else {
      console.log('User not found');
    }
  } catch (error) {
    console.error('Error checking admin status:', error);
  } finally {
    await pool.end();
  }
}

checkAdminStatus();