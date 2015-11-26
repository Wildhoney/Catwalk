import * as redux from 'redux';
import thunk from 'redux-thunk';
import {throwException} from './helpers/exception';

/**
 * @property
 * @type {Symbol}
 */
export const SCHEMA = Symbol('schema');

/**
 * @method serialize
 * @return {Function}
 */
function serialize() {

    return next => action => {

        const {type, model} = action;

        if (type && model) {

            const schema = findSchemaByActionType(type);

            if (schema) {

                // Typecast the model according to its schema.
                const modifiedModel = Object.keys(model).reduce((accumulator, key) => {
                    const {cast} = schema[key];
                    accumulator[key] = cast(model[key]);
                    return accumulator;
                }, {});

                next(Object.assign({}, action, { model: modifiedModel }));
                return;

            }

        }

        next(action);

    };

}


/**
 * @method createStore
 * @param {Function} reducer
 * @param {Array} [middleware=[]]
 * @return {Object}
 */
export function createStore(reducer, middleware = []) {

    const createStoreWithMiddleware = redux.applyMiddleware(
        ...[...middleware, serialize, thunk]
    )(redux.createStore);

    return createStoreWithMiddleware(reducer);

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
 * @method isFunction
 * @param {*} fn
 * @return {Boolean}
 */
function isFunction(fn) {
    return typeof fn === 'function';
}

/**
 * @constant actionSymbols
 * @type {WeakMap}
 */
const actionSymbols = new WeakMap();

/**
 * @constant reducerActions
 * @type {Map}
 */
const reducerActions = new Map();

/**
 * @method findSchemaByActionType
 * @param {Symbol} actionType
 * @return {Object}
 */
function findSchemaByActionType(actionType) {
    return reducerActions.get(actionType)[SCHEMA];
}

/**
 * @method actionsFor
 * @param {Function} reducer
 * @return {Object}
 */
export function actionsFor(reducer) {

    if (!isFunction(reducer)) {
        throwException('actionsFor reference must be a reducer function');
    }

    if (!actionSymbols.has(reducer)) {

        const symbols = {
            create: Symbol('create'),
            read:   Symbol('read'),
            update: Symbol('update'),
            delete: Symbol('delete')
        };

        reducerActions.set(symbols.create, reducer);
        reducerActions.set(symbols.read, reducer);
        reducerActions.set(symbols.update, reducer);
        reducerActions.set(symbols.delete, reducer);

        actionSymbols.set(reducer, {
            CREATE: symbols.create,
            READ:   symbols.read,
            UPDATE: symbols.update,
            DELETE: symbols.delete
        });

    }

    return actionSymbols.get(reducer);

}
