const mysql = require('mysql2/promise');

async function testBagServiceLogic() {
  try {
    // 创建数据库连接
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: 'root123',
      database: 'text_rpg'
    });

    console.log('✅ 数据库连接成功');

    // 模拟bag.service.ts的list方法逻辑
    const uid = 1;
    
    console.log('\n=== 模拟bag.service.ts的list方法 ===');
    
    // 1. 获取bag表数据
    const [bags] = await connection.execute(
      'SELECT * FROM bag WHERE uid = ?',
      [uid]
    );
    console.log('Step 1 - 获取bag表数据:', bags);
    
    // 2. 为每个bag记录获取详细信息
    const bagsWithDetails = await Promise.all(bags.map(async (bag) => {
      console.log(`\n处理bag记录 ${bag.id}:`);
      
      // 获取item表信息
      const [itemInfo] = await connection.execute(
        'SELECT name, type FROM item WHERE id = ?',
        [bag.item_id]
      );
      console.log(`  - item表信息:`, itemInfo[0]);
      
      if (itemInfo.length > 0) {
        const itemData = {
          ...bag,
          name: itemInfo[0].name,
          type: itemInfo[0].type
        };
        
        // 获取equip表信息
        if (bag.equipment_uid) {
          console.log(`  - equipment_uid: ${bag.equipment_uid}`);
          const [equipInfo] = await connection.execute(
            'SELECT * FROM equip WHERE equipment_uid = ?',
            [bag.equipment_uid]
          );
          console.log(`  - equip表信息:`, equipInfo[0]);
          
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
            console.log(`  - 添加equip_attributes:`, itemData.equip_attributes);
            console.log(`  - 添加level:`, itemData.level);
          }
        }
        
        return itemData;
      }
      return bag;
    }));
    
    console.log('\n=== 最终结果 ===');
    console.log('bagsWithDetails:', bagsWithDetails);
    
    // 3. 检查最终返回的数据
    const result = [];
    for (const bag of bagsWithDetails) {
      const bagType = bag.type;
      const bagCount = bag.count;
      const bagEquipmentUid = bag.equipment_uid;
      const bagEquipAttributes = bag.equip_attributes;
      const bagLevel = bag.level;
      
      console.log(`\n处理最终数据:`);
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
    
    console.log('\n=== API返回的最终数据 ===');
    console.log('result:', result);

    // 关闭连接
    await connection.end();
    console.log('\n✅ 测试完成，连接已关闭');
  } catch (error) {
    console.error('❌ 测试失败:', error.message);
  }
}

testBagServiceLogic();
