import 'babel-core/register';
import test from 'ava';
import {collection} from '../src/collection';
import {on, off, type} from '../src/event';
import {events} from '../src/stores/events';

test('it registers default event types', t => {

    t.is(typeof type.CREATE, 'object');
    t.is(typeof type.READ, 'object');
    t.is(typeof type.UPDATE, 'object');
    t.is(typeof type.DELETE, 'object');

    t.end();

});

test('it unregisters events', t => {

    on(type.CREATE, () => {});
    on(type.UPDATE, () => {});

    t.true(events.has(type.CREATE));
    t.true(events.has(type.UPDATE));

    off(type.CREATE);
    t.false(events.has(type.CREATE));
    t.true(events.has(type.UPDATE));

    off(type.UPDATE);
    t.false(events.has(type.CREATE));
    t.false(events.has(type.UPDATE));

    t.end();

});

test('it registers custom events for collections', t => {

    const countries = collection('countries', {});

    t.is(typeof type.CREATE.for(countries), 'object');
    t.is(typeof type.READ.for(countries), 'object');
    t.is(typeof type.UPDATE.for(countries), 'object');
    t.is(typeof type.DELETE.for(countries), 'object');

    // All symbols should be readable when cast to a string.
    t.is(type.CREATE.for(countries).toString(), 'create/countries');
    t.is(type.READ.for(countries).toString(), 'read/countries');
    t.is(type.UPDATE.for(countries).toString(), 'update/countries');
    t.is(type.DELETE.for(countries).toString(), 'delete/countries');

    // Unknown objects should receive the "unknown" string for its symbols.
    t.is(type.READ.for({}).toString(), 'read/unknown');

    t.end();

});
