import 'babel-core/register';
import test from 'ava';
import {createStore} from '../src/core';
import {combineReducers} from 'redux';
import {createPerson, readPerson, updatePerson, deletePerson} from './mocks/actions/people';
import people from './mocks/reducers/people';

test.beforeEach(t => {
    t.context.store = createStore({ people });
    t.end();
});

test('it can create a model', t => {

    const {store} = t.context;
    store.dispatch(createPerson({ name: 'Adam', age: 30 }));

    store.subscribe(() => {

        const {people, people: [person]} = store.getState();

        t.is(people.length, 1);
        t.is(person.name, 'Adam');
        t.is(person.age, 30);
        t.end();

    });

});

test('it can read a model', t => {

    const {store} = t.context;
    store.dispatch(readPerson({ name: 'Maria', age: 24 }));

    store.subscribe(() => {

        const {people, people: [person]} = store.getState();

        t.is(people.length, 1);
        t.is(person.name, 'Maria');
        t.is(person.age, 24);
        t.end();

    });

});

test('it can delete a model', t => {

    const {store} = t.context;
    store.dispatch(createPerson({ name: 'Adam', age: 30 }));
    store.dispatch(createPerson({ name: 'Maria', age: 24 }));
    store.dispatch(deletePerson({ name: 'Adam' }));

    store.subscribe(() => {

        const {people, people: [person]} = store.getState();

        if (person.name === 'Maria') {
            t.is(people.length, 1);
            t.is(person.name, 'Maria');
            t.is(person.age, 24);
            t.end();
        }

    });

});

test('it can update a model', t => {

    const {store} = t.context;
    store.dispatch(createPerson({ name: 'Adam', age: 30 }));
    store.dispatch(updatePerson(0, { name: 'Maria', age: 24 }));

    store.subscribe(() => {

        const {people, people: [person]} = store.getState();

        if (person.name === 'Maria') {
            t.is(people.length, 1);
            t.is(person.name, 'Maria');
            t.is(person.age, 24);
            t.end();
        }

    });

});
