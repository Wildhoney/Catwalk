import 'babel-core/register';
import test from 'ava';
import {createStore} from '../src/index';
import {combineReducers} from 'redux';
import {createPerson} from './mocks/actions/people';
import people from './mocks/reducers/people';
import animals from './mocks/reducers/animals';

test.beforeEach(t => {

    const reducers = combineReducers({
        people, animals
    });

    t.context.store = createStore(reducers);
    t.end();

});

test('it can handle basic relationships', t => {
    t.pass();
    t.end();
});
