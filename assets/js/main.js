// 统一初始化函数
function initializeApp() {
  
    // 设置跑马灯
    setupMarquee();
    // 添加 loaded 类，显示页面
    document.body.classList.add('loaded');
    // 初始化所有待办事项的可见性
    const todoItems = document.querySelectorAll('.todo-item');
    todoItems.forEach(item => {
        item.classList.add('initialized');
    });
}



function setupMarquee() {
    const container = document.querySelector('.marquee-container');
    const marquee = document.getElementById('marquee');
    const content = marquee.innerHTML;

    // 计算容器和内容的宽度
    const containerWidth = container.offsetWidth;
    const contentWidth = marquee.offsetWidth;

    // 增加重复次数以确保无缝衔接
    const repeatCount = Math.ceil((containerWidth * 3) / contentWidth);
    
    // 重复内容
    marquee.innerHTML = content.repeat(repeatCount);
    
    // 调整动画速度因子，使动画更流畅
    const speedFactor = 25;
    const animationDuration = (contentWidth * repeatCount) / speedFactor;

    // 应用动画
    marquee.style.animation = `marquee ${animationDuration}s linear infinite`;
}

// 监听窗口大小变化
window.addEventListener('resize', () => {
    
    setupMarquee();
});

// 页面加载完成后初始化
window.addEventListener('load', initializeApp);