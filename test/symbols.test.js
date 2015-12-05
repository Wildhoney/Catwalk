import 'babel-core/register';
import test from 'ava';
import {createStore, actionsFor, combineReducers} from '../src/core';
import people from './mocks/reducers/people';

test.beforeEach(t => {
    t.context.store = createStore(combineReducers({ people }));
    t.end();
});

test('it can create symbols for reducers', t => {

    const {CREATE, READ, UPDATE, DELETE} = actionsFor(people);

    t.is(CREATE, actionsFor(people).CREATE);
    t.is(READ, actionsFor(people).READ);
    t.is(UPDATE, actionsFor(people).UPDATE);
    t.is(DELETE, actionsFor(people).DELETE);

    t.end();

});

test('it throws an exception for non-function symbols', t => {

    const exception = 'Catwalk: actionsFor reference must be a reducer function.';

    t.doesNotThrow(() => actionsFor(people), exception);
    t.throws(() => actionsFor({}), exception);
    t.throws(() => actionsFor(''), exception);
    t.throws(() => actionsFor(1), exception);

    t.end();

});
