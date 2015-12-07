import {events, SUBSCRIBE, CUSTOM} from './stores/events';

/**
 * @method event
 * @param {Symbol} type
 * @param {Function} fn
 * @return {Map}
 */
export function on(type, fn) {
    return events.set(type, fn);
}

/**
 * @method off
 * @param {Symbol} type
 * @return {Boolean}
 */
export function off(type) {
    return events.delete(type);
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

/**
 * @method for
 * @param {Object} collection
 * @return {Symbol}
 */
Object.getPrototypeOf(type).for = function(collection) {

    const customEvents = events.get(CUSTOM);
    const eventType = this.toString().match(/Symbol\((.+?)\)/)[1];

    if (!customEvents.has(collection)) {

        const name = collection.name || 'unknown';

        customEvents.set(collection, {
            CREATE: Symbol(`create/${name}`),
            READ: Symbol(`read/${name}`),
            UPDATE: Symbol(`update/${name}`),
            DELETE: Symbol(`delete/${name}`)
        });

    }

    return customEvents.get(collection)[eventType.toUpperCase()];

};
