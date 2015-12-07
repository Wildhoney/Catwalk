# Catwalk

![Travis](http://img.shields.io/travis/Wildhoney/Catwalk.js.svg?style=flat)
&nbsp;
![npm](http://img.shields.io/npm/v/catwalk.js.svg?style=flat)
&nbsp;
![License MIT](http://img.shields.io/badge/License-MIT-lightgrey.svg?style=flat)

* **npm:** `npm install catwalk`

`Catwalk` is a [CRUD](http://en.wikipedia.org/wiki/Create,_read,_update_and_delete) interface that allows you to [lazy-load](http://en.wikipedia.org/wiki/Lazy_loading) your data. It's written in ES6 and transpiled to ES5 using Google's Traceur module. By using `Catwalk` you interact with simple CRUD events using promises to either `resolve` or `reject` a certain action &ndash; there are absolutely no convoluted methods or sequences that materialised in [Ember Data](https://github.com/emberjs/data).

<img src="http://i.imgur.com/2mGwX42.jpg" width="300" />
---

## Getting Started

```javascript
import {collection} from 'catwalk/collection';
import {field, cast} from 'catwalk/field';
import {on, type} from 'catwalk/event';

// Define a collection specifying its fields and their data-types.
const pets = collection('pets', {
    name: field(cast.string()),
    age:  field(cast.integer())
});

// Subscribe to the updating of any collections.
on(type.SUBSCRIBE, models => {
    console.log(`We have ${models.length} pet(s)!`);
});

// Consider the request successful when we create a pet.
on(type.CREATE, ({ model, resolve, reject }) => {
    resolve(model);
});

// Listen for delete events only on the pets collection.
on(type.CREATE.PETS, ({ model, resolve }) {
    resolve();
});

// Create some pets that need to be either resolved or rejected.
pets.create({ name: 'Miss Kittens', age: 4 });
pets.create({ name: 'Busters', age: 5 });
```

### Transactions (Future)

**Note:** Transactions are not yet supported, and the example below is how it *may* look once implemented.

```javascript
import {atomic} from 'catwalk/transaction';

atomic(async function({ commit, rollback }) {
    await pets.create({ name: 'Miss Kittens', age: 4 });
    await pets.create({ name: 'Busters', age: 5 });
    rollback();
);
```
