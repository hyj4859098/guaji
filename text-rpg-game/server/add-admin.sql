-- 修改用户表，添加is_admin字段
ALTER TABLE user ADD COLUMN is_admin TINYINT DEFAULT 0 COMMENT '是否为管理员 0=否 1=是';

-- 将用户asd4859098设为管理员
UPDATE user SET is_admin = 1 WHERE username = 'asd4859098';

-- 查看修改结果
SELECT id, username, is_admin FROM user WHERE username = 'asd4859098';