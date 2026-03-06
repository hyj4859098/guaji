/**
 * 前端 ESLint 配置（游戏 + GM）
 * 运行：cd text-rpg-game && npx eslint client -c eslint.client.config.js
 */

const clientForbiddenPatternRules = {
  'no-restricted-syntax': ['error',
    {
      selector: 'BinaryExpression[operator=/^[!=]==?$/] > MemberExpression.left[property.name="type"] ~ Literal.right[value>=1][value<=6]',
      message: '禁止直接比较 .type 数字。请使用 Helper.isEquipment() / Helper.getItemType()',
    },
    {
      selector: 'BinaryExpression[operator=/^[!=]==?$/] > Literal.left[value>=1][value<=6] ~ MemberExpression.right[property.name="type"]',
      message: '禁止直接比较 .type 数字。请使用 Helper.isEquipment() / Helper.getItemType()',
    },
    {
      selector: 'MemberExpression[property.name="hp_restore"]',
      message: '禁止直接访问 .hp_restore。请使用 Helper.getHpRestore()',
    },
    {
      selector: 'MemberExpression[property.name="mp_restore"]',
      message: '禁止直接访问 .mp_restore。请使用 Helper.getMpRestore()',
    },
  ],
};

module.exports = [
  // GM 工具：ES Module（GM 后台不强制 forbidden pattern，属于管理工具）
  {
    files: ['client/gm/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        fetch: 'readonly',
        localStorage: 'readonly',
        location: 'readonly',
        alert: 'readonly',
        confirm: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        JSON: 'readonly',
        Promise: 'readonly',
        Array: 'readonly',
        Object: 'readonly',
        String: 'readonly',
        Number: 'readonly',
        parseInt: 'readonly',
        parseFloat: 'readonly',
        isNaN: 'readonly',
        Math: 'readonly',
        Date: 'readonly',
        Error: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^(_|e|_e|err|error|mapId|btnEl|isEdit)$',
        varsIgnorePattern: '^(_|showToast|verifyToken|getToken|getApiBaseUrl|isEdit)$',
      }],
      'no-undef': 'error',
    },
  },
  // 游戏客户端：Script 模式（排除 helper.js 白名单）
  {
    files: ['client/js/**/*.js'],
    ignores: ['client/js/core/helper.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        window: 'readonly', document: 'readonly', localStorage: 'readonly',
        fetch: 'readonly', WebSocket: 'readonly', console: 'readonly',
        setTimeout: 'readonly', clearTimeout: 'readonly',
        setInterval: 'readonly', clearInterval: 'readonly',
        JSON: 'readonly', Promise: 'readonly', Array: 'readonly',
        Object: 'readonly', String: 'readonly', Number: 'readonly',
        parseInt: 'readonly', parseFloat: 'readonly', isNaN: 'readonly',
        Math: 'readonly', Date: 'readonly', Error: 'readonly',
        location: 'readonly', alert: 'readonly', confirm: 'readonly',
        URLSearchParams: 'readonly', requestAnimationFrame: 'readonly',
        State: 'readonly', API: 'readonly', WS: 'readonly',
        RefreshBus: 'readonly', UI: 'readonly', Helper: 'readonly',
        Tooltip: 'readonly', BagService: 'readonly', BagComponent: 'readonly',
        RolePage: 'readonly', BagPage: 'readonly', EquipPage: 'readonly',
        MapPage: 'readonly', EnemyListPage: 'readonly', BossListPage: 'readonly',
        BattlePage: 'readonly', SkillPage: 'readonly', EnhancePage: 'readonly',
        BoostPage: 'readonly', TradePage: 'readonly', ShopPage: 'readonly',
        AuctionPage: 'readonly', RankPage: 'readonly',
        Pages: 'writable', navigateTo: 'readonly',
        showLogin: 'writable', showRegister: 'writable',
        login: 'writable', register: 'writable', logout: 'writable',
        createPlayer: 'writable', resetToLogin: 'writable',
        setNavDisabledByBattle: 'writable',
      },
    },
    rules: {
      'no-unused-vars': ['warn', {
        argsIgnorePattern: '^(_|e|_e|err|error|mapId|btnEl|isEdit)$',
        varsIgnorePattern: '^(State|API|WS|UI|Helper|RefreshBus|Tooltip|BagService|BagComponent|RolePage|BagPage|EquipPage|MapPage|EnemyListPage|BossListPage|BattlePage|SkillPage|EnhancePage|BoostPage|TradePage|ShopPage|AuctionPage|RankPage|logout|resetToLogin|sendChatMessage)$',
      }],
      'no-undef': 'error',
      ...clientForbiddenPatternRules,
    },
  },
  // helper.js 白名单：工具函数定义本身，不受 forbidden pattern 限制
  {
    files: ['client/js/core/helper.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        Number: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['warn', {
        varsIgnorePattern: '^Helper$',
      }],
      'no-undef': 'error',
    },
  },
];
