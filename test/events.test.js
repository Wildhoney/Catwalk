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

    t.end();

});
