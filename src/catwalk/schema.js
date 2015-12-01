import {throwException} from '../helpers/exception';
import {actionTypes} from '../helpers/registry';
import {isFunction, hasSchema} from '../helpers/sundries';

/**
 * @property
 * @type {Symbol}
 */
export const SCHEMA = Symbol('schema');

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
