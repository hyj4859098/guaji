import { Monster } from './monster';

/** Boss 配置：与怪物结构相同，GM 可配置 */
export interface Boss extends Monster {
  is_boss?: true;
}

/** Boss 运行时状态：全局共享血量 */
export interface BossState {
  boss_id: number;
  current_hp: number;
  max_hp: number;
  last_death_time: number;  // 0=存活，>0=死亡时间戳
}
