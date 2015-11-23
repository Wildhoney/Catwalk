import test from 'ava';
import {create, size} from '../dist/collection';
import {field, cast, PRIMARY_KEY} from '../dist/field';

test('it can create a collection', t => {

    const abstract = {
        id:   field(cast.integer(), PRIMARY_KEY),
        name: field(cast.string()),
        age:  field(cast.integer())
    };

    t.is(size(), 0);
    create('humans', abstract);
    t.is(size(), 1);
    create('pets', abstract);
    t.is(size(), 2);
    t.end();

});

test('it throws an exception when no primary key', t => {

    const human = {
        id:     field(cast.integer()),
        rating: field(cast.float(2))
    };

    t.throws(() => create('humans', human), 'Catwalk: Must define a PK on "humans" collection.');
    t.end();

});
