/**
 * @constant SUBSCRIBE
 * @type {Symbol}
 */
const SUBSCRIBE = Symbol('subscribe');

/**
 * @constant events
 * @type {Map}
 */
const events = new Map().set(SUBSCRIBE, () => {});

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
    READ: Symbol('read'),
    UPDATE: Symbol('update'),
    DELETE: Symbol('delete')
};
