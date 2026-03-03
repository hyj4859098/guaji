const mysql = require('mysql2/promise');

async function testBagServiceReal() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('✅ 数据库连接成功');

    // 模拟bag.service.ts的完整逻辑
    const uid = 1;
    
    console.log('\n=== Step 1: 获取bag表数据 ===');
    const [bags] = await connection.execute(
      'SELECT * FROM bag WHERE uid = ?',
      [uid]
    );
    console.log('bags:', JSON.stringify(bags, null, 2));
    
    console.log('\n=== Step 2: 为每个bag记录获取详细信息 ===');
    const bagsWithDetails = await Promise.all(bags.map(async (bag) => {
      console.log(`\n处理bag记录 ${bag.id}:`);
      console.log(`  - bag.equipment_uid: ${bag.equipment_uid}`);
      
      try {
        const [itemInfo] = await connection.execute(
          'SELECT name, type FROM item WHERE id = ?',
          [bag.item_id]
        );
        console.log(`  - itemInfo:`, itemInfo[0]);
        
        if (itemInfo.length > 0) {
          const itemData = {
            ...bag,
            name: itemInfo[0].name,
            type: itemInfo[0].type
          };
          
          if (bag.equipment_uid) {
            console.log(`  - 开始获取equip信息...`);
            const [equipInfo] = await connection.execute(
              'SELECT * FROM equip WHERE equipment_uid = ?',
              [bag.equipment_uid]
            );
            console.log(`  - equipInfo:`, equipInfo[0]);
            
            if (equipInfo.length > 0) {
              itemData.equip_attributes = {
                hp: equipInfo[0].hp,
                phy_atk: equipInfo[0].phy_atk,
                phy_def: equipInfo[0].phy_def,
                mp: equipInfo[0].mp,
                mag_def: equipInfo[0].mag_def,
                mag_atk: equipInfo[0].mag_atk,
                hit_rate: equipInfo[0].hit_rate,
                dodge_rate: equipInfo[0].dodge_rate,
                crit_rate: equipInfo[0].crit_rate
              };
              itemData.level = equipInfo[0].level;
              console.log(`  - 添加了equip_attributes:`, itemData.equip_attributes);
              console.log(`  - 添加了level:`, itemData.level);
            } else {
              console.log(`  - ❌ equipInfo.length === 0`);
            }
          } else {
            console.log(`  - ❌ bag.equipment_uid 为空`);
          }
          
          console.log(`  - 最终itemData:`, JSON.stringify(itemData, null, 2));
          return itemData;
        }
        return bag;
      } catch (error) {
        console.error(`  - ❌ 处理失败:`, error.message);
        return bag;
      }
    }));
    
    console.log('\n=== Step 3: 处理最终结果 ===');
    const result = [];
    for (const bag of bagsWithDetails) {
      const bagType = bag.type;
      const bagCount = bag.count;
      const bagEquipmentUid = bag.equipment_uid;
      const bagEquipAttributes = bag.equip_attributes;
      const bagLevel = bag.level;
      
      console.log(`\n处理bag:`);
      console.log(`  - type: ${bagType}`);
      console.log(`  - count: ${bagCount}`);
      console.log(`  - equipment_uid: ${bagEquipmentUid}`);
      console.log(`  - equip_attributes:`, bagEquipAttributes);
      console.log(`  - level: ${bagLevel}`);
      
      if (bagType === 2 && bagCount > 1) {
        for (let i = 0; i < bagCount; i++) {
          result.push({
            ...bag,
            id: bag.id * 10000 + i,
            count: 1,
            original_id: bag.id,
            equipment_uid: bagEquipmentUid || `EQP_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
            equip_attributes: bagEquipAttributes,
            level: bagLevel
          });
        }
      } else {
        result.push({
          ...bag,
          original_id: bag.id,
          equipment_uid: bagEquipmentUid,
          equip_attributes: bagEquipAttributes,
          level: bagLevel
        });
      }
    }
    
    console.log('\n=== 最终API返回数据 ===');
    console.log(JSON.stringify(result, null, 2));

    // 关闭连接
    await connection.end();
    console.log('\n✅ 测试完成，连接已关闭');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testBagServiceReal();
