import 'babel-core/register';
import test from 'ava';
import {subscribe} from '../src/event';
import pets from './mocks/pets';

test('it can create a model', t => {

    pets.create({ name: 'Busters', age: 4 });

    subscribe(state => {
        t.is(state.pets.length, 1);
        t.is(state.pets[0].name, 'Busters');
        t.is(state.pets[0].age, 4);
        t.end();
    });

});
