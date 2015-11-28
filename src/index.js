import * as redux from 'redux';
import thunk from 'redux-thunk';
import Immutable from 'seamless-immutable';
import {throwException} from './helpers/exception';
import {actionSymbols, reducerActions, findSchemaByActionType} from './helpers/registry';
import {typecaster} from './helpers/middleware';
import {isFunction, hasSchema} from './helpers/sundries';

/**
 * @property
 * @type {Symbol}
 */
export const SCHEMA = Symbol('schema');

/**
 * @method createStore
 * @param {Function} reducer
 * @param {Array} [middleware=[]]
 * @return {Object}
 */
export function createStore(reducer, middleware = []) {

    const createStoreWithMiddleware = redux.applyMiddleware(
        ...[...middleware, typecaster, thunk]
    )(redux.createStore);

    const store = createStoreWithMiddleware(reducer);

    return Object.assign({}, store, {

        /**
         * @method getState
         * @return {*}
         */
        getState: () => {

            const state = store.getState();

            return Object.keys(state).reduce((accumulator, key) => {

                accumulator[key] = state[key].map(model => {

                    // todo: Use section to define relationships.
                    return Immutable(Object.assign({}, model, {
                        pets: ['Kipper', 'Miss Kittens', 'Busters']
                    }));

                });

                return accumulator;

            }, {});

        }
    });

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

    if (!actionSymbols.has(reducer)) {

        const CREATE = Symbol('create');
        const READ   = Symbol('read');
        const UPDATE = Symbol('update');
        const DELETE = Symbol('delete');

        reducerActions.set(CREATE, reducer).set(READ, reducer)
                      .set(UPDATE, reducer).set(DELETE, reducer);
        actionSymbols.set(reducer, { CREATE, READ, UPDATE, DELETE });

    }

    return actionSymbols.get(reducer);

}
