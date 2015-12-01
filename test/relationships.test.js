import 'babel-core/register';
import test from 'ava';
import {createStore} from '../src/core';
import {combineReducers} from 'redux';
import {createPerson} from './mocks/actions/people';
import {createAnimal} from './mocks/actions/animals';
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

    const {store} = t.context;

    store.dispatch(createAnimal({ name: 'Kipper' }));
    store.dispatch(createAnimal({ name: 'Miss Kittens' }));
    store.dispatch(createAnimal({ name: 'Jeremy' }));
    store.dispatch(createAnimal({ name: 'Busters' }));
    store.dispatch(createAnimal({ name: 'Henry' }));

    const pets = ['Kipper', 'Miss Kittens', 'Busters'];
    store.dispatch(createPerson({ name: 'Adam', age: 30, pets }));

    store.subscribe(() => {

        const {people, animals, people: [person]} = store.getState();

        if (person && person.name === 'Adam') {

            t.is(people.length, 1);
            t.is(animals.length, 5);

            t.is(person.name, 'Adam');
            t.is(person.age, 30);

            //const {pets} = person;
            //t.is(pets[0].name, 'Kipper');
            //t.is(pets[1].name, 'Miss Kittens');
            //t.is(pets[2].name, 'Busters');

            t.end();

        }

    });

});
