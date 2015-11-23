import test from 'ava';
import {create, size} from '../dist/collection';
import {type} from '../dist/type';

test('it can create a collection', t => {

    const human = { id: type.primaryKey(), name: type.name(), age: type.number() };
    const pet   = { id: type.primaryKey(), name: type.name(), age: type.number() };

    t.is(size(), 0);
    create('humans', human);
    t.is(size(), 1);
    create('pets', pet);
    t.is(size(), 2);
    t.end();

});
