import 'babel-core/register';
import test from 'ava';
import {createStore} from '../src/core';
import {combineReducers} from 'redux';
import {createPerson} from './mocks/actions/people';
import people from './mocks/reducers/people';
import Immutable from 'seamless-immutable';

test.beforeEach(t => {
    t.context.store = createStore({ people });
    t.end();
});

test('it creates immutable models', t => {

    const {store} = t.context;
    store.dispatch(createPerson({ name: 'Adam', age: 30 }));

    store.subscribe(() => {

        const {people, people: [person]} = store.getState();

        t.throws(() => {
            person.name = 'Maria';
            person.age = 24;
        }, `Cannot assign to read only property 'name' of [object Object]`);

        t.is(people.length, 1);
        t.is(person.name, 'Adam');
        t.is(person.age, 30);
        t.end();

    });

});
