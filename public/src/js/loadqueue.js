class LoadQueue {
    constructor() {
        this.queue = []
        this.running = 0
        this.maxRunning = 1
    }
    add(callback) {
        var task = {
            callback: callback,
            cancelled: false
        }
        this.queue.push(task)
        this.run()
        return task
    }
    cancel(task) {
        if (task) {
            task.cancelled = true
            var index = this.queue.indexOf(task)
            if (index !== -1) {
                this.queue.splice(index, 1)
            }
        }
    }
    run() {
        if (this.running >= this.maxRunning || this.queue.length === 0) {
            return
        }
        var task = this.queue.shift()
        if (task.cancelled) {
            this.run()
            return
        }
        this.running++
        task.callback().then(() => {
            this.running--
            this.run()
        }, () => {
            this.running--
            this.run()
        })
    }
}
