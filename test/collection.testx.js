import 'babel-core/register';
import test from 'ava';
import {subscribe} from '../src/event';
import pets from './mocks/pets';

test('it can create a model', t => {

    pets.create({ name: 'Busters', age: 4 });

    t.pass();
    t.end();

    subscribe(state => {
        t.is(state.pets.length, 1);
        t.is(state[0].pets.name, 'Busters');
        t.is(state[0].pets.age, 4);
        t.end();
    });

});
