/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      comment: '禁止循环依赖',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-orphans',
      severity: 'info',
      comment: '孤立模块（无入度无出度）',
      from: { orphan: true },
      to: {}
    }
  ],
  options: {
    doNotFollow: {
      path: 'node_modules'
    },
    tsPreCompilationDeps: false,
    reporterOptions: {
      dot: {
        collapsePattern: 'node_modules/[^/]+'
      }
    }
  }
};
