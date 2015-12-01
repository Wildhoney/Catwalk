import * as redux from 'redux';
import thunk from 'redux-thunk';
import Immutable from 'seamless-immutable';
import {typecast} from '../helpers/middleware';
import {applyRelationships} from '../helpers/relationships';

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
 * @param {Object} reducers
 * @return {Object}
 */
export function createStore(reducers) {

    const middleware = [];
    const reducer = redux.combineReducers(reducers);

    const createStoreWithMiddleware = redux.applyMiddleware(
        ...[...middleware, typecast, thunk]
    )(redux.createStore);

    return extend(createStoreWithMiddleware(reducer));

}

/**
 * @method createStoreWithMiddleware
 * @param {Object} reducers
 * @param {Array} middleware
 * @return {Object}
 */
export function createStoreWithMiddleware(reducers, ...middleware) {

}
