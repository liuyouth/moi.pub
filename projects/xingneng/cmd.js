const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');

class PerformanceMonitor {
    constructor(pid, outputFile) {
        this.pid = pid;
        this.outputFile = outputFile;
        this.isRunning = false;
        this.interval = null;
    }

    async getPerformanceData() {
        try {
            // 使用top命令获取进程信息
            const cmd = `adb shell "top -n 1 -p ${this.pid} | grep ${this.pid}"`;
            const { stdout } = await new Promise((resolve, reject) => {
                exec(cmd, (error, stdout, stderr) => {
                    if (error) reject(error);
                    else resolve({ stdout, stderr });
                });
            });

            // 解析输出数据
            const data = stdout.trim().split(/\s+/);
            if (data.length < 10) {
                throw new Error('Invalid process data');
            }

            // 提取CPU和内存信息
            const timestamp = new Date().toISOString();
            const cpuUsage = parseFloat(data[8]);
            const memUsage = parseFloat(data[9]);

            return {
                timestamp,
                pid: this.pid,
                cpu: cpuUsage,
                memory: memUsage
            };
        } catch (error) {
            console.error('Error getting performance data:', error);
            return null;
        }
    }

    async writeToFile(data) {
        if (!data) return;

        const logEntry = `${JSON.stringify(data)}\n`;
        try {
            await fs.promises.appendFile(this.outputFile, logEntry);
        } catch (error) {
            console.error('Error writing to file:', error);
        }
    }

    start(interval = 1000) {
        if (this.isRunning) {
            console.log('Monitor is already running');
            return;
        }

        this.isRunning = true;
        console.log(`Starting performance monitoring for PID: ${this.pid}`);
        console.log(`Logging to file: ${this.outputFile}`);

        this.interval = setInterval(async () => {
            const data = await this.getPerformanceData();
            await this.writeToFile(data);
        }, interval);
    }

    stop() {
        if (!this.isRunning) {
            console.log('Monitor is not running');
            return;
        }

        clearInterval(this.interval);
        this.isRunning = false;
        console.log('Performance monitoring stopped');
    }
}

// 使用示例
if (require.main === module) {
    const pid = process.argv[2];
    if (!pid) {
        console.error('Please provide a PID');
        process.exit(1);
    }

    const outputFile = path.join(__dirname, `performance_${pid}_${Date.now()}.log`);
    const monitor = new PerformanceMonitor(pid, outputFile);
    
    // 启动监控，每秒记录一次数据
    monitor.start(1000);

    // 监听进程信号以优雅地停止监控
    process.on('SIGINT', () => {
        monitor.stop();
        process.exit(0);
    });
}