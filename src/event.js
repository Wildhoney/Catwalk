/**
 * @method event
 * @param {Symbol} event
 * @param {Function} fn
 * @return {void}
 */
export function on(event, fn) {

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
