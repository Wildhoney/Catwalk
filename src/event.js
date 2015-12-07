/**
 * @constant SUBSCRIBE
 * @type {Symbol}
 */
const SUBSCRIBE = Symbol('subscribe');

/**
 * @constant events
 * @type {Map}
 */
const events = new Map().set(SUBSCRIBE, () => {})
                        .set('custom', new WeakMap());

/**
 * @method event
 * @param {Symbol} event
 * @param {Function} fn
 * @return {void}
 */
export function on(event, fn) {
    void event;
    void fn;
}

/**
 * @method subscribe
 * @param {Function} fn
 * @return {void}
 */
export function subscribe(fn) {
    events.set(SUBSCRIBE, fn);
}

/**
 * @constant type
 * @type {{CREATE: Symbol, READ: Symbol, UPDATE: Symbol, DELETE: Symbol}}
 */
export const type = {
    CREATE: Symbol('create'),
    READ:   Symbol('read'),
    UPDATE: Symbol('update'),
    DELETE: Symbol('delete')
};

/**
 * @method for
 * @param {Object} collection
 * @return {Symbol}
 */
Object.getPrototypeOf(type).for = function(collection) {

    const customEvents = events.get('custom');
    const eventType = this.toString().match(/Symbol\((.+?)\)/)[1];

    if (!customEvents.has(collection)) {

        const name = 'unknown';

        customEvents.set(collection, {
            CREATE: Symbol(`create/${name}`),
            READ:   Symbol(`read/${name}`),
            UPDATE: Symbol(`update/${name}`),
            DELETE: Symbol(`delete/${name}`)
        });

    }

    return customEvents.get(collection)[eventType.toUpperCase()];

};
