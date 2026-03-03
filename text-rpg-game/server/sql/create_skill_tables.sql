-- 创建技能表
CREATE TABLE IF NOT EXISTS skill (
  id INT PRIMARY KEY AUTO_INCREMENT,
  skill_id INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  type TINYINT NOT NULL COMMENT '1: 物理, 2: 魔法',
  cost INT NOT NULL COMMENT '技能消耗',
  damage INT NOT NULL COMMENT '技能伤害',
  probability INT NOT NULL COMMENT '技能概率',
  book_id INT NOT NULL COMMENT '技能书ID',
  create_time INT NOT NULL,
  update_time INT NOT NULL
);

-- 创建玩家技能表
CREATE TABLE IF NOT EXISTS player_skill (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid INT NOT NULL,
  skill_id INT NOT NULL,
  level INT NOT NULL DEFAULT 1,
  exp INT NOT NULL DEFAULT 0,
  is_equipped TINYINT NOT NULL DEFAULT 0 COMMENT '0: 未装备, 1: 已装备',
  create_time INT NOT NULL,
  update_time INT NOT NULL,
  UNIQUE KEY uid_skill_id (uid, skill_id)
);

-- 插入示例技能数据
INSERT INTO skill (skill_id, name, type, cost, damage, probability, book_id, create_time, update_time) VALUES
(1, '物理攻击', 1, 10, 50, 100, 1, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(2, '魔法攻击', 2, 15, 60, 100, 2, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(3, '物理暴击', 1, 20, 80, 80, 3, UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
(4, '魔法暴击', 2, 25, 90, 80, 4, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());
