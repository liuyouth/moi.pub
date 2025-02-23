// 待办事项数据
const todoData = {
    // 获取默认数据
    get defaultItems() {
        // 如果存在defaultTodoItems，则使用它
        if (typeof defaultTodoItems !== 'undefined') {
            return defaultTodoItems;
        }
        // 如果获取失败，返回空数组
        console.warn('无法获取默认待办事项数据');
        return [];
    },

    // 实际数据（从本地存储加载或使用默认值）
    items: [],
    
    // 操作记录
    operationLogs: [],

    // 初始化数据
    init() {
        console.log('初始化 todoData');
        
        // 加载待办事项
        const storedData = localStorage.getItem('todoItems');
        if (storedData) {
            try {
                const localItems = JSON.parse(storedData);
                // 合并默认数据和本地存储数据
                this.items = this.mergeItems(this.defaultItems, localItems);
                console.log('合并后的数据:', this.items);
            } catch (e) {
                console.error('解析本地存储数据失败:', e);
                this.items = [...this.defaultItems];
            }
        } else {
            console.log('使用默认数据');
            this.items = [...this.defaultItems];
        }
        
        // 加载操作记录
        const storedLogs = localStorage.getItem('todoLogs');
        if (storedLogs) {
            try {
                this.operationLogs = JSON.parse(storedLogs);
            } catch (e) {
                console.error('解析操作记录失败:', e);
                this.operationLogs = [];
            }
        } else {
            this.operationLogs = [];
        }
        
        // 确保保存到本地存储
        this.saveToLocal();
        
        return this;
    },

    // 合并默认数据和本地存储数据
    mergeItems(defaultItems, localItems) {
        // 创建ID映射
        const defaultMap = new Map(defaultItems.map(item => [item.id, item]));
        const localMap = new Map(localItems.map(item => [item.id, item]));
        
        // 合并结果
        const mergedMap = new Map([...defaultMap, ...localMap]);
        
        // 转换回数组并按ID排序
        return Array.from(mergedMap.values()).sort((a, b) => a.id - b.id);
    },

    // 获取所有待办事项
    getAllTodos() {
        // 如果 items 为空，重新初始化
        if (!this.items || this.items.length === 0) {
            console.log('items为空，重新初始化');
            this.items = [...this.defaultItems];
            this.saveToLocal();
        }
        return this.items;
    },

    // 添加新的待办事项
    addTodo(todo) {
        const newTodo = {
            id: this.items.length + 1,
            createTime: new Date().toISOString().split('T')[0],
            updateTime: null,
            status: "pending",
            priority: "medium",
            description: "",
            tags: [],
            progress: 0,
            ...todo
        };
        this.items.push(newTodo);
        this.saveToLocal();
        
        this.logOperation({
            type: 'add',
            todoId: newTodo.id,
            details: newTodo
        });
        
        return newTodo;
    },

    // 更新待办事项状态
    updateTodoStatus(id, status) {
        const todo = this.items.find(item => item.id === id);
        if (todo) {
            const oldStatus = todo.status;
            todo.status = status;
            todo.updateTime = new Date().toISOString().split('T')[0];
            this.saveToLocal();
            
            this.logOperation({
                type: 'updateStatus',
                todoId: id,
                details: { oldStatus, newStatus: status }
            });
        }
        return todo;
    },

    // 编辑待办事项
    editTodo(id, updates) {
        const todo = this.items.find(item => item.id === id);
        if (todo) {
            const oldTodo = { ...todo };
            Object.assign(todo, updates);
            todo.updateTime = new Date().toISOString().split('T')[0];
            this.saveToLocal();
            
            this.logOperation({
                type: 'edit',
                todoId: id,
                details: { old: oldTodo, new: todo }
            });
        }
        return todo;
    },

    // 删除待办事项
    deleteTodo(id) {
        const index = this.items.findIndex(item => item.id === id);
        if (index !== -1) {
            const deletedTodo = this.items[index];
            this.items.splice(index, 1);
            this.saveToLocal();
            
            this.logOperation({
                type: 'delete',
                todoId: id,
                details: deletedTodo
            });
            
            return true;
        }
        return false;
    },

    // 保存到本地存储
    saveToLocal() {
        localStorage.setItem('todoItems', JSON.stringify(this.items));
    },

    // 记录操作
    logOperation(operation) {
        const log = {
            ...operation,
            timestamp: new Date().toISOString(),
            todoSnapshot: JSON.stringify(this.items)
        };
        this.operationLogs.push(log);
        localStorage.setItem('todoLogs', JSON.stringify(this.operationLogs));
    },

    // 导出数据为JS文件格式
    exportAsJS() {
        return `// 待办事项数据
const todoData = {
    defaultItems: ${JSON.stringify(this.items, null, 4)}
};`;
    },

    // 导出操作记录
    exportLogs() {
        return JSON.stringify(this.operationLogs, null, 4);
    }
};

// 初始化
todoData.init(); 