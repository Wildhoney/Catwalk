import 'babel-core/register';
import test from 'ava';
import {createStore} from '../src/core';
import {combineReducers} from 'redux';
import {integer, string, array, float} from '../src/field';
import {createPerson} from './mocks/actions/people';
import people from './mocks/reducers/people';

test.beforeEach(t => {

    const reducers = combineReducers({
        people
    });

    t.context.store = createStore(reducers);
    t.end();

});

test('it can typecast string values', t => {
    t.is(string()(2), '2');
    t.is(string()(false), 'false');
    t.is(string()('x'), 'x');
    t.is(string()(null), '');
    t.end();
});

test('it can typecast integer values', t => {
    t.is(integer()('2'), 2);
    t.is(integer()(false), 0);
    t.is(integer()('x'), 0);
    t.is(integer()(null), 0);
    t.end();
});

test('it can typecast float values', t => {

    t.is(float(1)(2), 2);
    t.is(float(1)(false), 0);
    t.is(float(1)('x'), 0);
    t.is(float(1)(null), 0);

    t.is(float(2)(5.5), 5.5);
    t.is(float(2)(5.5345), 5.53);
    t.is(float(2)(5.555), 5.56);

    t.end();

});

test('it can typecast array values', t => {
    t.same(array()('Adam'), ['Adam']);
    t.same(array()('Adam Maria'), ['Adam Maria']);
    t.same(array()(1), [1]);
    t.same(array()(false), [false]);
    t.same(array()(['Adam']), ['Adam']);
    t.same(array()([2]), [2]);
    t.same(array()([true]), [true]);
    t.end();
});

test('it typecasts dispatched models', t => {

    const {store} = t.context;

    store.dispatch(createPerson({ name: 42, age: '19' }));

    store.subscribe(() => {

        const {people: [person]} = store.getState();
        t.is(person.name, '42');
        t.is(person.age, 19);
        t.end();

    });

});

test('it removes non-described schema properties', t => {

    const {store} = t.context;

    store.dispatch(createPerson({ name: 'Adam', age: 30, associates: [1, 2, 3] }));

    store.subscribe(() => {
        const {people: [person]} = store.getState();
        t.is(typeof person.associates, 'undefined');
        t.end();
    });

});
