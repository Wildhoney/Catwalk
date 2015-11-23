import test from 'ava';
import {collection, size, subscribe} from '../dist/collection';
import {field, cast, option} from '../dist/field';

test('it can')




import { createStore } from 'redux';
import { createSchema } from 'catwalk';

// Create your reducer with the schema attached as a decorator.
@createSchema({
    name: field(cast.integer(), option.PRIMARY_KEY)
})
function PersonReducer(state = [], action) {

    const event = actionsFor(PersonReducer);

    switch (action.type) {

        case event.CREATE:
            return [...state, ...action.model];

        case event.DELETE:
            return state.filter(model => model.id !== action.model.id);

        default:
            return state;

    }
}

// Create your store passing in the reducer functions.
const store = createStore(counter);

// Dispatch an event.
store.dispatch(id => {

    return dispatch => {
        dispatch({ type: actionsFor(PersonReducer).create });
    };

});
