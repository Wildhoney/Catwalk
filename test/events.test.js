import 'babel-core/register';
import test from 'ava';
import { collection } from '../src/collection';
import { type } from '../src/event';

test('it registers default event types', t => {

    t.is(typeof type.CREATE, 'symbol');
    t.is(typeof type.READ, 'symbol');
    t.is(typeof type.UPDATE, 'symbol');
    t.is(typeof type.DELETE, 'symbol');

    t.end();

});

test('it registers custom events for collections', t => {

    const countries = collection('countries', {});

    t.is(typeof type.CREATE.for(countries), 'symbol');
    t.is(typeof type.READ.for(countries), 'symbol');
    t.is(typeof type.UPDATE.for(countries), 'symbol');
    t.is(typeof type.DELETE.for(countries), 'symbol');

    // All symbols should be readable when cast to a string.
    t.is(type.CREATE.for(countries).toString(), 'Symbol(create/countries)');
    t.is(type.READ.for(countries).toString(), 'Symbol(read/countries)');
    t.is(type.UPDATE.for(countries).toString(), 'Symbol(update/countries)');
    t.is(type.DELETE.for(countries).toString(), 'Symbol(delete/countries)');

    // Unknown objects should receive the "unknown" string for its symbols.
    t.is(type.READ.for({}).toString(), 'Symbol(read/unknown)');

    t.end();

});
