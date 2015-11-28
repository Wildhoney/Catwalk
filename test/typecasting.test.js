import 'babel-core/register';
import test from 'ava';
import {createStore} from '../src/index';
import {combineReducers} from 'redux';
import {field, cast, option} from '../src/field';
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
    t.is(cast.string()(2), '2');
    t.is(cast.string()(false), 'false');
    t.is(cast.string()('x'), 'x');
    t.is(cast.string()(null), '');
    t.end();
});

test('it can typecast integer values', t => {
    t.is(cast.integer()('2'), 2);
    t.is(cast.integer()(false), 0);
    t.is(cast.integer()('x'), 0);
    t.is(cast.integer()(null), 0);
    t.end();
});

test('it can typecast float values', t => {

    t.is(cast.float(1)(2), 2);
    t.is(cast.float(1)(false), 0);
    t.is(cast.float(1)('x'), 0);
    t.is(cast.float(1)(null), 0);

    t.is(cast.float(2)(5.5), 5.5);
    t.is(cast.float(2)(5.5345), 5.53);
    t.is(cast.float(2)(5.555), 5.56);

    t.end();

});

test('it typecasts dispatched models', t => {

    const {store} = t.context;

    store.dispatch(createPerson({ name: 42, age: '19', associates: [1, 2, 3] }));

    store.subscribe(() => {

        const {people: [person]} = store.getState();
        t.is(person.name, '42');
        t.is(person.age, 19);
        t.is(typeof person.associates, 'undefined');
        t.end();

    });

});
