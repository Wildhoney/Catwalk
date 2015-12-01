import * as redux from 'redux';
import thunk from 'redux-thunk';
import Immutable from 'seamless-immutable';
import {throwException} from './helpers/exception';
import {actionTypes} from './helpers/registry';
import {typecaster} from './helpers/middleware';
import {isFunction, hasSchema} from './helpers/sundries';
import {applyRelationships} from './helpers/relationships';

/**
 * @property
 * @type {Symbol}
 */
export const SCHEMA = Symbol('schema');

/**
 * @method extend
 * @param {Object} store
 * @return {Object}
 */
function extend(store) {

    /**
     * @method getState
     * @return {Object}
     */
    function getState() {

        const state = store.getState();

        return Object.keys(state).reduce((accumulator, key) => {

            accumulator[key] = state[key].map(model => {
                return new Immutable({ ...model, ...applyRelationships() });
            });

            return accumulator;

        }, {});

    }

    return { ...store, ...{getState} };

}

/**
 * @method createStore
 * @param {Function} reducer
 * @param {Array} [middleware = []]
 * @return {Object}
 */
export function createStore(reducer, middleware = []) {

    const createStoreWithMiddleware = redux.applyMiddleware(
        ...[...middleware, typecaster, thunk]
    )(redux.createStore);

    return extend(createStoreWithMiddleware(reducer));

}

/**
 * @method attachSchema
 * @param {Function} reducer
 * @param {Object} schema
 * @return {Function}
 */
export function attachSchema(reducer, schema) {
    reducer[SCHEMA] = schema;
    return reducer;
}

/**
 * @method actionsFor
 * @param {Function} reducer
 * @return {Object}
 */
export function actionsFor(reducer) {

    if (!isFunction(reducer) || !hasSchema(reducer)) {
        throwException('actionsFor reference must be a reducer function');
    }

    if (!actionTypes.has(reducer)) {

        const CREATE = Symbol('create');
        const READ = Symbol('read');
        const UPDATE = Symbol('update');
        const DELETE = Symbol('delete');

        actionTypes.set(reducer, { CREATE, READ, UPDATE, DELETE });

    }

    return actionTypes.get(reducer);

}
