import {SCHEMA} from '../index';

/**
 * @constant actionSymbols
 * @type {WeakMap}
 */
export const actionSymbols = new WeakMap();

/**
 * @constant reducerActions
 * @type {Map}
 */
export const reducerActions = new Map();

/**
 * @method findSchemaByActionType
 * @param {Symbol} actionType
 * @return {Object}
 */
export function findSchemaByActionType(actionType) {
    return reducerActions.get(actionType)[SCHEMA];
}
