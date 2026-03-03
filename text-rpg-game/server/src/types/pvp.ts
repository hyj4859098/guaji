export interface PvpRecord {
  attacker_uid: string;
  defender_uid: string;
  attacker_name: string;
  defender_name: string;
  winner_uid: string;
  rounds: number;
  attacker_hp_left: number;
  defender_hp_left: number;
  reward_gold: number;
  reward_reputation: number;
  create_time: number;
}

export interface PvpRanking {
  uid: string;
  name: string;
  level: number;
  wins: number;
  losses: number;
  score: number;
}

export interface PvpDailyRecord {
  uid: string;
  date: string;
  attacks: number;
  last_attack_time: number;
}
