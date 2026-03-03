-- 创建装备基础属性表
CREATE TABLE IF NOT EXISTS equip_base (
  id INT PRIMARY KEY AUTO_INCREMENT,
  item_id INT NOT NULL COMMENT '物品ID',
  pos INT NOT NULL COMMENT '装备位置：2=武器，3=衣服，4=腰带，5=裤子，6=鞋子，7=戒指，8=项链，9=坐骑',
  main_attr VARCHAR(20) NOT NULL COMMENT '主属性：hp, phy_atk, phy_def, mp, mag_def, mag_atk',
  base_hp INT DEFAULT 0 COMMENT '基础HP',
  base_phy_atk INT DEFAULT 0 COMMENT '基础物理攻击',
  base_phy_def INT DEFAULT 0 COMMENT '基础物理防御',
  base_mp INT DEFAULT 0 COMMENT '基础MP',
  base_mag_def INT DEFAULT 0 COMMENT '基础法术防御',
  base_mag_atk INT DEFAULT 0 COMMENT '基础法术攻击',
  create_time INT NOT NULL COMMENT '创建时间',
  update_time INT NOT NULL COMMENT '更新时间',
  UNIQUE KEY uk_item_id (item_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='装备基础属性表';

-- 插入铁剑的基础属性（武器，主属性：物理攻击）
INSERT INTO equip_base (item_id, pos, main_attr, base_phy_atk, create_time, update_time)
VALUES (1, 2, 'phy_atk', 10, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_phy_atk = VALUES(base_phy_atk),
  update_time = VALUES(update_time);

-- 插入铁衣的基础属性（衣服，主属性：物理防御）
INSERT INTO equip_base (item_id, pos, main_attr, base_phy_def, create_time, update_time)
VALUES (2, 3, 'phy_def', 5, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_phy_def = VALUES(base_phy_def),
  update_time = VALUES(update_time);

-- 插入腰带的基础属性（腰带，主属性：MP）
INSERT INTO equip_base (item_id, pos, main_attr, base_mp, create_time, update_time)
VALUES (3, 4, 'mp', 20, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_mp = VALUES(base_mp),
  update_time = VALUES(update_time);

-- 插入铁裤的基础属性（裤子，主属性：法术防御）
INSERT INTO equip_base (item_id, pos, main_attr, base_mag_def, create_time, update_time)
VALUES (4, 5, 'mag_def', 5, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_mag_def = VALUES(base_mag_def),
  update_time = VALUES(update_time);

-- 插入铁鞋的基础属性（鞋子，主属性：物理防御）
INSERT INTO equip_base (item_id, pos, main_attr, base_phy_def, create_time, update_time)
VALUES (5, 6, 'phy_def', 3, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_phy_def = VALUES(base_phy_def),
  update_time = VALUES(update_time);

-- 插入铁戒指的基础属性（戒指，主属性：物理攻击）
INSERT INTO equip_base (item_id, pos, main_attr, base_phy_atk, create_time, update_time)
VALUES (6, 7, 'phy_atk', 5, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_phy_atk = VALUES(base_phy_atk),
  update_time = VALUES(update_time);

-- 插入铁项链的基础属性（项链，主属性：法术攻击）
INSERT INTO equip_base (item_id, pos, main_attr, base_mag_atk, create_time, update_time)
VALUES (7, 8, 'mag_atk', 5, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_mag_atk = VALUES(base_mag_atk),
  update_time = VALUES(update_time);

-- 插入铁马的基础属性（坐骑，主属性：HP）
INSERT INTO equip_base (item_id, pos, main_attr, base_hp, create_time, update_time)
VALUES (8, 9, 'hp', 50, UNIX_TIMESTAMP(), UNIX_TIMESTAMP())
ON DUPLICATE KEY UPDATE 
  pos = VALUES(pos),
  main_attr = VALUES(main_attr),
  base_hp = VALUES(base_hp),
  update_time = VALUES(update_time);
