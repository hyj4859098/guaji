-- 创建地图表
CREATE TABLE IF NOT EXISTS `map` (
  `id` INT PRIMARY KEY AUTO_INCREMENT,
  `name` VARCHAR(50) NOT NULL,
  `create_time` INT NOT NULL,
  `update_time` INT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 更新怪物表，添加map_id字段
ALTER TABLE `monster` ADD COLUMN `map_id` INT NOT NULL DEFAULT 1 AFTER `reputation`;

-- 添加索引
ALTER TABLE `monster` ADD INDEX `idx_map_id` (`map_id`);

-- 插入初始地图数据
INSERT INTO `map` (`name`, `create_time`, `update_time`) VALUES
('新手村', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('森林', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('沙漠', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('雪山', UNIX_TIMESTAMP(), UNIX_TIMESTAMP()),
('地宫', UNIX_TIMESTAMP(), UNIX_TIMESTAMP());

-- 更新现有怪物的map_id
UPDATE `monster` SET `map_id` = 1;
