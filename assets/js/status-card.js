// 辅助函数
function getDaysInMonth(year, month) {
    return new Date(year, month + 1, 0).getDate();
}

function getWeekOfMonth(date) {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const firstWeekday = firstDay.getDay() || 7;
    const offsetDate = date.getDate() + firstWeekday - 1;
    return Math.floor(offsetDate / 7);
}

function getMonthWeeks(year, month) {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const firstWeekday = firstDay.getDay() || 7;
    const lastWeekday = lastDay.getDay() || 7;
    
    // 计算每周的天数和位置
    const weeks = [];
    let currentDate = 1;
    let currentWeek = [];
    
    // 处理第一周（可能不完整）
    for (let i = 1; i < firstWeekday; i++) {
        currentWeek.push(null);
    }
    for (let i = firstWeekday; i <= 7; i++) {
        currentWeek.push(currentDate++);
    }
    weeks.push(currentWeek);
    
    // 处理中间的完整周
    while (currentDate <= lastDay.getDate() - lastWeekday) {
        currentWeek = [];
        for (let i = 0; i < 7; i++) {
            currentWeek.push(currentDate++);
        }
        weeks.push(currentWeek);
    }
    
    // 处理最后一周（可能不完整）
    if (currentDate <= lastDay.getDate()) {
        currentWeek = [];
        while (currentDate <= lastDay.getDate()) {
            currentWeek.push(currentDate++);
        }
        while (currentWeek.length < 7) {
            currentWeek.push(null);
        }
        weeks.push(currentWeek);
    }
    
    return weeks;
}

function calculateWeekMarkers(weeks, totalDays) {
    const markers = [];
    let accumulator = 0;
    
    weeks.forEach((week, index) => {
        if (index < weeks.length - 1) {
            accumulator += week.filter(day => day !== null).length;
            markers.push((accumulator / totalDays) * 100);
        }
    });
    
    return markers;
}

function getDayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    const diff = date - start;
    const oneDay = 1000 * 60 * 60 * 24;
    return Math.floor(diff / oneDay);
}

function getDaysInYear(year) {
    return ((year % 4 === 0 && year % 100 > 0) || year % 400 === 0) ? 366 : 365;
}

// 状态卡片控制器
class StatusCardController {
    constructor() {
        this.timeElement = document.querySelector('.current-time .time');
        this.dateElement = document.querySelector('.current-time .date');
        this.dayIndicators = document.querySelectorAll('.day-indicator');
        this.initialized = false;
        
        // 初始化
        this.init();
    }

    init() {
        // 启动时间更新
        this.updateTime();
        setInterval(() => this.updateTime(), 1000);

        // 先更新一次进度值，但不显示
        this.updateProgress(false);

        // 等待开屏动画结束（大约3秒）后再初始化进度条动画
        setTimeout(() => {
            // 添加动画类
            document.querySelectorAll('.progress-bar').forEach(bar => {
                bar.classList.add('animate');
            });
            
            this.initialized = true;
            
            // 设置定时更新
            setInterval(() => this.updateProgress(true), 60000);
        }, 3000);
    }

    updateTime() {
        const now = new Date();
        
        // 更新时间
        if (this.timeElement) {
            this.timeElement.textContent = now.toLocaleTimeString('zh-CN', {
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            }).replace(/:/g, ':');
        }

        // 更新日期
        if (this.dateElement) {
            this.dateElement.textContent = now.toLocaleDateString('zh-CN', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit'
            }).replace(/\//g, ' / ');
        }
    }

    updateProgress(animate = true) {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const date = now.getDate();
        
        // 计算年度进度
        const yearProgress = Math.round((getDayOfYear(now) / getDaysInYear(year)) * 100);
        document.getElementById('countdown-year').textContent = yearProgress + '%';
        const yearProgressBar = document.getElementById('year-progress');
        yearProgressBar.style.setProperty('--progress-width', yearProgress + '%');
        document.getElementById('year-detail').textContent = `剩余 ${getDaysInYear(year) - getDayOfYear(now)} 天`;
        
        // 计算月进度
        const totalDaysInMonth = getDaysInMonth(year, month);
        const monthWeeks = getMonthWeeks(year, month);
        const weekMarkers = calculateWeekMarkers(monthWeeks, totalDaysInMonth);
        
        // 更新月进度条的周分段标记
        const monthProgressBar = document.getElementById('quarter-progress');
        monthProgressBar.innerHTML = ''; // 清除现有标记
        
        // 添加周分段标记
        weekMarkers.forEach((position) => {
            const marker = document.createElement('div');
            marker.className = 'progress-marker';
            marker.style.left = `${position}%`;
            monthProgressBar.appendChild(marker);
        });
        
        // 计算当前月进度
        const monthProgress = (date / totalDaysInMonth) * 100;
        monthProgressBar.style.setProperty('--progress-width', monthProgress + '%');
        
        // 计算周进度（考虑当天时间）
        const weekday = now.getDay() || 7;
        const currentHour = now.getHours();
        const currentMinute = now.getMinutes();
        const currentSecond = now.getSeconds();
        
        // 计算当天已经过去的比例
        const dayProgress = (currentHour * 3600 + currentMinute * 60 + currentSecond) / (24 * 3600);
        
        // 计算周进度：(已过天数 + 当天进度) / 7
        const weekProgress = ((weekday - 1 + dayProgress) / 7) * 100;
        const weekProgressBar = document.getElementById('week-progress');
        weekProgressBar.style.setProperty('--progress-width', weekProgress + '%');
        
        // 如果需要动画效果，添加动画类
        if (animate && this.initialized) {
            [yearProgressBar, monthProgressBar, weekProgressBar].forEach(bar => {
                bar.classList.add('animate');
            });
        }
        
        // 更新周指示器
        this.updateDayIndicators(weekday);
    }

    updateDayIndicators(currentDay) {
        this.dayIndicators.forEach((indicator, index) => {
            const day = index + 1;
            indicator.classList.remove('active', 'passed');
            
            if (day < currentDay) {
                indicator.classList.add('passed');
            } else if (day === currentDay) {
                indicator.classList.add('active');
            }
        });
    }
}

// 当DOM加载完成后初始化
document.addEventListener('DOMContentLoaded', () => {
    new StatusCardController();
}); 