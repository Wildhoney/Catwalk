import test from 'ava';
import {create, size} from '../dist/collection';
import {field, integer, float, string, PRIMARY_KEY} from '../dist/field';

test('it can create a collection', t => {

    const human = { id: field(integer(), PRIMARY_KEY), name: field(string()), age: field(integer()) };
    const pet   = { id: field(integer(), PRIMARY_KEY), name: field(string()), age: field(integer()) };

    t.is(size(), 0);
    create('humans', human);
    t.is(size(), 1);
    create('pets', pet);
    t.is(size(), 2);
    t.end();

});

test('it throws an exception when no primary key', t => {

    const human = {
        id: field(integer()),
        rating: field(float(2))
    };

    t.throws(() => create('humans', human), 'Catwalk: Must define a PK on "humans" collection.');
    t.end();

});
