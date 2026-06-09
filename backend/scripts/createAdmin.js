const User = require('../src/models/User');

async function createAdmin() {
    try {
        const admin = await User.create({
            name: 'Admin',
            email: 'admin@sfs.com',
            password: 'admin123',
            role: 'admin',
            phone: '0000000000',
            location: 'Headquarters',
            latitude: null,
            longitude: null
        });
        console.log('Admin created:', admin);
    } catch (err) {
        console.error('Error creating admin:', err);
    }
}

createAdmin();