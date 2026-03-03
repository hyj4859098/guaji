const mysql = require('mysql2/promise');

async function createMonsterTable() {
  const connection = await mysql.createConnection({
    host: 'localhost',
    port: 3306,
    user: 'root',
    password: 'root123',
    database: 'text_rpg'
  });

  console.log('=== 创建怪物表 ===\n');

  try {
    // 创建怪物表
    await connection.query(`
      CREATE TABLE IF NOT EXISTS monster (
        id INT PRIMARY KEY AUTO_INCREMENT,
        name VARCHAR(50) NOT NULL COMMENT '怪物名称',
        level TINYINT NOT NULL COMMENT '怪物等级',
        hp INT NOT NULL COMMENT '生命值',
        mp INT NOT NULL COMMENT '魔法值',
        phy_atk INT NOT NULL COMMENT '物理攻击',
        phy_def INT NOT NULL COMMENT '物理防御',
        mag_atk INT NOT NULL COMMENT '法术攻击',
        mag_def INT NOT NULL COMMENT '法术防御',
        skill1 VARCHAR(50) NOT NULL COMMENT '技能1',
        skill2 VARCHAR(50) NOT NULL COMMENT '技能2',
        hit_rate INT NOT NULL COMMENT '命中率',
        dodge_rate INT NOT NULL COMMENT '闪避率',
        crit_rate INT NOT NULL COMMENT '暴击率',
        exp INT NOT NULL COMMENT '战胜后获得经验',
        gold INT NOT NULL COMMENT '战胜后获得金币',
        reputation INT NOT NULL COMMENT '战胜后获得声望',
        status TINYINT DEFAULT 0 COMMENT '0=正常 1=删除 2=禁用',
        create_time INT NOT NULL,
        update_time INT NOT NULL,
        INDEX idx_level (level),
        INDEX idx_status (status)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='怪物表'
    `);
    console.log('✅ 怪物表创建成功');

    // 插入基础怪物数据
    const monsters = [
      {
        name: '史莱姆',
        level: 1,
        hp: 50,
        mp: 20,
        phy_atk: 5,
        phy_def: 2,
        mag_atk: 3,
        mag_def: 1,
        skill1: '撞击',
        skill2: '粘液',
        hit_rate: 80,
        dodge_rate: 5,
        crit_rate: 10,
        exp: 10,
        gold: 5,
        reputation: 1
      },
      {
        name: '哥布林',
        level: 3,
        hp: 100,
        mp: 30,
        phy_atk: 10,
        phy_def: 5,
        mag_atk: 5,
        mag_def: 3,
        skill1: '短剑攻击',
        skill2: '投掷石块',
        hit_rate: 85,
        dodge_rate: 10,
        crit_rate: 15,
        exp: 20,
        gold: 15,
        reputation: 3
      },
      {
        name: '骷髅兵',
        level: 5,
        hp: 150,
        mp: 40,
        phy_atk: 15,
        phy_def: 8,
        mag_atk: 8,
        mag_def: 5,
        skill1: '骨剑斩',
        skill2: '死亡凝视',
        hit_rate: 90,
        dodge_rate: 15,
        crit_rate: 20,
        exp: 30,
        gold: 25,
        reputation: 5
      },
      {
        name: '狼人',
        level: 8,
        hp: 200,
        mp: 50,
        phy_atk: 20,
        phy_def: 12,
        mag_atk: 12,
        mag_def: 8,
        skill1: '利爪攻击',
        skill2: '野性冲锋',
        hit_rate: 95,
        dodge_rate: 20,
        crit_rate: 25,
        exp: 50,
        gold: 40,
        reputation: 8
      },
      {
        name: '巨龙',
        level: 10,
        hp: 500,
        mp: 100,
        phy_atk: 50,
        phy_def: 30,
        mag_atk: 40,
        mag_def: 25,
        skill1: '火焰吐息',
        skill2: '龙爪撕裂',
        hit_rate: 100,
        dodge_rate: 25,
        crit_rate: 30,
        exp: 100,
        gold: 100,
        reputation: 20
      }
    ];

    const now = Math.floor(Date.now() / 1000);
    for (const monster of monsters) {
      await connection.query(
        `INSERT INTO monster 
         (name, level, hp, mp, phy_atk, phy_def, mag_atk, mag_def, skill1, skill2, hit_rate, dodge_rate, crit_rate, exp, gold, reputation, status, create_time, update_time) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?)`,
        [
          monster.name,
          monster.level,
          monster.hp,
          monster.mp,
          monster.phy_atk,
          monster.phy_def,
          monster.mag_atk,
          monster.mag_def,
          monster.skill1,
          monster.skill2,
          monster.hit_rate,
          monster.dodge_rate,
          monster.crit_rate,
          monster.exp,
          monster.gold,
          monster.reputation,
          now,
          now
        ]
      );
      console.log(`✅ 插入怪物: ${monster.name} (Lv${monster.level})`);
    }

    // 测试查询怪物表
    const [result] = await connection.query('SELECT id, name, level, hp, phy_atk, exp, gold, reputation FROM monster WHERE status = 0 ORDER BY level ASC');
    console.log('\n=== 怪物表数据 ===');
    result.forEach(monster => {
      console.log(`ID: ${monster.id}, 名称: ${monster.name}, 等级: ${monster.level}, HP: ${monster.hp}, 攻击: ${monster.phy_atk}, 经验: ${monster.exp}, 金币: ${monster.gold}, 声望: ${monster.reputation}`);
    });

    console.log('\n=== 怪物表创建完成 ===');
  } catch (error) {
    console.error('❌ 错误:', error.message);
  } finally {
    await connection.end();
  }
}

createMonsterTable();
