import test from 'ava';
import {collection, size, subscribe} from '../dist/collection';
import {field, cast, option} from '../dist/field';

test('it can create a collection', t => {

    t.is(size(), 0);

    collection('humans', {
        id:   field(cast.integer(), option.PRIMARY_KEY),
        name: field(cast.string())
    });

    t.is(size(), 1);

    collection('pets', {
        id:   field(cast.integer(), option.PRIMARY_KEY),
        name: field(cast.string()),
        age:  field(cast.integer())
    });

    t.is(size(), 2);
    t.end();

});

test('it throws an exception when no primary key', t => {

    t.throws(() => {

        collection('humans', {
            id:  field(cast.integer()),
            age: field(cast.float(2))
        });

    }, 'Catwalk: Must define a PK on "humans" collection.');

    t.is(size(), 2);
    t.end();

});

test('it can register a subscribe function', t => {

    t.is(typeof subscribe(), 'function');
    const customSubscription = () => {};
    subscribe(customSubscription);
    t.is(subscribe(), customSubscription);
    t.end();

});
