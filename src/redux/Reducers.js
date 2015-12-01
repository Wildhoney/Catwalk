import * as redux from 'redux';

/**
 * @constant reducerMap
 * @type {Map}
 */
const reducerMap = new Map();

/**
 * @method combineReducers
 * @param {Object} reducers
 * @return {Function}
 */
export function combineReducers(reducers) {
    const combined = redux.combineReducers(reducers);
    reducerMap.set(combined, reducers);
    return combined;
}
