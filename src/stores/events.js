/**
 * @constant SUBSCRIBE
 * @type {Symbol}
 */
export const SUBSCRIBE = Symbol('subscribe');

/**
 * @constant CUSTOM
 * @type {Symbol}
 */
export const CUSTOM = Symbol('subscribe');

/**
 * @constant events
 * @type {Map}
 */
export const events = new Map().set(SUBSCRIBE, () => {})
                               .set(CUSTOM, new WeakMap());
