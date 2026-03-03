const MailPage = {
  style: `
    <style>
      .mail-list {
        background: #1a202c;
        border-radius: 8px;
        padding: 16px;
      }
      .mail-item {
        background: #16213e;
        padding: 16px;
        border-radius: 4px;
        margin-bottom: 12px;
        cursor: pointer;
        transition: all 0.3s;
      }
      .mail-item:hover {
        background: #2d3748;
      }
      .mail-item.unread {
        border-left: 4px solid #3b82f6;
      }
      .mail-item.read {
        border-left: 4px solid #4a5568;
      }
      .mail-title {
        font-size: 16px;
        font-weight: bold;
        margin-bottom: 8px;
      }
      .mail-preview {
        font-size: 14px;
        color: #a0aec0;
        margin-bottom: 8px;
      }
      .mail-time {
        font-size: 12px;
        color: #718096;
      }
      .mail-reward {
        background: #3b82f6;
        color: white;
        padding: 4px 8px;
        border-radius: 4px;
        font-size: 12px;
        margin-left: 8px;
      }
    </style>
  `,

  mails: [],

  render() {
    const app = document.getElementById('app');
    app.innerHTML = `
      ${this.style}
      <div class="container">
        <h1 class="text-2xl font-bold m-4">邮件</h1>
        <div class="mail-list">
          ${this.mails.length === 0 ? `
            <div style="text-align: center; padding: 40px; color: #a0aec0;">
              暂无邮件
            </div>
          ` : this.mails.map(mail => {
            const statusClass = mail.status === 0 ? 'unread' : 'read';
            const rewardBtn = mail.status === 0 ? `
              <span class="mail-reward" onclick="event.stopPropagation(); MailPage.receiveReward(${mail.id})">
                领取奖励
              </span>
            ` : mail.status === 1 ? `
              <span class="mail-reward" style="background: #22c55e;" onclick="event.stopPropagation(); MailPage.receiveReward(${mail.id})">
                领取奖励
              </span>
            ` : `
              <span class="mail-reward" style="background: #4a5568;">
                已领取
              </span>
            `;
            return `
              <div class="mail-item ${statusClass}" onclick="MailPage.readMail(${mail.id})">
                <div class="flex justify-between items-center">
                  <div class="mail-title">${mail.title}</div>
                  <div class="mail-time">${Helper.formatDate(mail.create_time)}</div>
                </div>
                <div class="mail-preview">${mail.content.substring(0, 50)}...</div>
                ${rewardBtn}
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
  },

  async load() {
    UI.showLoading();
    const result = await API.get('/mail/list');
    UI.hideLoading();

    if (result.code === 0) {
      this.mails = result.data;
      this.render();
    } else {
      UI.showToast('加载邮件失败');
    }
  },

  async readMail(mailId) {
    const result = await API.post('/mail/read', { id: mailId });

    if (result.code === 0) {
      const mail = this.mails.find(m => m.id === mailId);
      if (mail) {
        mail.status = 1;
        this.render();
      }
    } else {
      UI.showToast(result.msg || '读取失败');
    }
  },

  async receiveReward(mailId) {
    const result = await API.post('/mail/receive', { id: mailId });

    if (result.code === 0) {
      UI.showToast('领取成功');
      this.load();
    } else {
      UI.showToast(result.msg || '领取失败');
    }
  }
};
