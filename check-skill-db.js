const { MongoClient } = require('mongodb');

async function checkSkillDB() {
    const uri = 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    console.log('Starting database check...');

    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        console.log('Connected to MongoDB successfully!');

        const db = client.db('turn-based-game');
        console.log('Using database: turn-based-game');
        
        // 检查skill集合
        console.log('\n=== Skill Collection ===');
        const skills = await db.collection('skill').find().toArray();
        console.log('Number of skills:', skills.length);
        console.log('Skills:', JSON.stringify(skills, null, 2));

        // 检查counter集合
        console.log('\n=== Counter Collection ===');
        const counters = await db.collection('counter').find().toArray();
        console.log('Number of counters:', counters.length);
        console.log('Counters:', JSON.stringify(counters, null, 2));

    } catch (error) {
        console.error('Error checking database:', error);
    } finally {
        console.log('\nClosing connection...');
        await client.close();
        console.log('Connection closed');
    }
}

checkSkillDB();