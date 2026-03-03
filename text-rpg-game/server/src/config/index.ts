export const config = {
  port: 3000,
  jwt_secret: 'your-secret-key-change-in-production',
  jwt_expire: '7d',
  mongodb: {
    url: 'mongodb://localhost:27017',
    database: 'turn-based-game'
  },
  ws_port: 3001
};
