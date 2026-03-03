const { MongoClient } = require('mongodb');

async function fixSkillIds() {
    const uri = 'mongodb://localhost:27017';
    const client = new MongoClient(uri);

    console.log('Starting skill ID fix...');

    try {
        console.log('Connecting to MongoDB...');
        await client.connect();
        console.log('Connected to MongoDB successfully!');

        const db = client.db('turn-based-game');
        console.log('Using database: turn-based-game');
        
        // 获取所有技能
        console.log('\n=== Getting all skills ===');
        const skills = await db.collection('skill').find().toArray();
        console.log('Number of skills:', skills.length);
        console.log('Skills before fix:', JSON.stringify(skills, null, 2));

        // 修复技能ID
        console.log('\n=== Fixing skill IDs ===');
        let maxId = 0;
        for (let i = 0; i < skills.length; i++) {
            const skill = skills[i];
            // 计算新的ID（从1开始）
            const newId = i + 1;
            // 更新技能的id和skill_id字段
            await db.collection('skill').updateOne(
                { _id: skill._id },
                { $set: { id: newId, skill_id: newId } }
            );
            console.log(`Fixed skill ${skill.name}: ID = ${newId}`);
            maxId = newId;
        }

        // 更新counter集合中的skill_id计数器
        console.log('\n=== Updating skill_id counter ===');
        await db.collection('counter').updateOne(
            { _id: 'skill_id' },
            { $set: { seq: maxId } },
            { upsert: true }
        );
        console.log(`Updated skill_id counter to ${maxId}`);

        // 验证修复结果
        console.log('\n=== Verifying fix ===');
        const fixedSkills = await db.collection('skill').find().toArray();
        console.log('Skills after fix:', JSON.stringify(fixedSkills, null, 2));

        const counters = await db.collection('counter').find().toArray();
        console.log('Counters after fix:', JSON.stringify(counters, null, 2));

        console.log('\nSkill ID fix completed successfully!');

    } catch (error) {
        console.error('Error fixing skill IDs:', error);
    } finally {
        console.log('\nClosing connection...');
        await client.close();
        console.log('Connection closed');
    }
}

fixSkillIds();