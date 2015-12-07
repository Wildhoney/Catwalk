import {events, SUBSCRIBE, CUSTOM} from './stores/events';

/**
 * @method setupEvent
 * @param {String} type
 * @return {{action: *, for: eventFor, toString: toString}}
 */
function setupEvent(type) {
    return { action: type, for: eventFor, toString: function() {
        return this.action;
    }};
}

/**
 * @method eventFor
 * @param {Object} collection
 * @return {Symbol}
 */
function eventFor(collection) {

    const customEvents = events.get(CUSTOM);
    const eventType = this.action;

    if (!customEvents.has(collection)) {

        const name = collection.name || 'unknown';

        customEvents.set(collection, {
            CREATE: setupEvent(`create/${name}`),
            READ: setupEvent(`read/${name}`),
            UPDATE: setupEvent(`update/${name}`),
            DELETE: setupEvent(`delete/${name}`)
        });

    }

    return customEvents.get(collection)[eventType.toUpperCase()];

}

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
    CREATE: setupEvent('create'),
    READ:   setupEvent('read'),
    UPDATE: setupEvent('update'),
    DELETE: setupEvent('delete')
};
