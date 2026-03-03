const axios = require('axios');

const API_BASE_URL = 'http://localhost:3000/api';
const TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOjEsImlhdCI6MTc3MTgyMzk5MCwiZXhwIjoxNzc4MDgwMzkwfQ.cV7K6v2k9wQw0X3f3wQw0X3f3wQw0X3f3wQw0X3f3';

async function testApiCalls() {
  console.log('Testing API calls...');
  
  try {
    // 测试获取玩家信息
    console.log('Testing player list API...');
    const playerResponse = await axios.get(`${API_BASE_URL}/player/list`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    console.log('Player list response:', playerResponse.data);
    
    // 测试获取背包列表
    console.log('Testing bag list API...');
    const bagResponse = await axios.get(`${API_BASE_URL}/bag/list`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    console.log('Bag list response:', bagResponse.data);
    
    // 测试获取装备列表
    console.log('Testing equip list API...');
    const equipResponse = await axios.get(`${API_BASE_URL}/equip/list`, {
      headers: {
        'Authorization': `Bearer ${TOKEN}`
      }
    });
    console.log('Equip list response:', equipResponse.data);
    
    console.log('All API tests passed successfully!');
  } catch (error) {
    console.error('API test failed:', error.response ? error.response.data : error.message);
  }
}

testApiCalls();