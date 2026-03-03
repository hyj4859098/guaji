const { query } = require('./src/config/db');

async function testEquipNoStack() {
  console.log('=== 测试装备不可叠加 ===\n');

  const uid = 1;
  const equipItemId = 6; // 铁剑（类型为2，装备）

  try {
    // 先清空背包中的装备，方便测试
    console.log('1. 清空背包中的装备...');
    await query('DELETE FROM bag WHERE uid = ? AND item_id = ?', [uid, equipItemId]);
    console.log('清空完成\n');

    // 测试添加装备
    console.log('2. 测试添加装备（3件铁剑）...');
    const BagModel = require('./src/model/bag.model').BagModel;
    const bagModel = new BagModel();
    
    for (let i = 0; i < 3; i++) {
      await bagModel.addItem(uid, equipItemId, 1);
      console.log(`  添加第 ${i + 1} 件铁剑成功`);
    }

    // 查看背包中的装备
    console.log('\n3. 查看背包中的装备...');
    const bags = await query('SELECT id, item_id, count FROM bag WHERE uid = ? AND item_id = ?', [uid, equipItemId]);
    console.log(`  背包中的铁剑数量: ${bags.length} 件`);
    
    bags.forEach((bag, index) => {
      console.log(`  ${index + 1}. ID: ${bag.id}, 物品ID: ${bag.item_id}, 数量: ${bag.count}`);
    });

    if (bags.length === 3 && bags.every(bag => bag.count === 1)) {
      console.log('\n✅ 测试通过：装备每件都创建了单独的记录，没有叠加');
    } else {
      console.log('\n❌ 测试失败：装备仍然叠加');
    }

    // 测试穿戴装备
    if (bags.length > 0) {
      console.log('\n4. 测试穿戴装备...');
      const BagService = require('./src/service/bag.service').BagService;
      const bagService = new BagService();
      
      await bagService.wearItem(uid, bags[0].id);
      console.log('  穿戴装备成功');

      // 查看穿戴后背包中的装备
      console.log('\n5. 查看穿戴后背包中的装备...');
      const bagsAfterWear = await query('SELECT id, item_id, count FROM bag WHERE uid = ? AND item_id = ?', [uid, equipItemId]);
      console.log(`  背包中的铁剑数量: ${bagsAfterWear.length} 件`);
      
      if (bagsAfterWear.length === 2) {
        console.log('✅ 测试通过：穿戴后背包中的装备数量正确减少');
      } else {
        console.log('❌ 测试失败：穿戴后背包中的装备数量不正确');
      }

      // 测试卸下装备
      console.log('\n6. 测试卸下装备...');
      const EquipService = require('./src/service/equip.service').EquipService;
      const equipService = new EquipService();
      
      const equips = await query('SELECT id FROM equip WHERE uid = ?', [uid]);
      if (equips.length > 0) {
        await equipService.removeEquip(uid, equips[0].id);
        console.log('  卸下装备成功');

        // 查看卸下后背包中的装备
        console.log('\n7. 查看卸下后背包中的装备...');
        const bagsAfterRemove = await query('SELECT id, item_id, count FROM bag WHERE uid = ? AND item_id = ?', [uid, equipItemId]);
        console.log(`  背包中的铁剑数量: ${bagsAfterRemove.length} 件`);
        
        if (bagsAfterRemove.length === 3) {
          console.log('✅ 测试通过：卸下后装备正确返回背包，且为单独记录');
        } else {
          console.log('❌ 测试失败：卸下后装备没有正确返回背包');
        }
      }
    }

  } catch (error) {
    console.error('测试失败:', error.message);
  } finally {
    console.log('\n=== 测试完成 ===');
  }
}

testEquipNoStack();
