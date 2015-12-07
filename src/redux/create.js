import * as redux from 'redux';
import thunk from 'redux-thunk';
import Immutable from 'seamless-immutable';
import {typecast} from '../helpers/middleware';
import {applyRelationships} from '../helpers/relationships';
import {reducerMap} from '../redux/reducers';

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

        console.log(store);

        return Object.keys(state).reduce((accumulator, key) => {

            //console.log(reducerMap.get(store.replaceReducer));

            accumulator[key] = state[key].map(model => {
                return new Immutable({ ...model, ...applyRelationships(model, schema) });
            });

            return accumulator;

        }, {});

    }

    return { ...store, ...{getState} };

}

/**
 * @method createStore
 * @param {Function} reducer
 * @return {Object}
 */
export function createStore(reducer) {

    const middleware = [];
    const withMiddleware = redux.applyMiddleware(
        ...[...middleware, typecast, thunk]
    )(redux.createStore);

    return extend(withMiddleware(reducer));

}

