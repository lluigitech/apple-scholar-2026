const db = require('../config/db');
const bcrypt = require('bcryptjs');

const email = 'Luigi@gmail.com';
const password = '12345678';
const fullName = 'Admin Luigi';
const role = 'admin';

(async () => {
  try {
    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);
    
    console.log('Creating admin user...');
    console.log('Email:', email);
    console.log('Full Name:', fullName);
    console.log('Role:', role);
    
    // Insert into database
    const query = `
      INSERT INTO users (scholar_id, full_name, email, password, role, status, must_change_password)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.query(query, ['ADMIN-001', fullName, email, hashedPassword, role, 'active', 0], (err, result) => {
      if (err) {
        console.error('Error creating admin:', err.message);
        process.exit(1);
      }
      console.log('✓ Admin user created successfully!');
      console.log('ID:', result.insertId);
      process.exit(0);
    });
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
