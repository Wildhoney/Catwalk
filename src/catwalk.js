import * as redux from 'redux';
import thunk from 'redux-thunk';

/**
 * @method createStore
 * @param {Object} reducers
 * @return {Object}
 */
export function createStore(reducers) {
    const createStoreWithMiddleware = redux.applyMiddleware(thunk)(redux.createStore);
    return createStoreWithMiddleware(reducers);
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
