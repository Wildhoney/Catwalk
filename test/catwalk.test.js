import 'babel-core/register';
import test from 'ava';
import {createStore, actionsFor} from '../src/catwalk';
import {combineReducers} from 'redux';
import {createPerson} from './mocks/actions/people';
import people from './mocks/reducers/people';

test.beforeEach(t => {

    const reducers = combineReducers({
        people
    });

    t.context.store = createStore(reducers);
    t.end();

});

test('it can create a model', t => {

    const {store} = t.context;
    store.dispatch(createPerson({ name: 'Adam', age: 30 }));
    
    store.subscribe(() => {
        t.is(store.getState().people.length, 1);
        t.end();
    });

});
