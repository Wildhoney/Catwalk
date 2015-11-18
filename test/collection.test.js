import test from 'ava';
import {create, size} from '../dist/collection';

test('it can create a collection', t => {
    t.is(size(), 0);
    create('humans', { name: '', age: '' });
    t.is(size(), 1);
    create('pets', { name: '', age: '' });
    t.is(size(), 2);
    t.end();
});
