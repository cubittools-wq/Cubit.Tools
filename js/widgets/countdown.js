// js/widgets/countdown.js

export default class CountdownWidget {
  constructor(container) {
    this.container = container;
    try {
      this.config = JSON.parse(container.dataset.config || '{}');
    } catch (e) {
      this.config = {};
    }
    this.timerId = null;
    this.init();
  }

  init() {
    this.render();
    this.startCountdown();
  }

  render() {
    this.container.innerHTML = `
      <div class="tool-box" style="text-align: center;">
        <div class="countdown-grid" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="countdown-card" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span id="cd-days" style="display: block; font-size: 2rem; font-weight: bold; color: #2563eb;">00</span>
            <span style="font-size: 0.875rem; color: #64748b; text-transform: uppercase;">Days</span>
          </div>
          <div class="countdown-card" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span id="cd-hours" style="display: block; font-size: 2rem; font-weight: bold; color: #2563eb;">00</span>
            <span style="font-size: 0.875rem; color: #64748b; text-transform: uppercase;">Hours</span>
          </div>
          <div class="countdown-card" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span id="cd-mins" style="display: block; font-size: 2rem; font-weight: bold; color: #2563eb;">00</span>
            <span style="font-size: 0.875rem; color: #64748b; text-transform: uppercase;">Minutes</span>
          </div>
          <div class="countdown-card" style="background: #f8f9fa; padding: 1rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span id="cd-secs" style="display: block; font-size: 2rem; font-weight: bold; color: #2563eb;">00</span>
            <span style="font-size: 0.875rem; color: #64748b; text-transform: uppercase;">Seconds</span>
          </div>
        </div>
        <p id="cd-message" style="margin: 0; font-weight: 500; color: #475569;"></p>
      </div>
    `;
  }

  getTargetDate() {
    const targetStr = this.config.target_date || '12-25'; // MM-DD format expected
    const [month, day] = targetStr.split('-').map(Number);
    
    const now = new Date();
    let year = now.getFullYear();
    
    let target = new Date(year, month - 1, day, 0, 0, 0);
    
    // If target date has already passed this year, roll over to next year
    if (now > target) {
      target = new Date(year + 1, month - 1, day, 0, 0, 0);
    }
    
    return target;
  }

  startCountdown() {
    const update = () => {
      const now = new Date();
      const target = this.getTargetDate();
      const diff = target - now;

      const daysEl = this.container.querySelector('#cd-days');
      const hoursEl = this.container.querySelector('#cd-hours');
      const minsEl = this.container.querySelector('#cd-mins');
      const secsEl = this.container.querySelector('#cd-secs');
      const msgEl = this.container.querySelector('#cd-message');

      if (!daysEl) return;

      if (diff <= 0) {
        daysEl.innerText = '00';
        hoursEl.innerText = '00';
        minsEl.innerText = '00';
        secsEl.innerText = '00';
        msgEl.innerText = this.config.arrival_message || 'The countdown is over!';
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      daysEl.innerText = String(days).padStart(2, '0');
      hoursEl.innerText = String(hours).padStart(2, '0');
      minsEl.innerText = String(minutes).padStart(2, '0');
      secsEl.innerText = String(seconds).padStart(2, '0');
      msgEl.innerText = `Target: ${target.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}`;
    };

    update();
    this.timerId = setInterval(update, 1000);
  }
}