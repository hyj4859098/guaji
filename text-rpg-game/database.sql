CREATE DATABASE IF NOT EXISTS text_rpg DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE text_rpg;

CREATE TABLE IF NOT EXISTS user (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  status TINYINT DEFAULT 0 COMMENT '0=正常 1=删除 2=禁用',
  create_time INT NOT NULL,
  update_time INT NOT NULL,
  INDEX idx_username (username),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='用户表';

CREATE TABLE IF NOT EXISTS player (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid INT NOT NULL,
  name VARCHAR(50) NOT NULL,
  level INT DEFAULT 1,
  exp INT DEFAULT 0,
  hp INT DEFAULT 100,
  max_hp INT DEFAULT 100,
  gold INT DEFAULT 0,
  phy_atk INT DEFAULT 10,
  mag_atk INT DEFAULT 10,
  phy_def INT DEFAULT 5,
  mag_def INT DEFAULT 5,
  hit_rate INT DEFAULT 90,
  dodge_rate INT DEFAULT 10,
  crit_rate INT DEFAULT 20,
  status TINYINT DEFAULT 0 COMMENT '0=正常 1=删除 2=禁用',
  create_time INT NOT NULL,
  update_time INT NOT NULL,
  INDEX idx_uid (uid),
  INDEX idx_status (status),
  FOREIGN KEY (uid) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='玩家表';

CREATE TABLE IF NOT EXISTS bag (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid INT NOT NULL,
  item_id INT NOT NULL,
  count INT DEFAULT 1,
  status TINYINT DEFAULT 0 COMMENT '0=正常 1=删除 2=禁用',
  create_time INT NOT NULL,
  update_time INT NOT NULL,
  INDEX idx_uid (uid),
  INDEX idx_item_id (item_id),
  INDEX idx_status (status),
  FOREIGN KEY (uid) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='背包表';

CREATE TABLE IF NOT EXISTS equip (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid INT NOT NULL,
  item_id INT NOT NULL,
  pos INT NOT NULL COMMENT '装备位置',
  status TINYINT DEFAULT 0 COMMENT '0=正常 1=删除 2=禁用',
  create_time INT NOT NULL,
  update_time INT NOT NULL,
  INDEX idx_uid (uid),
  INDEX idx_pos (pos),
  INDEX idx_status (status),
  FOREIGN KEY (uid) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='装备表';

CREATE TABLE IF NOT EXISTS mail (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid INT NOT NULL,
  title VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  reward TEXT COMMENT '奖励JSON',
  status TINYINT DEFAULT 0 COMMENT '0=未读 1=已读 2=已领取',
  create_time INT NOT NULL,
  update_time INT NOT NULL,
  INDEX idx_uid (uid),
  INDEX idx_status (status),
  FOREIGN KEY (uid) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='邮件表';

CREATE TABLE IF NOT EXISTS auction (
  id INT PRIMARY KEY AUTO_INCREMENT,
  uid INT NOT NULL,
  item_id INT NOT NULL,
  price INT NOT NULL,
  status TINYINT DEFAULT 0 COMMENT '0=拍卖中 1=成功 2=失败 3=取消',
  create_time INT NOT NULL,
  update_time INT NOT NULL,
  INDEX idx_uid (uid),
  INDEX idx_status (status),
  FOREIGN KEY (uid) REFERENCES user(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='拍卖表';


