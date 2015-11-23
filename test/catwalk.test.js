import 'babel-core/register';
import test from 'ava';
import {createStore, actionsFor} from '../src/catwalk';
//import people from './mocks/people';

test('it can define a schema', t => {

    function people(state = [], action) {

        const event = actionsFor(people);

        switch (action.type) {

            case event.CREATE:
                return [...state, ...action.model];

            case event.DELETE:
                return state.filter(model => model.id !== action.model.id);

            default:
                return state;

        }

    }

    const store = createStore(people);
    //
    //store.dispatch(id => {
    //
    //    return dispatch => {
    //        dispatch({ type: actionsFor(PersonReducer).create });
    //    };
    //
    //});

    t.end();

});