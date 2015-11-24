import * as redux from 'redux';

/**
 * @method createStore
 * @param {Array} reducers
 * @return {Object}
 */
export function createStore(reducers) {
    return redux.createStore(reducers);
}

/**
 * @method createSchema
 * @param {Object} schema
 * @return {Function}
 */
export function createSchema(schema) {
    return () => {};
}

/**
 * @constant actionSymbols
 * @type {WeakMap}
 */
const actionSymbols = new WeakMap();

/**
 * @method actionsFor
 * @param reducer {Object}
 * @return {Object}
 */
export function actionsFor(reducer) {

    if (!actionSymbols.has(reducer)) {

        actionSymbols.set(reducer, {
            CREATE: Symbol('create'),
            READ:   Symbol('read'),
            UPDATE: Symbol('update'),
            DELETE: Symbol('delete')
        });

    }

    return actionSymbols.get(reducer);

}
