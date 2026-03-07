class EventBus {
    events = new Map();

    on(ev, callback) {
        if (!this.events.has(ev)) {
            this.events.set(ev, new Set());
        }
        this.events.get(ev).add(callback);
        return () => this.off(ev, callback);
    }

    once(ev, callback) {
        const onceWrapper = (...args) => {
            this.off(ev, onceWrapper);
            callback(...args);
        };
        this.on(ev, onceWrapper);
    }

    off(ev, callback) {
        if (!this.events.has(ev)) return;
        this.events.get(ev).delete(callback);
        if (this.events.get(ev).size === 0) {
            this.events.delete(ev);
        }
    }

    emit(ev, ...args) {
        if (!this.events.has(ev)) return;
        const callbacks = [...this.events.get(ev)];
        callbacks.forEach(callback => {
            try {
                callback(...args);
            } catch (err) {
                console.error(`Error in event handler for "${ev}":\n`, err);
            }
        });
    }

    clear() {
        this.events.clear();
    }
}

export const eventBus = new EventBus();
export default eventBus;
