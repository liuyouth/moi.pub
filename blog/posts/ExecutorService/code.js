export const codeContent = {
    V2xThreadPoolManager: `package com.baidu.v2xlib.core;

/**
 * V2X线程池管理器
 * 提供线程池的统一管理和使用接口
 * 采用单例模式确保线程池的唯一性
 */
public class V2xThreadPoolManager {
    private static final String TAG = "V2xThreadPoolManager";

    /**
     * 定时任务线程池的核心线程数
     * 用于处理定时任务和周期性任务
     */
    private static final int SCHEDULED_POOL_SIZE = 4;

    /**
     * 普通任务线程池的固定线程数
     * 用于处理一般的异步任务
     */
    private static final int GENERAL_POOL_SIZE = 1;

    /**
     * 定时任务线程池
     * 主要用于执行需要定时或周期性执行的任务
     * 例如：定时获取设备状态、周期性上报数据等
     */
    private ScheduledExecutorService scheduledPool;

    /**
     * 普通任务线程池
     * 用于执行一般的异步任务
     * 例如：数据处理、IO操作等
     */
    private ExecutorService generalPool;

    /**
     * ThreadPoolManager的单例实例
     * volatile关键字确保多线程环境下的可见性
     */
    private static volatile V2xThreadPoolManager instance;

    /**
     * 定时任务信号量
     * 用于限制最大并发执行任务数为10个，超出的任务将等待最多10秒
     * 如果等待超时，任务将被丢弃并记录日志
     * 使用公平信号量确保任务按照FIFO顺序执行
     */
    private static final Semaphore scheduledTasksSemaphore = new Semaphore(10, true);

    /**
     * 定时任务等待超时时间，单位毫秒
     */
    private static final int TASK_WAIT_TIMEOUT_MS = 10000;

    /**
     * 最大并发执行定时任务数
     */
    private static final int MAX_CONCURRENT_SCHEDULED_TASKS = 10;

    /**
     * 获取ThreadPoolManager的单例实例
     * 使用双重检查锁定模式确保线程安全
     *
     * @return ThreadPoolManager实例
     */
    public static V2xThreadPoolManager getInstance() {
        if (instance == null) {
            synchronized (V2xThreadPoolManager.class) {
                if (instance == null) {
                    instance = new V2xThreadPoolManager();
                }
            }
        }
        return instance;
    }

    /**
     * 私有构造函数
     * 初始化线程池
     */
    private V2xThreadPoolManager() {
        initPools();
    }

    /**
     * 初始化线程池
     * 创建并配置线程池
     */
    private synchronized void initPools() {
        V2xLogger.necessaryLog(TAG, "开始初始化线程池...");
        scheduledPool = V2xThreadPoolUtil.newScheduledThreadPool(SCHEDULED_POOL_SIZE, "scheduled-pool");
        generalPool = V2xThreadPoolUtil.newFixedThreadPool(GENERAL_POOL_SIZE, "general-pool");
        V2xLogger.necessaryLog(TAG, "线程池初始化完成");
    }

    /**
     * 重新初始化线程池
     * 如果线程池已关闭，调用此方法可以重新创建线程池
     * 注意：调用此方法前确保之前的线程池已经完全关闭，否则可能导致资源泄漏
     */
    public synchronized void restart() {

        V2xLogger.necessaryLog(TAG, "开始重新初始化线程池...");
        // 如果线程池还在运行，先关闭
        if (scheduledPool != null && !scheduledPool.isShutdown()) {
            scheduledPool.shutdown();
        }
        if (generalPool != null && !generalPool.isShutdown()) {
            generalPool.shutdown();
        }

        // 等待线程池完全关闭
        try {
            if (scheduledPool != null) {
                scheduledPool.awaitTermination(1, TimeUnit.SECONDS);
            }
            if (generalPool != null) {
                generalPool.awaitTermination(1, TimeUnit.SECONDS);
            }
        } catch (InterruptedException e) {
            V2xLogger.necessaryLog(TAG, "等待线程池关闭被中断", e);
            Thread.currentThread().interrupt();
        }

        // 重新初始化线程池
        initPools();
        V2xLogger.necessaryLog(TAG, "线程池重新初始化完成");
    }

    /**
     * 提交定时任务，使用固定延迟而不是固定频率
     * 使用scheduleWithFixedDelay替代scheduleAtFixedRate，避免Android进程缓存导致的任务堆积问题
     *
     * @param task 要执行的任务
     * @param initialDelay 初始延迟时间
     * @param delay 任务之间的延迟时间（前一个任务结束到下一个任务开始的时间间隔）
     * @param unit 时间单位
     * @return ScheduledFuture对象，可用于控制任务的执行，如果线程池不可用返回null
     */
    public ScheduledFuture<?> scheduleWithFixedDelay(Runnable task, long initialDelay, long delay, TimeUnit unit) {
        if (V2xThreadPoolUtil.checkExecutorAvailable(scheduledPool)) {
            return scheduledPool.scheduleWithFixedDelay(V2xThreadPoolUtil.wrapTask(task), initialDelay, delay, unit);
        }
        return null;
    }

    /**
     * 在Android环境中不建议使用此方法，因为可能导致任务堆积。请使用 {@link #scheduleWithFixedDelay} 替代
     * 我们的任务本身不会太耗时 所以直接用这个也应该没问题但是可能会因为系统环境（如应用进程被缓存）影响了任务的执行频率。
     * 导致的定时任务的执行不准确。所以因为我们任务不会太耗时只是传递消息所以用执行完消息再固定间隔执行新任务影响也不会太大
     * 
     * 现已添加信号量控制，限制最大并发执行任务数为10个，超出的任务将等待最多10秒
     * 如果等待超时，任务将被丢弃并记录日志
     * 使用公平信号量确保任务按照FIFO顺序执行
     */
    public ScheduledFuture<?> scheduleAtFixedRate(Runnable task, long initialDelay, long period, TimeUnit unit) {
        if (V2xThreadPoolUtil.checkExecutorAvailable(scheduledPool)) {
            Runnable wrappedTask = () -> {
                boolean acquired = false;
                long startWaitTime = System.currentTimeMillis();
                try {
                    // 尝试在指定时间内获取信号量
                    acquired = scheduledTasksSemaphore.tryAcquire(TASK_WAIT_TIMEOUT_MS, TimeUnit.MILLISECONDS);
                    if (acquired) {
                        try {
                            long waitTime = System.currentTimeMillis() - startWaitTime;
                            if (waitTime > 1000) { // 如果等待时间超过1秒，记录日志
                                V2xLogger.necessaryLog(TAG, "定时任务等待时间较长: " + waitTime + "ms");
                            }
                            V2xThreadPoolUtil.wrapTask(task).run();
                        } finally {
                            scheduledTasksSemaphore.release();
                        }
                    } else {
                        // 获取信号量超时，记录日志
                        V2xLogger.necessaryLog(TAG, String.format("定时任务等待超时被丢弃 等待时长: %dms, 当前活跃任务数: %d", 
                                System.currentTimeMillis() - startWaitTime,
                                MAX_CONCURRENT_SCHEDULED_TASKS - scheduledTasksSemaphore.availablePermits()));
                    }
                } catch (InterruptedException e) {
                    V2xLogger.necessaryLog(TAG, "定时任务等待执行被中断", e);
                    Thread.currentThread().interrupt();
                    if (acquired) {
                        scheduledTasksSemaphore.release();
                    }
                }
            };
            return scheduledPool.scheduleAtFixedRate(wrappedTask, initialDelay, period, unit);
        }
        return null;
    }

    /**
     * 提交普通任务
     * 任务将在线程池中异步执行
     *
     * @param task 要执行的任务
     * @return 是否成功提交任务
     */
    public Boolean submitGeneralTask(Runnable task) {
        if (V2xThreadPoolUtil.checkExecutorAvailable(generalPool)) {
            generalPool.execute(V2xThreadPoolUtil.wrapTask(task));
            return true;
        }
        return null;
    }

    /**
     * 强制关闭所有线程池
     * 调用此方法后，线程池将不再接受新任务，并中断所有正在执行的任务
     * 队列中等待的任务将被取消且不会执行
     */
    public void shutdownNow() {
        V2xLogger.necessaryLog(TAG, "开始强制关闭线程池...");
        if (scheduledPool != null && !scheduledPool.isShutdown()) {
            scheduledPool.shutdownNow();
            // 释放所有信号量许可，确保重启时信号量处于初始状态
            scheduledTasksSemaphore.drainPermits();
            scheduledTasksSemaphore.release(MAX_CONCURRENT_SCHEDULED_TASKS);
            V2xLogger.necessaryLog(TAG, "定时任务线程池已强制关闭");
        }
        if (generalPool != null && !generalPool.isShutdown()) {
            generalPool.shutdownNow();
            V2xLogger.necessaryLog(TAG, "普通任务线程池已强制关闭");
        }
        V2xLogger.necessaryLog(TAG, "线程池强制关闭完成");
    }

    /**
     * 关闭所有线程池
     * 调用此方法后，线程池将不再接受新任务，但会继续执行已提交的任务
     */
    public void shutdown() {
        V2xLogger.necessaryLog(TAG, "开始关闭线程池...");
        if (scheduledPool != null && !scheduledPool.isShutdown()) {
            scheduledPool.shutdown();
            // 等待所有任务完成后重置信号量
            try {
                if (scheduledPool.awaitTermination(TASK_WAIT_TIMEOUT_MS, TimeUnit.MILLISECONDS)) {
                    scheduledTasksSemaphore.drainPermits();
                    scheduledTasksSemaphore.release(MAX_CONCURRENT_SCHEDULED_TASKS);
                }
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            V2xLogger.necessaryLog(TAG, "定时任务线程池已关闭");
        }
        if (generalPool != null && !generalPool.isShutdown()) {
            generalPool.shutdown();
            V2xLogger.necessaryLog(TAG, "普通任务线程池已关闭");
        }
        V2xLogger.necessaryLog(TAG, "线程池关闭完成");
    }

}`,
    V2xThreadPoolUtil: `package com.baidu.v2xlib.utils;

import android.util.Log;

import com.baidu.v2xlib.logger.V2xLogger;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledThreadPoolExecutor;
import java.util.concurrent.ThreadFactory;
import java.util.concurrent.ThreadPoolExecutor;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * 线程池工具类，提供创建各种线程池的功能
 */
public class V2xThreadPoolUtil {
    private static final String TAG = "ThreadPoolUtil";

    /**
     * 检查线程池状态
     * @param executor 要检查的线程池
     * @return 如果线程池可用返回true，否则返回false
     */
    public static boolean checkExecutorAvailable(ExecutorService executor) {
        if (executor == null) {
            V2xLogger.necessaryLog(TAG, "线程池未初始化");
            return false;
        }
        if (executor.isShutdown() || executor.isTerminated()) {
            V2xLogger.necessaryLog(TAG, "线程池已关闭或终止");
            return false;
        }
        return true;
    }

    /**
     * 创建固定线程数的线程池
     *
     * @param nThreads 线程数量
     * @param threadNamePrefix 线程名称前缀
     * @return 固定线程数的线程池
     */
    public static ExecutorService newFixedThreadPool(int nThreads, String threadNamePrefix) {
        return new ThreadPoolExecutor(nThreads, nThreads,
                0L, TimeUnit.MILLISECONDS,
                new LinkedBlockingQueue<>(),
                new NamedThreadFactory(threadNamePrefix));
    }

    /**
     * 创建定时任务线程池
     *
     * @param corePoolSize 核心线程数
     * @param threadNamePrefix 线程名称前缀
     * @return 定时任务线程池
     */
    public static ScheduledExecutorService newScheduledThreadPool(int corePoolSize, String threadNamePrefix) {
        return new ScheduledThreadPoolExecutor(corePoolSize, new NamedThreadFactory(threadNamePrefix));
    }

    /**
     * 包装任务，捕获并记录异常
     *
     * @param task 原始任务
     * @return 包装后的任务
     */
    public static Runnable wrapTask(final Runnable task) {
        return new Runnable() {
            @Override
            public void run() {
                try {
                    task.run();
                } catch (Exception e) {
                    V2xLogger.necessaryLog(TAG, "wrapTask error ", e);
                }
            }
        };
    }

    /**
     * 自定义线程工厂，用于创建带有指定前缀名称的线程
     */
    private static class NamedThreadFactory implements ThreadFactory {
        private final AtomicInteger threadNumber = new AtomicInteger(1);
        private final String namePrefix;

        NamedThreadFactory(String namePrefix) {
            this.namePrefix = namePrefix;
        }

        @Override
        public Thread newThread(Runnable r) {
            Thread t = new Thread(r, namePrefix + "-" + threadNumber.getAndIncrement());
            if (t.isDaemon()) {
                t.setDaemon(false);
            }
            if (t.getPriority() != Thread.NORM_PRIORITY) {
                t.setPriority(Thread.NORM_PRIORITY);
            }
            return t;
        }
    }
}`  };