import 'babel-core/register';
import test from 'ava';
import {createStore, actionsFor} from '../src/catwalk';
import {combineReducers} from 'redux';

import {createPerson} from './mocks/actions/people';
import people from './mocks/reducers/people';

test('it can define a schema', t => {

    const reducers = combineReducers({
        people
    });

    const createStoreWithMiddleware = applyMiddleware(thunk, camelize)(createStore);
    const store = createStoreWithMiddleware(reducers);

    t.end();

});