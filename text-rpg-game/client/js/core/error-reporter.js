/**
 * 前端错误自动上报
 * JS 报错、未捕获的 Promise rejection 都会发送到后端日志
 */
(function () {
  const REPORT_URL = '/api/client-error';
  let _lastReport = 0;

  function report(data) {
    const now = Date.now();
    if (now - _lastReport < 2000) return;
    _lastReport = now;
    try {
      const payload = {
        ...data,
        uid: typeof State !== 'undefined' ? State.uid : undefined,
        page: typeof State !== 'undefined' ? State.currentPage : undefined,
        userAgent: navigator.userAgent,
        time: new Date().toISOString(),
      };
      navigator.sendBeacon(REPORT_URL, JSON.stringify(payload));
    } catch (_) { /* 上报本身不能报错 */ }
  }

  window.addEventListener('error', function (e) {
    report({
      type: 'js_error',
      message: e.message,
      url: e.filename,
      line: e.lineno,
      col: e.colno,
      stack: e.error?.stack,
    });
  });

  window.addEventListener('unhandledrejection', function (e) {
    const reason = e.reason;
    report({
      type: 'promise_rejection',
      message: reason?.message || String(reason),
      stack: reason?.stack,
    });
  });
})();
